# Renders the textbook chapters that match the slide decks to compressed JPGs: site/book/chN/pNNN.jpg (NNN = printed book page).
# Uses the built-in Windows.Data.Pdf renderer. Book page = PDF page - 31.
param([string]$Root = "D:\Download3\Uni\301", [int]$Width = 960, [long]$Quality = 50)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
function AwaitAction($op) { $asTaskAction.Invoke($null, @($op)).Wait() }

# PDF page ranges per book chapter (chapter opener to the page before the next chapter)
# string keys: an [ordered] dictionary indexed with an int returns the entry at that POSITION, not the key
$ranges = [ordered]@{ "1" = @(33, 56); "2" = @(57, 78); "3" = @(79, 106); "4" = @(107, 146); "5" = @(147, 172); "6" = @(173, 196); "14" = @(375, 392) }
$offset = 31
$pdf = Join-Path $Root "TEXTBOOK\MKT301-TEXTBOOK.PDF.pdf"
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdf)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $Quality
foreach ($ch in $ranges.Keys) {
  $out = Join-Path $Root "site\book\ch$ch"
  New-Item -ItemType Directory -Force $out | Out-Null
  $first, $last = $ranges[$ch]
  for ($p = $first; $p -le $last; $p++) {
    $page = $doc.GetPage($p - 1)
    $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $opts.DestinationWidth = $Width
    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    AwaitAction ($page.RenderToStreamAsync($stream, $opts))
    $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream.GetInputStreamAt(0))
    $src = [System.Drawing.Image]::FromStream($net)
    # flatten onto white (PDF renders can carry transparency) and save as compressed JPEG
    $bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White); $g.DrawImage($src, 0, 0, $src.Width, $src.Height); $g.Dispose()
    $bmp.Save((Join-Path $out ("p{0:D3}.jpg" -f ($p - $offset))), $enc, $ep)
    $bmp.Dispose(); $src.Dispose(); $net.Dispose(); $page.Dispose()
  }
  "ch$ch : pages $($first - $offset)-$($last - $offset)"
}
