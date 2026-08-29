param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$desktopRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $desktopRoot ".."))
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $repositoryRoot "dist-desktop-native\SideAsk"
}
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$allowedOutputRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "dist-desktop-native"))
if (-not $outputRoot.StartsWith($allowedOutputRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Native build output must stay inside $allowedOutputRoot"
}

$webViewVersion = "1.0.4129.50"
$packageRoot = Join-Path $desktopRoot ".packages\Microsoft.Web.WebView2.$webViewVersion"
$packageFile = Join-Path $desktopRoot ".packages\Microsoft.Web.WebView2.$webViewVersion.nupkg"
if (-not (Test-Path -LiteralPath $packageRoot)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $packageFile) | Out-Null
  if (-not (Test-Path -LiteralPath $packageFile)) {
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$webViewVersion" -OutFile $packageFile
  }
  [System.IO.Compression.ZipFile]::ExtractToDirectory($packageFile, $packageRoot)
}

& node (Join-Path $desktopRoot "scripts\prepare-runtime.mjs")

if (Test-Path -LiteralPath $outputRoot) {
  $resolvedOutput = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $outputRoot))
  if (-not $resolvedOutput.StartsWith($allowedOutputRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clear unexpected output path: $resolvedOutput"
  }
  Remove-Item -LiteralPath $resolvedOutput -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputRoot "assets") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputRoot "licenses") | Out-Null

Copy-Item -LiteralPath (Join-Path $desktopRoot "ui") -Destination (Join-Path $outputRoot "ui") -Recurse
Copy-Item -LiteralPath (Join-Path $desktopRoot "generated") -Destination (Join-Path $outputRoot "generated") -Recurse
Copy-Item -LiteralPath (Join-Path $desktopRoot "runtime") -Destination (Join-Path $outputRoot "runtime") -Recurse
Copy-Item -LiteralPath (Join-Path $desktopRoot "assets\sideask-mark.svg") -Destination (Join-Path $outputRoot "assets\sideask-mark.svg")
Copy-Item -LiteralPath (Join-Path $desktopRoot "generated\sideask.ico") -Destination (Join-Path $outputRoot "assets\sideask.ico")
Copy-Item -LiteralPath (Join-Path $desktopRoot "licenses\Node.js-LICENSE.txt") -Destination (Join-Path $outputRoot "licenses\Node.js-LICENSE.txt")
Copy-Item -LiteralPath (Join-Path $packageRoot "LICENSE.txt") -Destination (Join-Path $outputRoot "licenses\WebView2-LICENSE.txt")
Copy-Item -LiteralPath (Join-Path $packageRoot "NOTICE.txt") -Destination (Join-Path $outputRoot "licenses\WebView2-NOTICE.txt")
Copy-Item -LiteralPath (Join-Path $repositoryRoot "LICENSE") -Destination (Join-Path $outputRoot "LICENSE")
Copy-Item -LiteralPath (Join-Path $repositoryRoot "docs\getting-started\DESKTOP.md") -Destination (Join-Path $outputRoot "README.md")
Copy-Item -LiteralPath (Join-Path $repositoryRoot "docs\getting-started\DESKTOP.zh-CN.md") -Destination (Join-Path $outputRoot "README.zh-CN.md")
Copy-Item -LiteralPath (Join-Path $repositoryRoot "docs\getting-started\DESKTOP.md") -Destination (Join-Path $outputRoot "DESKTOP.md")
Copy-Item -LiteralPath (Join-Path $repositoryRoot "docs\getting-started\DESKTOP.zh-CN.md") -Destination (Join-Path $outputRoot "DESKTOP.zh-CN.md")

$nodePath = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path (Join-Path $outputRoot "runtime\node") | Out-Null
Copy-Item -LiteralPath $nodePath -Destination (Join-Path $outputRoot "runtime\node\node.exe")

$frameworkDirectory = Join-Path $packageRoot "lib\net462"
$loaderPath = Join-Path $packageRoot "runtimes\win-x64\native\WebView2Loader.dll"
$coreAssembly = Join-Path $frameworkDirectory "Microsoft.Web.WebView2.Core.dll"
$wpfAssembly = Join-Path $frameworkDirectory "Microsoft.Web.WebView2.Wpf.dll"
Copy-Item -LiteralPath $coreAssembly -Destination $outputRoot
Copy-Item -LiteralPath $wpfAssembly -Destination $outputRoot
Copy-Item -LiteralPath $loaderPath -Destination $outputRoot

$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $compiler)) { throw "The .NET Framework 4.8 C# compiler is unavailable." }
$frameworkRoot = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319"
$wpfRoot = Join-Path $frameworkRoot "WPF"
$executable = Join-Path $outputRoot "SideAsk.exe"
$arguments = @(
  "/nologo",
  "/target:winexe",
  "/platform:x64",
  "/optimize+",
  "/debug-",
  "/out:$executable",
  "/win32icon:$(Join-Path $desktopRoot 'generated\sideask.ico')",
  "/reference:$(Join-Path $wpfRoot 'PresentationCore.dll')",
  "/reference:$(Join-Path $wpfRoot 'PresentationFramework.dll')",
  "/reference:$(Join-Path $wpfRoot 'WindowsBase.dll')",
  "/reference:$(Join-Path $wpfRoot 'UIAutomationClient.dll')",
  "/reference:$(Join-Path $wpfRoot 'UIAutomationTypes.dll')",
  "/reference:$(Join-Path $frameworkRoot 'System.Xaml.dll')",
  "/reference:$(Join-Path $frameworkRoot 'System.Net.Http.dll')",
  "/reference:$(Join-Path $frameworkRoot 'System.Web.Extensions.dll')",
  "/reference:$(Join-Path $frameworkRoot 'System.Windows.Forms.dll')",
  "/reference:$(Join-Path $frameworkRoot 'System.Drawing.dll')",
  "/reference:$coreAssembly",
  "/reference:$wpfAssembly",
  (Join-Path $desktopRoot "native\SideAsk.cs")
)
& $compiler $arguments
if ($LASTEXITCODE -ne 0) { throw "SideAsk native compilation failed." }
Copy-Item -LiteralPath (Join-Path $desktopRoot "native\SideAsk.exe.config") -Destination "$executable.config"

$files = Get-ChildItem -LiteralPath $outputRoot -Recurse -File
$bytes = ($files | Measure-Object -Property Length -Sum).Sum
Write-Host "SideAsk native build: $outputRoot"
Write-Host ("Files: {0} · Size: {1:N1} MiB" -f $files.Count, ($bytes / 1MB))
