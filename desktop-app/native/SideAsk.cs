using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shell;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Forms = System.Windows.Forms;
using Drawing = System.Drawing;

namespace SideAskDesktop
{
    internal static class Program
    {
        private static Mutex instanceMutex;
        private static EventWaitHandle showEvent;

        [STAThread]
        private static void Main()
        {
            bool created;
            instanceMutex = new Mutex(true, "Local\\SideAskDesktopOverlay", out created);
            showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\SideAskDesktopShow");
            if (!created)
            {
                showEvent.Set();
                return;
            }

            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            var application = new Application();
            application.ShutdownMode = ShutdownMode.OnExplicitShutdown;
            var window = new SideAskWindow();
            application.MainWindow = window;

            Task.Run(delegate
            {
                while (showEvent.WaitOne())
                {
                    if (application.Dispatcher.HasShutdownStarted) return;
                    application.Dispatcher.BeginInvoke(new Action(window.ShowFromTray));
                }
            });

            application.Run(window);
            showEvent.Dispose();
            instanceMutex.ReleaseMutex();
            instanceMutex.Dispose();
        }
    }

    internal sealed class SideAskWindow : Window
    {
        private const string VersionLabel = "0.7.1-preview.1";
        private const double CompactWindowWidth = 414;
        private const double CompactWindowHeight = 590;
        private const double ExpandedWindowWidth = 454;
        private const double ExpandedWindowHeight = 720;
        private const int HotkeyId = 0x5341;
        private const uint ModAlt = 0x0001;
        private const uint ModControl = 0x0002;
        private const uint ModShift = 0x0004;
        private const uint KeyA = 0x41;
        private const uint KeySpace = 0x20;
        private const int VirtualKeyLeftMouse = 0x01;
        private const int VirtualKeyEscape = 0x1B;
        private const int WmHotkey = 0x0312;
        private const int WmNcLeftButtonDown = 0x00A1;
        private const int WmEnterSizeMove = 0x0231;
        private const int WmExitSizeMove = 0x0232;
        private const int HtCaption = 2;
        private const int HtLeft = 10;
        private const int HtRight = 11;
        private const int HtTop = 12;
        private const int HtTopLeft = 13;
        private const int HtTopRight = 14;
        private const int HtBottom = 15;
        private const int HtBottomLeft = 16;
        private const int HtBottomRight = 17;
        private const uint GaRoot = 2;
        private const int DwmWindowAttributeCornerPreference = 33;
        private const int DwmWindowAttributeBorderColor = 34;
        private const int DwmCornerRound = 2;
        private const int DwmColorNone = unchecked((int)0xFFFFFFFE);

        private readonly WebView2 webView;
        private readonly JavaScriptSerializer json;
        private readonly HttpClient http;
        private readonly SemaphoreSlim gatewayLock;
        private readonly Dictionary<string, CancellationTokenSource> chats;
        private readonly Uri gatewayUri;
        private readonly string baseDirectory;
        private readonly string catalogPath;
        private readonly string settingsPath;
        private Forms.NotifyIcon tray;
        private Popup explainCue;
        private Border explainCueSurface;
        private Process gatewayProcess;
        private HwndSource hwndSource;
        private IntPtr windowHandle;
        private IntPtr previousForeground;
        private bool rendererReady;
        private bool webViewInitializationStarted;
        private bool pinned;
        private bool autoCapture;
        private bool preferBrowserExtension;
        private bool busy;
        private bool quitting;
        private string registeredShortcut;
        private object initialCapture;
        private System.Windows.Threading.DispatcherTimer selectionTimer;
        private bool leftMouseDown;
        private bool escapeKeyDown;
        private bool selectionMonitorObserved;
        private NativePoint mouseDownPoint;
        private NativePoint lastMouseUpPoint;
        private uint lastMouseUpTime;
        private int autoCaptureScheduled;
        private int captureInProgress;
        private DateTime autoHideAllowedAfter;
        private int windowModeAnimationVersion;

        internal SideAskWindow()
        {
            baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
            catalogPath = Path.Combine(baseDirectory, "runtime", "extension", "provider-catalog.json");
            gatewayUri = NormalizeGateway(Environment.GetEnvironmentVariable("SIDEASK_GATEWAY_URL"));
            json = new JavaScriptSerializer();
            json.MaxJsonLength = Int32.MaxValue;
            var settingsOverride = Environment.GetEnvironmentVariable("SIDEASK_DESKTOP_SETTINGS_PATH");
            settingsPath = String.IsNullOrWhiteSpace(settingsOverride)
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SideAsk", "desktop-settings.json")
                : Path.GetFullPath(settingsOverride);
            autoCapture = LoadBooleanSetting("autoCapture", false);
            preferBrowserExtension = LoadBooleanSetting("preferBrowserExtension", true);
            DebugLog(
                "automatic selection preference=" + (autoCapture ? "on" : "off")
                + " browser priority=" + (preferBrowserExtension ? "on" : "off")
                + " settings=" + settingsPath
            );
            http = new HttpClient();
            http.Timeout = Timeout.InfiniteTimeSpan;
            gatewayLock = new SemaphoreSlim(1, 1);
            chats = new Dictionary<string, CancellationTokenSource>();
            registeredShortcut = "";
            autoHideAllowedAfter = DateTime.UtcNow.AddSeconds(6);

            Title = "SideAsk";
            Width = CompactWindowWidth;
            Height = CompactWindowHeight;
            MinWidth = 360;
            MinHeight = 480;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.CanResize;
            AllowsTransparency = false;
            Background = Brushes.White;
            Topmost = true;
            ShowInTaskbar = true;
            WindowStartupLocation = WindowStartupLocation.Manual;
            WindowChrome.SetWindowChrome(this, new WindowChrome
            {
                CaptionHeight = 0,
                ResizeBorderThickness = new Thickness(7),
                GlassFrameThickness = new Thickness(0),
                CornerRadius = new CornerRadius(0),
                UseAeroCaptionButtons = false
            });

            var iconPath = Path.Combine(baseDirectory, "assets", "sideask.ico");
            if (File.Exists(iconPath)) Icon = BitmapFrame.Create(new Uri(iconPath, UriKind.Absolute));

            webView = new WebView2();
            Content = webView;
            explainCue = CreateExplainCue();
            PositionNearCursor();
            LoadInitialCapture();

            SourceInitialized += OnSourceInitialized;
            ContentRendered += OnContentRendered;
            Deactivated += OnDeactivated;
            Closing += OnClosing;
            Closed += OnClosed;
        }

        private static Uri NormalizeGateway(string value)
        {
            Uri parsed;
            if (!Uri.TryCreate(String.IsNullOrWhiteSpace(value) ? "http://127.0.0.1:8787" : value.Trim(), UriKind.Absolute, out parsed))
                throw new InvalidOperationException("SideAsk Gateway URL is invalid.");
            if (parsed.Scheme != Uri.UriSchemeHttp || !(parsed.Host == "127.0.0.1" || parsed.Host == "localhost" || parsed.Host == "::1"))
                throw new InvalidOperationException("SideAsk Gateway must use an HTTP loopback address.");
            return new Uri(parsed.GetLeftPart(UriPartial.Authority));
        }

