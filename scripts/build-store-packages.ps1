param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$OutputRoot = (Join-Path (Split-Path -Parent $RepositoryRoot) 'outputs')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$manifest = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'extension\manifest.json') -Raw | ConvertFrom-Json
$version = [string]$manifest.version
$tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$stageRoot = [System.IO.Path]::GetFullPath((Join-Path $tempBase ("sideask-store-" + [guid]::NewGuid().ToString('N'))))
if (-not $stageRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary staging path.' }

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null

function Compress-DirectoryContents([string]$source, [string]$destination) {
  if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($source, $destination, [System.IO.Compression.CompressionLevel]::Optimal, $false)
}

function Assert-ManifestAtRoot([string]$zipPath) {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    if (-not ($archive.Entries | Where-Object { $_.FullName -eq 'manifest.json' })) {
      throw "manifest.json is not at the root of $zipPath"
    }
  } finally { $archive.Dispose() }
}

try {
  $extensionStage = Join-Path $stageRoot 'extension'
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot 'extension') -Destination $extensionStage -Recurse

  $browserZip = Join-Path $OutputRoot "sideask-browser-extension-v$version.zip"
  $chromeZip = Join-Path $OutputRoot "sideask-chrome-web-store-v$version.zip"
  $edgeZip = Join-Path $OutputRoot "sideask-edge-addons-v$version.zip"
  Compress-DirectoryContents $extensionStage $browserZip
  Copy-Item -LiteralPath $browserZip -Destination $chromeZip -Force
  Copy-Item -LiteralPath $browserZip -Destination $edgeZip -Force
  Assert-ManifestAtRoot $browserZip
  Assert-ManifestAtRoot $chromeZip
  Assert-ManifestAtRoot $edgeZip

  $gatewayStage = Join-Path $stageRoot 'gateway'
  New-Item -ItemType Directory -Force -Path $gatewayStage | Out-Null
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot 'server') -Destination (Join-Path $gatewayStage 'server') -Recurse
  New-Item -ItemType Directory -Force -Path (Join-Path $gatewayStage 'extension') | Out-Null
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot 'extension\provider-catalog.js') -Destination (Join-Path $gatewayStage 'extension\provider-catalog.js')
  $privateEnv = Join-Path $gatewayStage 'server\.env'
  if (Test-Path -LiteralPath $privateEnv) { Remove-Item -LiteralPath $privateEnv -Force }
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot 'package.json') -Destination (Join-Path $gatewayStage 'package.json')
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot 'LICENSE') -Destination (Join-Path $gatewayStage 'LICENSE')
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot 'store\GATEWAY-README.md') -Destination (Join-Path $gatewayStage 'README.md')
  $gatewayZip = Join-Path $OutputRoot "sideask-local-gateway-v$version.zip"
  Compress-DirectoryContents $gatewayStage $gatewayZip

  $kitStage = Join-Path $stageRoot "sideask-store-submission-kit-v$version"
  New-Item -ItemType Directory -Force -Path $kitStage | Out-Null
  Copy-Item -LiteralPath $chromeZip -Destination $kitStage
  Copy-Item -LiteralPath $edgeZip -Destination $kitStage
  Copy-Item -LiteralPath $gatewayZip -Destination $kitStage
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot 'store') -Destination (Join-Path $kitStage 'store') -Recurse
  New-Item -ItemType Directory -Force -Path (Join-Path $kitStage 'store-assets') | Out-Null
  foreach ($folder in @('shared', 'en', 'zh-CN')) {
    Copy-Item -LiteralPath (Join-Path $RepositoryRoot "store-assets\$folder") -Destination (Join-Path $kitStage "store-assets\$folder") -Recurse
  }
  $kitZip = Join-Path $OutputRoot "sideask-store-submission-kit-v$version.zip"
  Compress-DirectoryContents $kitStage $kitZip

  Get-Item -LiteralPath $browserZip, $chromeZip, $edgeZip, $gatewayZip, $kitZip | Select-Object Name, Length
} finally {
  if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
}
