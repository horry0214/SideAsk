param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assetRoot = Join-Path $RepositoryRoot 'store-assets'
$sourceRoot = Join-Path $assetRoot 'source'
$readmeRoot = Join-Path $RepositoryRoot 'assets\readme'
$iconPath = Join-Path $RepositoryRoot 'extension\assets\icons\icon-128.png'
$sharedRoot = Join-Path $assetRoot 'shared'
$enRoot = Join-Path $assetRoot 'en\screenshots'
$zhRoot = Join-Path $assetRoot 'zh-CN\screenshots'

@($sharedRoot, $enRoot, $zhRoot) | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

function New-RoundedPath([System.Drawing.RectangleF]$rect, [float]$radius) {
  $diameter = $radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$destination) {
  $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-StoreScreenshot([string]$source, [string]$destination, [string]$title, [string]$subtitle) {
  $canvas = [System.Drawing.Bitmap]::new(1280, 800)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#F8F8FE'))

  $icon = [System.Drawing.Image]::FromFile($iconPath)
  $image = [System.Drawing.Image]::FromFile($source)
  $titleFont = [System.Drawing.Font]::new('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
  $subtitleFont = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Regular)
  $titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#111827'))
  $subtitleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#667085'))
  $linePen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#E4E7EC'), 1)
  try {
    $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new(22, 16, 48, 48))
    $graphics.DrawString($title, $titleFont, $titleBrush, 82, 15)
    $graphics.DrawString($subtitle, $subtitleFont, $subtitleBrush, 83, 43)
    $graphics.DrawLine($linePen, 0, 79, 1280, 79)
    $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 80, 1280, 720))
    Save-Png $canvas $destination
  } finally {
    $linePen.Dispose(); $subtitleBrush.Dispose(); $titleBrush.Dispose(); $subtitleFont.Dispose(); $titleFont.Dispose()
    $image.Dispose(); $icon.Dispose(); $graphics.Dispose(); $canvas.Dispose()
  }
}

function New-Promo([int]$width, [int]$height, [string]$destination) {
  $canvas = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, $width, $height),
    [System.Drawing.ColorTranslator]::FromHtml('#2817B8'),
    [System.Drawing.ColorTranslator]::FromHtml('#8A7BFF'),
    18
  )
  $glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
  $panelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(244, 255, 255, 255))
  $lineBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(36, 37, 50, 92))
  $selectBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(70, 98, 91, 246))
  $icon = [System.Drawing.Image]::FromFile($iconPath)
  try {
    $graphics.FillRectangle($gradient, 0, 0, $width, $height)
    $graphics.FillEllipse($glow, -[int]($height * .45), -[int]($height * .5), [int]($height * 1.25), [int]($height * 1.25))
    $graphics.FillEllipse($glow, [int]($width * .72), [int]($height * .48), [int]($height * .95), [int]($height * .95))

    if ($width -lt 1000) {
      $iconSize = 112; $iconX = 34; $iconY = 84
      $panelRect = [System.Drawing.RectangleF]::new(169, 38, 230, 204)
      $lineX = 194; $lineY = 82; $lineWidth = 157
    } else {
      $iconSize = 210; $iconX = 150; $iconY = 175
      $panelRect = [System.Drawing.RectangleF]::new(470, 72, 760, 416)
      $lineX = 535; $lineY = 156; $lineWidth = 520
    }
    $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new($iconX, $iconY, $iconSize, $iconSize))
    $panelPath = New-RoundedPath $panelRect ([float]($height * .045))
    $graphics.FillPath($panelBrush, $panelPath)
    $lineHeight = [Math]::Max(8, [int]($height * .025))
    for ($i = 0; $i -lt 3; $i++) {
      $currentWidth = if ($i -eq 2) { [int]($lineWidth * .66) } else { $lineWidth }
      $lineRect = [System.Drawing.RectangleF]::new($lineX, $lineY + $i * ($lineHeight + [int]($height * .045)), $currentWidth, $lineHeight)
      $linePath = New-RoundedPath $lineRect ([float]($lineHeight / 2))
      $graphics.FillPath($(if ($i -eq 1) { $selectBrush } else { $lineBrush }), $linePath)
      $linePath.Dispose()
    }
    $sideRect = if ($width -lt 1000) { [System.Drawing.RectangleF]::new(315, 138, 96, 86) } else { [System.Drawing.RectangleF]::new(1000, 230, 270, 205) }
    $sidePath = New-RoundedPath $sideRect ([float]($height * .035))
    $graphics.FillPath($panelBrush, $sidePath)
    $sidePath.Dispose(); $panelPath.Dispose()
    Save-Png $canvas $destination
  } finally {
    $icon.Dispose(); $selectBrush.Dispose(); $lineBrush.Dispose(); $panelBrush.Dispose(); $glow.Dispose(); $gradient.Dispose(); $graphics.Dispose(); $canvas.Dispose()
  }
}