        private void LoadInitialCapture()
        {
            var text = CleanText(Environment.GetEnvironmentVariable("SIDEASK_CAPTURE_TEXT"), 12000);
            if (text.Length == 0) return;
            initialCapture = Map(
                "text", text,
                "sourceTitle", CleanText(Environment.GetEnvironmentVariable("SIDEASK_CAPTURE_SOURCE"), 300, "Windows selection"),
                "autoAsk", Environment.GetEnvironmentVariable("SIDEASK_CAPTURE_AUTO_ASK") != "0"
            );
        }

        private void OnSourceInitialized(object sender, EventArgs eventArgs)
        {
            windowHandle = new WindowInteropHelper(this).Handle;
            hwndSource = HwndSource.FromHwnd(windowHandle);
            if (hwndSource != null) hwndSource.AddHook(WindowProcedure);
            RegisterShortcut();
            if (autoCapture && !InstallAutoCaptureHook())
            {
                autoCapture = false;
                SaveSettings();
            }
            DebugLog("window=" + windowHandle.ToInt64().ToString(CultureInfo.InvariantCulture) + " shortcut=" + registeredShortcut);
            int preference = DwmCornerRound;
            DwmSetWindowAttribute(windowHandle, DwmWindowAttributeCornerPreference, ref preference, sizeof(int));
            int borderColor = DwmColorNone;
            DwmSetWindowAttribute(windowHandle, DwmWindowAttributeBorderColor, ref borderColor, sizeof(int));
        }

        private async void OnContentRendered(object sender, EventArgs eventArgs)
        {
            if (webViewInitializationStarted) return;
            webViewInitializationStarted = true;
            CreateTray();
            RevealWindow(5000);
            RunSelectionCueSelfTestIfRequested();
            try
            {
                DebugLog("webview initialization started");
                var dataDirectoryOverride = Environment.GetEnvironmentVariable("SIDEASK_WEBVIEW2_DATA_PATH");
                var dataDirectory = String.IsNullOrWhiteSpace(dataDirectoryOverride)
                    ? Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                        "SideAsk",
                        "DesktopWebView2"
                    )
                    : Path.GetFullPath(dataDirectoryOverride);
                var environment = await CoreWebView2Environment.CreateAsync(null, dataDirectory);
                DebugLog("webview environment ready");
                await webView.EnsureCoreWebView2Async(environment);
                DebugLog("webview core ready");
                ConfigureWebView();
                webView.Source = new Uri("https://sideask.local/ui/index.html?host=native");
                DebugLog("webview navigation started");
                BeginCapturePreviewIfRequested();
            }
            catch (Exception error)
            {
                DebugLog("webview initialization failed: " + FriendlyMessage(error));
                MessageBox.Show("SideAsk WebView2 failed to start:\n" + error.Message, "SideAsk", MessageBoxButton.OK, MessageBoxImage.Error);
                QuitApplication();
            }
        }

