Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
foreach ($size in @(180, 192, 512)) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#101312'))
    $graphics.ScaleTransform($size / 192.0, $size / 192.0)
    $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#e5f34b'), 8)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $points = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(96,28), [System.Drawing.PointF]::new(153,61),
        [System.Drawing.PointF]::new(153,127), [System.Drawing.PointF]::new(96,160),
        [System.Drawing.PointF]::new(39,127), [System.Drawing.PointF]::new(39,61)
    )
    $graphics.DrawPolygon($pen, $points)
    $pen.Width = 6
    $graphics.DrawLine($pen, 39,61,96,94)
    $graphics.DrawLine($pen, 96,94,153,61)
    $graphics.DrawLine($pen, 96,94,96,160)
    $graphics.DrawLine($pen, 68,44,125,77)
    $graphics.DrawLine($pen, 125,77,125,112)
    $filename = if ($size -eq 180) { 'apple-touch-icon.png' } else { "icon-$size.png" }
    $stream = [System.IO.MemoryStream]::new()
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "dist/$filename"), $stream.ToArray())
    $stream.Dispose()
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