function New-EdgeLogo([string]$destination) {
  $canvas = [System.Drawing.Bitmap]::new(300, 300)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $icon = [System.Drawing.Image]::FromFile($iconPath)
  try {
    $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new(0, 0, 300, 300))
    Save-Png $canvas $destination
  } finally { $icon.Dispose(); $graphics.Dispose(); $canvas.Dispose() }
}

$english = @(
  @((Join-Path $sourceRoot 'onboarding-en.png'), '01-first-run.png', 'Set up in three guided steps', 'Gateway · Provider · first selection'),
  @((Join-Path $readmeRoot 'sideask-in-action-en.png'), '02-side-question.png', 'Ask beside any page', 'Stay in context while the answer streams next to the source'),
  @((Join-Path $readmeRoot 'provider-dialog-en.png'), '03-provider.png', 'Bring your own model', 'MiniMax or any OpenAI-compatible endpoint'),
  @((Join-Path $readmeRoot 'simple-core-en.png'), '04-favorites.png', 'Favorite only what matters', 'Keep useful answers without maintaining a knowledge system'),
  @((Join-Path $readmeRoot 'simple-core-en.png'), '05-recent.png', 'No organizing required', 'Recent questions appear automatically with their source')
)

$chinese = @(
  @((Join-Path $sourceRoot 'onboarding-zh.png'), '01-first-run.png', '三步完成首次设置', 'Gateway · Provider · 第一次划词'),
  @((Join-Path $readmeRoot 'sideask-in-action.png'), '02-side-question.png', '在原文旁提问', '答案在来源旁流式展开，不打断阅读主线'),
  @((Join-Path $readmeRoot 'provider-dialog.png'), '03-provider.png', '使用你自己的模型', '支持 MiniMax 与 OpenAI-compatible Endpoint'),
  @((Join-Path $readmeRoot 'simple-core.png'), '04-favorites.png', '只收藏真正有用的回答', '不需要维护另一套知识系统'),
  @((Join-Path $readmeRoot 'simple-core.png'), '05-recent.png', '不用整理', '最近提问自动出现并保留来源')
)

foreach ($item in $english) { New-StoreScreenshot $item[0] (Join-Path $enRoot $item[1]) $item[2] $item[3] }
foreach ($item in $chinese) { New-StoreScreenshot $item[0] (Join-Path $zhRoot $item[1]) $item[2] $item[3] }

Copy-Item -LiteralPath $iconPath -Destination (Join-Path $sharedRoot 'icon-128.png') -Force
New-EdgeLogo (Join-Path $sharedRoot 'edge-logo-300.png')
New-Promo 440 280 (Join-Path $sharedRoot 'promo-small-440x280.png')
New-Promo 1400 560 (Join-Path $sharedRoot 'promo-marquee-1400x560.png')

Write-Host "Store assets generated in $assetRoot"