        private void ConfigureWebView()
        {
            var core = webView.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping("sideask.local", baseDirectory, CoreWebView2HostResourceAccessKind.DenyCors);
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.WebMessageReceived += OnWebMessageReceived;
            core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args)
            {
                var uri = new Uri(args.Uri);
                if (!String.Equals(uri.Host, "sideask.local", StringComparison.OrdinalIgnoreCase)) args.Cancel = true;
            };
            core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args)
            {
                args.Handled = true;
                OpenExternal(args.Uri);
            };
        }

        private async void BeginCapturePreviewIfRequested()
        {
            var target = Environment.GetEnvironmentVariable("SIDEASK_CAPTURE_PATH");
            if (String.IsNullOrWhiteSpace(target)) return;
            int delay = 900;
            Int32.TryParse(Environment.GetEnvironmentVariable("SIDEASK_CAPTURE_DELAY"), out delay);
            delay = Math.Max(200, Math.Min(delay == 0 ? 900 : delay, 15000));
            await Task.Delay(delay);
            try
            {
                var directory = Path.GetDirectoryName(Path.GetFullPath(target));
                if (!Directory.Exists(directory)) Directory.CreateDirectory(directory);
                using (var stream = File.Create(target))
                    await webView.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
            }
            catch { }
        }

        private async void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs eventArgs)
        {
            Dictionary<string, object> message;
            try { message = json.DeserializeObject(eventArgs.WebMessageAsJson) as Dictionary<string, object>; }
            catch { return; }
            if (message == null) return;

            var kind = StringValue(message, "kind");
            var method = StringValue(message, "method");
            var args = ListValue(message, "args");
            if (kind == "send")
            {
                HandleSend(method, args);
                return;
            }
            if (kind != "invoke") return;

            var id = StringValue(message, "id");
            try
            {
                var result = await HandleInvokeAsync(method, args);
                Post(Map("kind", "reply", "id", id, "ok", true, "result", result));
            }
            catch (Exception error)
            {
                Post(Map("kind", "reply", "id", id, "ok", false, "error", FriendlyMessage(error)));
            }
        }

        private async Task<object> HandleInvokeAsync(string method, IList<object> args)
        {
            if (method == "desktop:ready") return await BuildBootstrapAsync();
            if (method == "desktop:hide") { HideAndReturn(); return null; }
            if (method == "desktop:toggle-pin")
            {
                pinned = !pinned;
                RebuildTrayMenu();
                return Map("pinned", pinned);
            }
            if (method == "desktop:set-auto-capture")
            {
                SetAutoCapture(BooleanArg(args, 0));
                return Map("autoCapture", autoCapture);
            }
            if (method == "desktop:set-browser-priority")
            {
                SetBrowserPriority(BooleanArg(args, 0));
                return Map("preferBrowserExtension", preferBrowserExtension);
            }
            if (method == "desktop:set-window-mode")
            {
                SetWindowMode(StringArg(args, 0));
                return Map("mode", StringArg(args, 0));
            }
            if (method == "desktop:set-busy") { busy = BooleanArg(args, 0); return null; }
            if (method == "desktop:open-external") return OpenExternal(StringArg(args, 0));
            if (method == "providers:list") return await GatewayJsonAsync("GET", "/api/providers", null);
            if (method == "providers:save") return await GatewayJsonAsync("POST", "/api/providers", Map("provider", Arg(args, 0)));
            if (method == "providers:default") return await GatewayJsonAsync("POST", "/api/providers/default", Map("providerId", StringArg(args, 0)));
            if (method == "providers:delete") return await GatewayJsonAsync("POST", "/api/providers/delete", Map("providerId", StringArg(args, 0)));
            if (method == "providers:test") return await GatewayJsonAsync("POST", "/api/providers/test", Arg(args, 0));
            throw new InvalidOperationException("Unknown SideAsk native method: " + method);
        }

        private void HandleSend(string method, IList<object> args)
        {
            if (method == "desktop:start-drag")
            {
                BeginNativeWindowDrag();
                return;
            }
            if (method == "desktop:start-resize")
            {
                BeginNativeWindowResize(StringArg(args, 0));
                return;
            }
            if (method == "chat:cancel")
            {
                var requestId = StringArg(args, 0);
                CancellationTokenSource cancellation;
                if (chats.TryGetValue(requestId, out cancellation)) cancellation.Cancel();
                return;
            }
            if (method == "chat:start")
            {
                StartChatAsync(StringArg(args, 0), Arg(args, 1));
            }
        }

        private async Task<object> BuildBootstrapAsync()
        {
            object health = null;
            object providers = Map("providers", new object[0], "defaultProviderId", null);
            string gatewayError = "";
            try { health = await GatewayJsonAsync("GET", "/health", null); }
            catch (Exception error) { gatewayError = FriendlyMessage(error); }
            try { providers = await GatewayJsonAsync("GET", "/api/providers", null); }
            catch (Exception error) { if (gatewayError.Length == 0) gatewayError = FriendlyMessage(error); }

            object catalog = new object[0];
            if (File.Exists(catalogPath)) catalog = json.DeserializeObject(File.ReadAllText(catalogPath, Encoding.UTF8));
            var capture = initialCapture;
            initialCapture = null;
            rendererReady = true;
            return Map(
                "version", VersionLabel,
                "locale", CultureInfo.CurrentUICulture.Name.StartsWith("zh", StringComparison.OrdinalIgnoreCase) ? "zh-CN" : "en",
                "shortcut", registeredShortcut,
                "pinned", pinned,
                "autoCapture", autoCapture,
                "preferBrowserExtension", preferBrowserExtension,
                "health", health,
                "gatewayError", gatewayError,
                "providers", providers,
                "catalog", catalog,
                "initialCapture", capture
            );
        }

        private async void StartChatAsync(string requestId, object payload)
        {
            if (String.IsNullOrWhiteSpace(requestId)) return;
            var cancellation = new CancellationTokenSource();
            chats[requestId] = cancellation;
            try
            {
                await EnsureGatewayAsync();
                var body = NormalizeChatPayload(payload);
                using (var request = new HttpRequestMessage(HttpMethod.Post, GatewayUrl("/api/chat")))
                {
                    request.Content = new StringContent(json.Serialize(body), Encoding.UTF8, "application/json");
                    using (var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellation.Token))
                    {
                        if (!response.IsSuccessStatusCode)
                        {
                            var failure = await response.Content.ReadAsStringAsync();
                            throw new InvalidOperationException(ExtractGatewayError(failure, (int)response.StatusCode));
                        }
                        using (var stream = await response.Content.ReadAsStreamAsync())
                        using (var reader = new StreamReader(stream, Encoding.UTF8))
                        {
                            var buffer = new char[256];
                            int received = 0;
                            while (true)
                            {
                                int count = await reader.ReadAsync(buffer, 0, buffer.Length);
                                if (count <= 0) break;
                                received += count;
                                PostEvent("chat:event", Map("requestId", requestId, "type", "delta", "text", new String(buffer, 0, count)));
                            }
                            if (received == 0) throw new InvalidOperationException("Provider returned an empty response.");
                        }
                    }
                }
                PostEvent("chat:event", Map("requestId", requestId, "type", "done"));
            }
            catch (OperationCanceledException)
            {
                PostEvent("chat:event", Map("requestId", requestId, "type", "cancelled"));
            }
            catch (Exception error)
            {
                PostEvent("chat:event", Map("requestId", requestId, "type", "error", "message", FriendlyMessage(error)));
            }
            finally
            {
                chats.Remove(requestId);
                cancellation.Dispose();
            }
        }

        private object NormalizeChatPayload(object raw)
        {
            var source = raw as Dictionary<string, object>;
            if (source == null) source = new Dictionary<string, object>();
            var normalizedMessages = new List<object>();
            object rawMessages;
            if (source.TryGetValue("messages", out rawMessages))
            {
                var list = AsList(rawMessages);
                var start = Math.Max(0, list.Count - 12);
                for (var index = start; index < list.Count; index++)
                {
                    var message = list[index] as Dictionary<string, object>;
                    if (message == null) continue;
                    var content = CleanText(StringValue(message, "content"), 6000);
                    if (content.Length == 0) continue;
                    normalizedMessages.Add(Map(
                        "role", StringValue(message, "role") == "assistant" ? "assistant" : "user",
                        "content", content
                    ));
                }
            }
            var locale = StringValue(source, "locale").StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "zh-CN";
            return Map(
                "selection", CleanText(StringValue(source, "selection"), 12000),
                "context", "",
                "sourceTitle", CleanText(StringValue(source, "sourceTitle"), 300, "Desktop selection"),
                "sourceUrl", "",
                "locale", locale,
                "messages", normalizedMessages.ToArray()
            );
        }

        private async Task<object> GatewayJsonAsync(string method, string path, object body)
        {
            await EnsureGatewayAsync();
            using (var request = new HttpRequestMessage(new HttpMethod(method), GatewayUrl(path)))
            {
                if (body != null) request.Content = new StringContent(json.Serialize(body), Encoding.UTF8, "application/json");
                using (var cancellation = new CancellationTokenSource(20000))
                using (var response = await http.SendAsync(request, cancellation.Token))
                {
                    var text = await response.Content.ReadAsStringAsync();
                    if (!response.IsSuccessStatusCode)
                        throw new InvalidOperationException(ExtractGatewayError(text, (int)response.StatusCode));
                    return String.IsNullOrWhiteSpace(text) ? new Dictionary<string, object>() : json.DeserializeObject(text);
                }
            }
        }

        private async Task EnsureGatewayAsync()
        {
            if (await ProbeGatewayAsync()) return;
            await gatewayLock.WaitAsync();
            try
            {
                if (await ProbeGatewayAsync()) return;
                if (await ProbeGatewayHealthAsync()) throw new InvalidOperationException(GatewayCompatibilityMessage());
                if (gatewayProcess == null || gatewayProcess.HasExited) StartGateway();
                for (var attempt = 0; attempt < 45; attempt++)
                {
                    if (await ProbeGatewayAsync()) return;
                    await Task.Delay(100);
                }
                throw new InvalidOperationException("SideAsk Local Gateway did not start in time.");
            }
            finally { gatewayLock.Release(); }
        }

        private async Task<bool> ProbeGatewayAsync()
        {
            if (!await ProbeGatewayEndpointAsync("/health")) return false;
            return await ProbeGatewayEndpointAsync("/api/providers");
        }

        private async Task<bool> ProbeGatewayHealthAsync()
        {
            return await ProbeGatewayEndpointAsync("/health");
        }

        private async Task<bool> ProbeGatewayEndpointAsync(string path)
        {
            try
            {
                using (var cancellation = new CancellationTokenSource(700))
                using (var response = await http.GetAsync(GatewayUrl(path), cancellation.Token))
                    return response.IsSuccessStatusCode;
            }
            catch { return false; }
        }

        private static string GatewayCompatibilityMessage()
        {
            var chinese = CultureInfo.CurrentUICulture.Name.StartsWith("zh", StringComparison.OrdinalIgnoreCase);
            return chinese
                ? "127.0.0.1:8787 正在运行旧版 SideAsk Gateway，缺少共享 Provider 接口。请退出旧 Gateway 后重新打开 SideAsk。"
                : "An older SideAsk Gateway is already running on 127.0.0.1:8787 and does not provide the shared Provider API. Quit the old Gateway, then reopen SideAsk.";
        }

        private void StartGateway()
        {
            var bundledNode = Path.Combine(baseDirectory, "runtime", "node", "node.exe");
            var node = File.Exists(bundledNode) ? bundledNode : "node.exe";
            var entry = Path.Combine(baseDirectory, "runtime", "server", "server.mjs");
            if (!File.Exists(entry)) throw new FileNotFoundException("SideAsk desktop runtime is incomplete.", entry);
            var start = new ProcessStartInfo();
            start.FileName = node;
            start.Arguments = Quote(entry);
            start.WorkingDirectory = Path.Combine(baseDirectory, "runtime");
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.WindowStyle = ProcessWindowStyle.Hidden;
            start.EnvironmentVariables["PORT"] = gatewayUri.Port.ToString(CultureInfo.InvariantCulture);
            gatewayProcess = Process.Start(start);
        }

        private Uri GatewayUrl(string path)
        {
            return new Uri(gatewayUri, path);
        }

        private static string ExtractGatewayError(string text, int status)
        {
            try
            {
                var serializer = new JavaScriptSerializer();
                var payload = serializer.DeserializeObject(text) as Dictionary<string, object>;
                object errorObject;
                if (payload != null && payload.TryGetValue("error", out errorObject))
                {
                    var error = errorObject as Dictionary<string, object>;
                    if (error != null)
                    {
                        var message = StringValue(error, "message");
                        if (message.Length > 0) return message;
                    }
                }
            }
            catch { }
            return "SideAsk Gateway request failed (HTTP " + status.ToString(CultureInfo.InvariantCulture) + ").";
        }

        private void RegisterShortcut()
        {
            if (RegisterHotKey(windowHandle, HotkeyId, ModAlt | ModShift, KeyA))
                registeredShortcut = "Alt+Shift+A";
            else if (RegisterHotKey(windowHandle, HotkeyId, ModControl | ModShift, KeySpace))
                registeredShortcut = "Ctrl+Shift+Space";
        }

        private IntPtr WindowProcedure(IntPtr handle, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (message == WmHotkey && wParam.ToInt32() == HotkeyId)
            {
                DebugLog("hotkey received");
                handled = true;
                if (IsVisible && IsActive) Hide();
                else CaptureSelectionFromHotkey();
            }
            else if (message == WmEnterSizeMove)
            {
                PostEvent("desktop:state", Map("resizing", true));
            }
            else if (message == WmExitSizeMove)
            {
                PostEvent("desktop:state", Map("resizing", false));
            }
            return IntPtr.Zero;
        }

        private async void CaptureSelectionFromHotkey()
        {
            await CaptureSelectionAsync(false, false);
        }

        private async Task CaptureSelectionAsync(bool requireSelection, bool cueOnly)
        {
            if (Interlocked.Exchange(ref captureInProgress, 1) != 0) return;
            DebugLog("capture started");
            try
            {
                previousForeground = GetForegroundWindow();
                var sourceTitle = ForegroundTitle(previousForeground);
                var clipboardSequence = GetClipboardSequenceNumber();
                try
                {
                    await Task.Delay(90);
                    Forms.SendKeys.SendWait("^c");
                    await Task.Delay(190);
                }
                catch { }
                var selected = GetClipboardSequenceNumber() != clipboardSequence ? CleanText(ReadClipboard(), 12000) : "";
                DebugLog("capture text length=" + selected.Length.ToString(CultureInfo.InvariantCulture));
                if (requireSelection && selected.Length == 0) return;
                var capture = Map(
                    "text", selected,
                    "sourceTitle", sourceTitle.Length == 0 ? "Windows selection" : sourceTitle,
                    "autoAsk", selected.Length > 0
                );
                if (cueOnly) ShowExplainCue(capture);
                else ShowCapture(capture);
            }
            finally { Interlocked.Exchange(ref captureInProgress, 0); }
        }

        private Popup CreateExplainCue()
        {
            var chinese = CultureInfo.CurrentUICulture.Name.StartsWith("zh", StringComparison.OrdinalIgnoreCase);
            var spark = new TextBlock
            {
                Text = "✦",
                Foreground = new SolidColorBrush(Color.FromRgb(158, 148, 255)),
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                VerticalAlignment = VerticalAlignment.Center
            };
            var label = new TextBlock
            {
                Text = chinese ? "解释" : "Explain",
                Margin = new Thickness(7, 0, 0, 0),
                Foreground = Brushes.White,
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                VerticalAlignment = VerticalAlignment.Center
            };
            var content = new StackPanel { Orientation = Orientation.Horizontal };
            content.Children.Add(spark);
            content.Children.Add(label);
            var pill = new Border
            {
                Background = CueBrush(false),
                BorderBrush = new SolidColorBrush(Color.FromArgb(34, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(11),
                Padding = new Thickness(12, 7, 13, 7),
                Child = content,
                Cursor = Cursors.Hand,
                RenderTransformOrigin = new Point(0.5, 0.5),
                Effect = new System.Windows.Media.Effects.DropShadowEffect
                {
                    Color = Color.FromRgb(0, 0, 0),
                    BlurRadius = 22,
                    ShadowDepth = 7,
                    Opacity = 0.3
                }
            };
            var shadowHost = new Grid
            {
                Background = Brushes.Transparent,
                Margin = new Thickness(13)
            };
            shadowHost.Children.Add(pill);
            explainCueSurface = pill;
            pill.MouseEnter += delegate
            {
                pill.Background = CueBrush(true);
                pill.BorderBrush = new SolidColorBrush(Color.FromArgb(52, 255, 255, 255));
            };
            pill.MouseLeave += delegate
            {
                pill.Background = CueBrush(false);
                pill.BorderBrush = new SolidColorBrush(Color.FromArgb(34, 255, 255, 255));
                pill.RenderTransform = new ScaleTransform(1, 1);
            };
            pill.PreviewMouseLeftButtonDown += delegate { pill.RenderTransform = new ScaleTransform(0.96, 0.96); };
            pill.PreviewMouseLeftButtonUp += delegate
            {
                pill.RenderTransform = new ScaleTransform(1, 1);
                AcceptExplainCue();
            };
            var popup = new Popup
            {
                AllowsTransparency = true,
                StaysOpen = false,
                Placement = PlacementMode.AbsolutePoint,
                PopupAnimation = PopupAnimation.Fade,
                Child = shadowHost
            };
            popup.Closed += delegate { pendingAutomaticCapture = null; };
            return popup;
        }

        private static Brush CueBrush(bool hover)
        {
            return hover
                ? new SolidColorBrush(Color.FromRgb(39, 39, 47))
                : new SolidColorBrush(Color.FromRgb(23, 23, 27));
        }

        private object pendingAutomaticCapture;

        private void ShowExplainCue(object capture)
        {
            if (explainCue != null) explainCue.IsOpen = false;
            pendingAutomaticCapture = capture;
            var cursor = Forms.Cursor.Position;
            var dpi = windowHandle == IntPtr.Zero ? 96U : GetDpiForWindow(windowHandle);
            if (dpi == 0) dpi = 96;
            var scale = dpi / 96.0;
            explainCue.HorizontalOffset = (cursor.X + 12) / scale;
            explainCue.VerticalOffset = (cursor.Y + 12) / scale;
            explainCue.IsOpen = true;
            AnimateExplainCue();
            DebugLog("selection explain cue shown");
        }

        private void AnimateExplainCue()
        {
            if (explainCueSurface == null) return;
            var duration = new Duration(TimeSpan.FromMilliseconds(180));
            explainCueSurface.Opacity = 0;
            var scale = new ScaleTransform(0.86, 0.86);
            explainCueSurface.RenderTransform = scale;
            var easing = new CubicEase { EasingMode = EasingMode.EaseOut };
            explainCueSurface.BeginAnimation(UIElement.OpacityProperty, new DoubleAnimation(0, 1, duration) { EasingFunction = easing });
            scale.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(0.86, 1, duration) { EasingFunction = easing });
            scale.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(0.86, 1, duration) { EasingFunction = easing });
        }

        private void SetWindowMode(string mode)
        {
            var expanded = String.Equals(mode, "expanded", StringComparison.OrdinalIgnoreCase);
            var targetWidth = expanded ? ExpandedWindowWidth : CompactWindowWidth;
            var targetHeight = expanded ? ExpandedWindowHeight : CompactWindowHeight;
            if (Math.Abs(ActualWidth - targetWidth) < 1 && Math.Abs(ActualHeight - targetHeight) < 1) return;

            var animationVersion = ++windowModeAnimationVersion;
            BeginAnimation(WidthProperty, null);
            BeginAnimation(HeightProperty, null);
            BeginAnimation(LeftProperty, null);
            BeginAnimation(TopProperty, null);

            var cursor = Forms.Cursor.Position;
            var work = Forms.Screen.FromPoint(cursor).WorkingArea;
            var dpi = windowHandle == IntPtr.Zero ? 96U : GetDpiForWindow(windowHandle);
            if (dpi == 0) dpi = 96;
            var scale = dpi / 96.0;
            var workLeft = work.Left / scale;
            var workTop = work.Top / scale;
            var workRight = work.Right / scale;
            var workBottom = work.Bottom / scale;
            var targetLeft = Math.Min(Math.Max(Left, workLeft + 12), Math.Max(workLeft + 12, workRight - targetWidth - 12));
            var targetTop = Math.Min(Math.Max(Top, workTop + 12), Math.Max(workTop + 12, workBottom - targetHeight - 12));
            var duration = new Duration(TimeSpan.FromMilliseconds(expanded ? 240 : 210));
            var easing = new CubicEase { EasingMode = EasingMode.EaseOut };

            var widthAnimation = new DoubleAnimation(ActualWidth, targetWidth, duration) { EasingFunction = easing, FillBehavior = FillBehavior.Stop };
            var heightAnimation = new DoubleAnimation(ActualHeight, targetHeight, duration) { EasingFunction = easing, FillBehavior = FillBehavior.Stop };
            var leftAnimation = new DoubleAnimation(Left, targetLeft, duration) { EasingFunction = easing, FillBehavior = FillBehavior.Stop };
            var topAnimation = new DoubleAnimation(Top, targetTop, duration) { EasingFunction = easing, FillBehavior = FillBehavior.Stop };
            heightAnimation.Completed += delegate
            {
                if (animationVersion != windowModeAnimationVersion) return;
                Width = targetWidth;
                Height = targetHeight;
                Left = targetLeft;
                Top = targetTop;
            };
            BeginAnimation(WidthProperty, widthAnimation, HandoffBehavior.SnapshotAndReplace);
            BeginAnimation(HeightProperty, heightAnimation, HandoffBehavior.SnapshotAndReplace);
            BeginAnimation(LeftProperty, leftAnimation, HandoffBehavior.SnapshotAndReplace);
            BeginAnimation(TopProperty, topAnimation, HandoffBehavior.SnapshotAndReplace);
        }

        private void BeginNativeWindowDrag()
        {
            if (windowHandle == IntPtr.Zero) return;
            try
            {
                ReleaseCapture();
                PostMessage(windowHandle, WmNcLeftButtonDown, new IntPtr(HtCaption), IntPtr.Zero);
            }
            catch (Exception error) { DebugLog("window drag failed: " + FriendlyMessage(error)); }
        }

        private void BeginNativeWindowResize(string edge)
        {
            if (windowHandle == IntPtr.Zero) return;
            var hitTest = 0;
            switch ((edge ?? "").Trim().ToLowerInvariant())
            {
                case "left": hitTest = HtLeft; break;
                case "right": hitTest = HtRight; break;
                case "top": hitTest = HtTop; break;
                case "top-left": hitTest = HtTopLeft; break;
                case "top-right": hitTest = HtTopRight; break;
                case "bottom": hitTest = HtBottom; break;
                case "bottom-left": hitTest = HtBottomLeft; break;
                case "bottom-right": hitTest = HtBottomRight; break;
                default: return;
            }
            try
            {
                ReleaseCapture();
                PostMessage(windowHandle, WmNcLeftButtonDown, new IntPtr(hitTest), IntPtr.Zero);
            }
            catch (Exception error) { DebugLog("window resize failed: " + FriendlyMessage(error)); }
        }

        private void AcceptExplainCue()
        {
            var capture = pendingAutomaticCapture;
            DismissExplainCue("clicked");
            if (capture != null) ShowCapture(capture);
        }

        private void DismissExplainCue(string reason)
        {
            var wasVisible = explainCue != null && explainCue.IsOpen;
            if (explainCue != null) explainCue.IsOpen = false;
            pendingAutomaticCapture = null;
            if (wasVisible) DebugLog("selection explain cue dismissed: " + reason);
        }

        private async void RunSelectionCueSelfTestIfRequested()
        {
            var text = CleanText(Environment.GetEnvironmentVariable("SIDEASK_DEBUG_SELECTION_CUE_TEXT"), 12000);
            if (text.Length == 0) return;
            await Task.Delay(700);
            ShowExplainCue(Map("text", text, "sourceTitle", "SideAsk selection cue test", "autoAsk", true));
            await Task.Delay(900);
            AcceptExplainCue();
        }

        private void ShowCapture(object capture)
        {
            DismissExplainCue("capture opened");
            PositionNearCursor();
            RevealWindow(1200);
            if (rendererReady) PostEvent("selection:capture", capture);
            else initialCapture = capture;
        }

        private bool LoadBooleanSetting(string key, bool fallback)
        {
            try
            {
                if (!File.Exists(settingsPath)) return fallback;
                var settings = json.DeserializeObject(File.ReadAllText(settingsPath, Encoding.UTF8)) as Dictionary<string, object>;
                object value;
                return settings != null && settings.TryGetValue(key, out value)
                    ? Convert.ToBoolean(value, CultureInfo.InvariantCulture)
                    : fallback;
            }
            catch { return fallback; }
        }

        private void SaveSettings()
        {
            try
            {
                var directory = Path.GetDirectoryName(settingsPath);
                if (!String.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
                File.WriteAllText(
                    settingsPath,
                    json.Serialize(Map(
                        "autoCapture", autoCapture,
                        "preferBrowserExtension", preferBrowserExtension
                    )),
                    new UTF8Encoding(false)
                );
            }
            catch (Exception error) { DebugLog("settings save failed: " + FriendlyMessage(error)); }
        }

        private void SetAutoCapture(bool enabled)
        {
            if (enabled == autoCapture) return;
            if (enabled && !InstallAutoCaptureHook()) enabled = false;
            if (!enabled)
            {
                UninstallAutoCaptureHook();
                DismissExplainCue("automatic selection disabled");
            }
            autoCapture = enabled;
            SaveSettings();
            RebuildTrayMenu();
            PostEvent("desktop:state", Map(
                "pinned", pinned,
                "autoCapture", autoCapture,
                "preferBrowserExtension", preferBrowserExtension
            ));
            DebugLog("automatic selection=" + (autoCapture ? "on" : "off"));
        }

        private void SetBrowserPriority(bool enabled)
        {
            if (enabled == preferBrowserExtension) return;
            preferBrowserExtension = enabled;
            if (enabled && ShouldDeferAutomaticCaptureToBrowser(GetForegroundWindow()))
                DismissExplainCue("browser extension priority enabled");
            SaveSettings();
            PostEvent("desktop:state", Map(
                "pinned", pinned,
                "autoCapture", autoCapture,
                "preferBrowserExtension", preferBrowserExtension
            ));
            DebugLog("browser extension priority=" + (preferBrowserExtension ? "on" : "off"));
        }

        private bool InstallAutoCaptureHook()
        {
            if (selectionTimer != null) return true;
            selectionTimer = new System.Windows.Threading.DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(30)
            };
            leftMouseDown = (GetAsyncKeyState(VirtualKeyLeftMouse) & 0x8000) != 0;
            escapeKeyDown = (GetAsyncKeyState(VirtualKeyEscape) & 0x8000) != 0;
            selectionTimer.Tick += PollMouseSelection;
            selectionTimer.Start();
            DebugLog("mouse selection monitor started");
            return true;
        }

        private void UninstallAutoCaptureHook()
        {
            if (selectionTimer != null)
            {
                selectionTimer.Stop();
                selectionTimer.Tick -= PollMouseSelection;
                selectionTimer = null;
            }
            leftMouseDown = false;
            escapeKeyDown = false;
            Interlocked.Exchange(ref autoCaptureScheduled, 0);
        }

        private void PollMouseSelection(object sender, EventArgs eventArgs)
        {
            if (!autoCapture) return;
            var isDown = (GetAsyncKeyState(VirtualKeyLeftMouse) & 0x8000) != 0;
            var isEscapeDown = (GetAsyncKeyState(VirtualKeyEscape) & 0x8000) != 0;
            if (!selectionMonitorObserved)
            {
                selectionMonitorObserved = true;
                DebugLog("mouse selection monitor polling");
            }
            var cursor = Forms.Cursor.Position;
            var point = new NativePoint { X = cursor.X, Y = cursor.Y };
            if (explainCue != null && explainCue.IsOpen)
            {
                var pointerOutsideCue = explainCueSurface == null || !explainCueSurface.IsMouseOver;
                var foreground = GetForegroundWindow();
                var sourceRoot = previousForeground == IntPtr.Zero ? IntPtr.Zero : GetAncestor(previousForeground, GaRoot);
                var foregroundRoot = foreground == IntPtr.Zero ? IntPtr.Zero : GetAncestor(foreground, GaRoot);
                var foregroundChanged = sourceRoot != IntPtr.Zero && foregroundRoot != IntPtr.Zero && sourceRoot != foregroundRoot;
                if (isEscapeDown && !escapeKeyDown) DismissExplainCue("escape pressed");
                else if (isDown && !leftMouseDown && pointerOutsideCue) DismissExplainCue("clicked elsewhere");
                else if (pointerOutsideCue && foregroundChanged) DismissExplainCue("foreground changed");
            }
            if (isDown && !leftMouseDown)
            {
                mouseDownPoint = point;
                DebugLog("mouse selection down");
            }
            else if (!isDown && leftMouseDown)
            {
                var now = unchecked((uint)Environment.TickCount);
                var dragged = DistanceSquared(mouseDownPoint, point) >= 25;
                var elapsed = unchecked(now - lastMouseUpTime);
                var doubleClicked = lastMouseUpTime != 0 && elapsed <= GetDoubleClickTime() && DistanceSquared(lastMouseUpPoint, point) <= 36;
                lastMouseUpPoint = point;
                lastMouseUpTime = now;
                DebugLog("mouse selection up dragged=" + dragged + " double=" + doubleClicked);
                if ((dragged || doubleClicked) && !IsSideAskForeground()) ScheduleAutomaticCapture();
            }
            leftMouseDown = isDown;
            escapeKeyDown = isEscapeDown;
        }

        private void ScheduleAutomaticCapture()
        {
            if (!autoCapture || IsSideAskForeground() || Interlocked.Exchange(ref autoCaptureScheduled, 1) != 0) return;
            var foreground = GetForegroundWindow();
            if (ShouldDeferAutomaticCaptureToBrowser(foreground))
            {
                Interlocked.Exchange(ref autoCaptureScheduled, 0);
                DebugLog("automatic selection deferred to browser extension");
                return;
            }
            DebugLog("automatic selection scheduled");
            AutomaticCaptureAsync();
        }

        private async void AutomaticCaptureAsync()
        {
            try
            {
                await Task.Delay(140);
                var foreground = GetForegroundWindow();
                if (autoCapture && !IsSideAskForeground() && !ShouldDeferAutomaticCaptureToBrowser(foreground))
                    await CaptureAccessibleSelectionAsync();
            }
            finally { Interlocked.Exchange(ref autoCaptureScheduled, 0); }
        }

        private async Task CaptureAccessibleSelectionAsync()
        {
            if (Interlocked.Exchange(ref captureInProgress, 1) != 0) return;
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero || IsSideAskForeground()) return;
                if (ShouldDeferAutomaticCaptureToBrowser(foreground))
                {
                    DebugLog("accessibility selection deferred to browser extension");
                    return;
                }
                var sourceTitle = ForegroundTitle(foreground);
                DebugLog("accessibility selection check started");
                var selectionTask = Task.Run(delegate { return ReadAccessibleSelection(foreground); });
                var finished = await Task.WhenAny(selectionTask, Task.Delay(450));
                if (finished != selectionTask)
                {
                    DebugLog("accessibility selection check timed out");
                    return;
                }
                var result = await selectionTask;
                if (!result.Supported)
                {
                    DebugLog("accessibility text selection unsupported; automatic clipboard fallback skipped");
                    return;
                }
                var currentForeground = GetForegroundWindow();
                if (currentForeground == IntPtr.Zero || GetAncestor(currentForeground, GaRoot) != GetAncestor(foreground, GaRoot))
                {
                    DebugLog("accessibility selection foreground changed");
                    return;
                }
                if (result.Text.Length == 0)
                {
                    DebugLog("accessibility selection is empty");
                    return;
                }
                previousForeground = foreground;
                DebugLog("accessibility selection length=" + result.Text.Length.ToString(CultureInfo.InvariantCulture));
                ShowExplainCue(Map(
                    "text", result.Text,
                    "sourceTitle", sourceTitle.Length == 0 ? "Windows selection" : sourceTitle,
                    "autoAsk", true
                ));
            }
            finally { Interlocked.Exchange(ref captureInProgress, 0); }
        }

        private static AccessibleSelection ReadAccessibleSelection(IntPtr foreground)
        {
            try
            {
                var root = AutomationElement.FromHandle(foreground);
                var focused = AutomationElement.FocusedElement;
                if (root == null || focused == null || !IsAutomationDescendant(focused, root))
                    return new AccessibleSelection(false, "");

                var current = focused;
                for (var depth = 0; current != null && depth < 12; depth++)
                {
                    object patternObject;
                    if (current.TryGetCurrentPattern(TextPattern.Pattern, out patternObject))
                    {
                        var pattern = patternObject as TextPattern;
                        var builder = new StringBuilder();
                        var ranges = pattern == null ? null : pattern.GetSelection();
                        if (ranges != null)
                        {
                            foreach (var range in ranges)
                            {
                                if (range == null || builder.Length >= 12000) continue;
                                var value = range.GetText(12000 - builder.Length);
                                if (String.IsNullOrWhiteSpace(value)) continue;
                                if (builder.Length > 0) builder.AppendLine();
                                builder.Append(value);
                            }
                        }
                        return new AccessibleSelection(true, CleanText(builder.ToString(), 12000));
                    }
                    if (Automation.Compare(current, root)) break;
                    current = TreeWalker.ControlViewWalker.GetParent(current);
                }
                return new AccessibleSelection(false, "");
            }
            catch (ElementNotAvailableException) { return new AccessibleSelection(false, ""); }
            catch (InvalidOperationException) { return new AccessibleSelection(false, ""); }
            catch (COMException) { return new AccessibleSelection(false, ""); }
        }

        private static bool IsAutomationDescendant(AutomationElement element, AutomationElement root)
        {
            var current = element;
            for (var depth = 0; current != null && depth < 40; depth++)
            {
                if (Automation.Compare(current, root)) return true;
                current = TreeWalker.RawViewWalker.GetParent(current);
            }
            return false;
        }

        private bool IsSideAskForeground()
        {
            var foreground = GetForegroundWindow();
            return foreground != IntPtr.Zero && windowHandle != IntPtr.Zero && GetAncestor(foreground, GaRoot) == GetAncestor(windowHandle, GaRoot);
        }

        private bool ShouldDeferAutomaticCaptureToBrowser(IntPtr handle)
        {
            if (!preferBrowserExtension || handle == IntPtr.Zero) return false;
            var root = GetAncestor(handle, GaRoot);
            uint processId;
            GetWindowThreadProcessId(root == IntPtr.Zero ? handle : root, out processId);
            if (processId == 0) return false;
            try
            {
                using (var process = Process.GetProcessById(unchecked((int)processId)))
                {
                    return IsBrowserProcessName(process.ProcessName);
                }
            }
            catch (ArgumentException) { }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }
            return false;
        }

        private static bool IsBrowserProcessName(string processName)
        {
            switch ((processName ?? "").Trim().ToLowerInvariant())
            {
                case "chrome":
                case "msedge":
                case "firefox":
                case "brave":
                case "opera":
                case "opera_gx":
                case "vivaldi":
                case "arc":
                case "thorium":
                case "waterfox":
                case "librewolf":
                case "floorp":
                case "iexplore":
                    return true;
                default:
                    return false;
            }
        }

        private static long DistanceSquared(NativePoint first, NativePoint second)
        {
            var x = (long)first.X - second.X;
            var y = (long)first.Y - second.Y;
            return x * x + y * y;
        }

        private static string ReadClipboard()
        {
            try { return Clipboard.ContainsText() ? Clipboard.GetText() : ""; }
            catch { return ""; }
        }

        private void PositionNearCursor()
        {
            var cursor = Forms.Cursor.Position;
            var work = Forms.Screen.FromPoint(cursor).WorkingArea;
            var dpi = windowHandle == IntPtr.Zero ? 96U : GetDpiForWindow(windowHandle);
            if (dpi == 0) dpi = 96;
            var scale = dpi / 96.0;
            var pixelWidth = Width * scale;
            var pixelHeight = Height * scale;
            var x = Math.Min(Math.Max(cursor.X + 18, work.Left + 12), Math.Max(work.Left + 12, work.Right - pixelWidth - 12));
            var y = Math.Min(Math.Max(cursor.Y + 18, work.Top + 12), Math.Max(work.Top + 12, work.Bottom - pixelHeight - 12));
            Left = x / scale;
            Top = y / scale;
        }

        internal void ShowFromTray()
        {
            PositionNearCursor();
            RevealWindow(5000);
        }

        private void RevealWindow(int autoHideGraceMilliseconds)
        {
            autoHideAllowedAfter = DateTime.UtcNow.AddMilliseconds(Math.Max(0, autoHideGraceMilliseconds));
            if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
            Show();
            Activate();
            if (windowHandle != IntPtr.Zero) SetForegroundWindow(windowHandle);
        }

        private void HideAndReturn()
        {
            Hide();
            if (previousForeground != IntPtr.Zero) SetForegroundWindow(previousForeground);
        }

        private void OnDeactivated(object sender, EventArgs eventArgs)
        {
            if (!rendererReady || pinned || busy || DateTime.UtcNow < autoHideAllowedAfter) return;
            var timer = new System.Windows.Threading.DispatcherTimer();
            timer.Interval = TimeSpan.FromMilliseconds(180);
            timer.Tick += delegate
            {
                timer.Stop();
                if (!IsActive && !pinned && !busy && DateTime.UtcNow >= autoHideAllowedAfter) Hide();
            };
            timer.Start();
        }

        private void CreateTray()
        {
            var iconPath = Path.Combine(baseDirectory, "assets", "sideask.ico");
            tray = new Forms.NotifyIcon();
            if (File.Exists(iconPath)) tray.Icon = new Drawing.Icon(iconPath);
            tray.Text = "SideAsk — Ask aside. Stay on track.";
            tray.Visible = true;
            tray.MouseClick += delegate(object sender, Forms.MouseEventArgs args)
            {
                if (args.Button != Forms.MouseButtons.Left) return;
                Dispatcher.BeginInvoke(new Action(delegate { if (IsVisible && IsActive) Hide(); else ShowFromTray(); }));
            };
            RebuildTrayMenu();
        }

        private void RebuildTrayMenu()
        {
            if (tray == null) return;
            var menu = new Forms.ContextMenuStrip();
            menu.Items.Add("Open SideAsk", null, delegate { Dispatcher.BeginInvoke(new Action(ShowFromTray)); });
            menu.Items.Add(pinned ? "Unpin window" : "Keep window open", null, delegate
            {
                pinned = !pinned;
                PostEvent("desktop:state", Map("pinned", pinned));
                RebuildTrayMenu();
            });
            var chinese = CultureInfo.CurrentUICulture.Name.StartsWith("zh", StringComparison.OrdinalIgnoreCase);
            var selectionMenu = chinese
                ? (autoCapture ? "划词解释按钮：已开启" : "划词解释按钮：已关闭")
                : (autoCapture ? "Show Explain after selection: On" : "Show Explain after selection: Off");
            menu.Items.Add(selectionMenu, null, delegate
            {
                Dispatcher.BeginInvoke(new Action(delegate { SetAutoCapture(!autoCapture); }));
            });
            menu.Items.Add(new Forms.ToolStripSeparator());
            menu.Items.Add("Quit SideAsk", null, delegate { Dispatcher.BeginInvoke(new Action(QuitApplication)); });
            var old = tray.ContextMenuStrip;
            tray.ContextMenuStrip = menu;
            if (old != null) old.Dispose();
        }

        private bool OpenExternal(string value)
        {
            Uri uri;
            if (!Uri.TryCreate(value, UriKind.Absolute, out uri) || !(uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)) return false;
            try
            {
                Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
                return true;
            }
            catch { return false; }
        }

        private void PostEvent(string name, object payload)
        {
            Post(Map("kind", "event", "name", name, "payload", payload));
        }

        private void Post(object payload)
        {
            if (webView.CoreWebView2 == null) return;
            var serialized = json.Serialize(payload);
            if (!Dispatcher.CheckAccess())
            {
                Dispatcher.BeginInvoke(new Action(delegate { if (webView.CoreWebView2 != null) webView.CoreWebView2.PostWebMessageAsJson(serialized); }));
                return;
            }
            webView.CoreWebView2.PostWebMessageAsJson(serialized);
        }

        private void OnClosing(object sender, System.ComponentModel.CancelEventArgs eventArgs)
        {
            if (quitting) return;
            eventArgs.Cancel = true;
            Hide();
        }

        private void QuitApplication()
        {
            quitting = true;
            Close();
            Application.Current.Shutdown();
        }

        private void OnClosed(object sender, EventArgs eventArgs)
        {
            DismissExplainCue("application closed");
            UninstallAutoCaptureHook();
            if (windowHandle != IntPtr.Zero) UnregisterHotKey(windowHandle, HotkeyId);
            if (hwndSource != null) hwndSource.RemoveHook(WindowProcedure);
            foreach (var cancellation in chats.Values) cancellation.Cancel();
            if (gatewayProcess != null)
            {
                try { if (!gatewayProcess.HasExited) gatewayProcess.Kill(); }
                catch { }
                gatewayProcess.Dispose();
            }
            if (tray != null)
            {
                tray.Visible = false;
                tray.Dispose();
            }
            http.Dispose();
            gatewayLock.Dispose();
        }

        private static object Map(params object[] values)
        {
            var map = new Dictionary<string, object>();
            for (var index = 0; index + 1 < values.Length; index += 2) map[Convert.ToString(values[index], CultureInfo.InvariantCulture)] = values[index + 1];
            return map;
        }

        private static object Arg(IList<object> args, int index)
        {
            return args != null && index >= 0 && index < args.Count ? args[index] : null;
        }

        private static string StringArg(IList<object> args, int index)
        {
            return Convert.ToString(Arg(args, index), CultureInfo.InvariantCulture) ?? "";
        }

        private static bool BooleanArg(IList<object> args, int index)
        {
            var value = Arg(args, index);
            return value is bool && (bool)value;
        }

        private static IList<object> ListValue(Dictionary<string, object> map, string key)
        {
            object value;
            return map.TryGetValue(key, out value) ? AsList(value) : new List<object>();
        }

        private static IList<object> AsList(object value)
        {
            var objectArray = value as object[];
            if (objectArray != null) return objectArray;
            var arrayList = value as ArrayList;
            if (arrayList != null)
            {
                var result = new List<object>();
                foreach (var item in arrayList) result.Add(item);
                return result;
            }
            var typed = value as IList<object>;
            return typed ?? new List<object>();
        }

        private static string StringValue(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value, CultureInfo.InvariantCulture) ?? "" : "";
        }

        private static string CleanText(string value, int limit, string fallback = "")
        {
            var normalized = (value ?? "").Replace("\0", "").Replace("\r\n", "\n").Replace("\r", "\n").Trim();
            if (normalized.Length == 0) normalized = fallback;
            return normalized.Length <= limit ? normalized : normalized.Substring(0, Math.Max(0, limit - 1)) + "…";
        }

        private static string FriendlyMessage(Exception error)
        {
            while (error is AggregateException && error.InnerException != null) error = error.InnerException;
            return String.IsNullOrWhiteSpace(error.Message) ? "SideAsk request failed." : error.Message;
        }

        private static string ForegroundTitle(IntPtr handle)
        {
            var length = GetWindowTextLength(handle);
            if (length <= 0) return "";
            var buffer = new StringBuilder(length + 1);
            GetWindowText(handle, buffer, buffer.Capacity);
            return CleanText(buffer.ToString(), 300);
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private static void DebugLog(string value)
        {
            var file = Environment.GetEnvironmentVariable("SIDEASK_DEBUG_LOG");
            if (String.IsNullOrWhiteSpace(file)) return;
            try { File.AppendAllText(file, DateTime.UtcNow.ToString("O") + " " + value + Environment.NewLine, Encoding.UTF8); }
            catch { }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct NativePoint
        {
            internal int X;
            internal int Y;
        }

        private sealed class AccessibleSelection
        {
            internal readonly bool Supported;
            internal readonly string Text;

            internal AccessibleSelection(bool supported, string text)
            {
                Supported = supported;
                Text = text ?? "";
            }
        }

        [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool UnregisterHotKey(IntPtr window, int id);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
        [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr window);
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern uint GetClipboardSequenceNumber();
        [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
        [DllImport("user32.dll")] private static extern uint GetDoubleClickTime();
        [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);
        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);
    }
}
