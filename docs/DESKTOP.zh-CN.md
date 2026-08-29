# SideAsk 桌面悬浮窗

[简体中文](DESKTOP.zh-CN.md) · [English](DESKTOP.md)

SideAsk Desktop 是 Windows 上的轻量入口，专门覆盖浏览器插件够不到的地方：VS Code、PDF、桌面软件、终端和普通文本。它浮在当前应用上方，不会再给 VS Code 新开一栏，也不会污染 Codex 等主对话。

## 使用 SideAsk Anywhere for Windows

1. 下载 Windows x64 ZIP，完整解压其中的 `SideAsk` 文件夹。
2. 运行 `SideAsk.exe`。不要把 EXE 单独拿走；旁边的 DLL、`runtime`、`ui`、`generated`、`assets` 和 `licenses` 都需要保留。
3. 在任意应用中选中文字，按 `Alt+Shift+A`。
4. SideAsk 会复制选区、在指针附近出现并自动开始简短解释；随后可使用快捷问题或在底部继续追问。
5. 点击**回到原应用**、按 `Esc` 或点击窗外即可隐藏；从系统托盘可重新打开或彻底退出。

如果希望和网页端一样，打开设置并开启**划词后显示解释按钮**。之后鼠标拖选或双击选词，SideAsk 会先通过 Windows UI Automation 确认当前应用确实存在非空文字选区，确认后才在选区旁显示 **✦ 解释**。普通拖动不会触发，也不会自动发送 `Ctrl+C`；不支持系统辅助功能的应用可继续使用全局快捷键。只有点击按钮后，悬浮窗才会打开并请求 Provider。

当前 Windows 包尚未做代码签名，Windows SmartScreen 可能显示“无法识别的应用”。运行前应通过 Release 提供的校验值核对下载。系统要求 Windows 10/11 x64 与 Microsoft Edge WebView2 Runtime；当前 Windows 通常已经自带 WebView2。

## 本机只配置一次 Provider

桌面悬浮窗与 Chrome/Edge 插件共用 `http://127.0.0.1:8787`，以及 `%APPDATA%\SideAsk` 下的本机加密 Provider Vault。浏览器 Gateway 已经运行时，桌面端直接复用；否则桌面端会静默启动自带的 loopback Gateway 与 Node.js，不弹终端窗口。

你可以从桌面端齿轮按钮或浏览器设置页配置 Provider。默认 Provider 的修改会立即被本机所有 SideAsk 入口看到。新 Key 只在用户输入和保存时短暂停留在密码框中；已经保存的 Key 不会被配置 API 返回给 WebView。

桌面端会同时检查 Gateway 健康状态和共享 Provider 接口，再决定是否复用正在运行的本机服务。如果端口上仍是旧 Gateway，会给出明确的升级处理提示，不再只显示笼统的 `Not found`。

## 隐私边界

桌面端只发送用户主动选中的文字，以及当前小对话中的消息。“划词后显示解释按钮”默认关闭；开启后会在拖选或双击后通过 Windows UI Automation 读取已确认的文字选区，不使用自动 `Ctrl+C` 试探普通拖动，点击 **✦ 解释** 前也不会联系 Gateway 或 Provider。因为它运行在另一个原生应用之外，所以不会读取选区周围的文档内容；浏览器插件仍可在网页内部携带受限的附近段落。

SideAsk 不要求账号，不做云同步，不保存全局剪贴板历史，不截屏，也不在后台索引文档。

## 在 Windows 构建

要求 Windows 10/11 x64、PowerShell 5+、Node.js 20+、.NET Framework 4.8 与 WebView2 Runtime。

~~~powershell
npm run desktop:test
npm run package:desktop
~~~

构建过程会把微软官方 WebView2 SDK 下载到已忽略的本机缓存，用 Windows 自带的 .NET Framework 编译器生成 WPF 外壳，并复用现有 Gateway，输出到 `dist-desktop-native/SideAsk`。发布文件夹会携带 Node.js，因此最终用户不需要另装 Node。

桌面外壳采用 MIT 许可证；Node.js 与 WebView2 的许可证和 Notice 会一起放在 `licenses/`。
