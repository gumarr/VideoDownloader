<#
  diagnose-youtube.ps1
  ---------------------
  Script chẩn đoán lỗi "YouTube bot detection / login required" khi fetch video.

  Mục đích: tái hiện CHÍNH XÁC các attempt mà fetchVideoInfo() (ytDlpService.ts)
  chạy, nhưng in ra STDERR ĐẦY ĐỦ của từng attempt — thứ mà app đã giấu đi
  sau thông báo lỗi "đã làm đẹp".

  Cách dùng trên máy Win10 bị lỗi:
    1. Copy file này sang máy đó (vd: vào Desktop).
    2. Mở PowerShell, chạy:
         powershell -ExecutionPolicy Bypass -File .\diagnose-youtube.ps1
    3. Gửi lại TOÀN BỘ output cho người hỗ trợ.

  Script này CHỈ ĐỌC, không sửa gì, không tải video (dùng --skip-download).
#>

$ErrorActionPreference = 'Continue'
$env:PYTHONIOENCODING = 'utf-8'

# URL test (đổi nếu cần)
$TestUrl = if ($args.Count -ge 1) { $args[0] } else { 'https://www.youtube.com/watch?v=Nh2zEJaOMqE' }

# Đường dẫn yt-dlp mà app thực sự dùng (userData/bin), KHÔNG phải bản trong assets
$YtDlp = Join-Path $env:APPDATA 'videodownloader\bin\yt-dlp.exe'

function Write-Section($title) {
  Write-Output ''
  Write-Output ('=' * 70)
  Write-Output "  $title"
  Write-Output ('=' * 70)
}

# ─── 0. Môi trường ──────────────────────────────────────────────
Write-Section '0. THÔNG TIN MÔI TRƯỜNG'
$os = Get-CimInstance Win32_OperatingSystem
Write-Output ("OS            : {0} (Build {1})" -f $os.Caption, $os.BuildNumber)
Write-Output ("yt-dlp path   : {0}" -f $YtDlp)
if (Test-Path $YtDlp) {
  Write-Output ("yt-dlp exists : YES ({0} bytes)" -f (Get-Item $YtDlp).Length)
  Write-Output ("yt-dlp version: {0}" -f (& $YtDlp --version 2>&1))
} else {
  Write-Output 'yt-dlp exists : NO — app chưa chạy lần nào? Hãy mở app 1 lần rồi chạy lại script.'
  Write-Output 'DỪNG. Không tìm thấy binary.'
  exit 1
}
Write-Output ("Test URL      : {0}" -f $TestUrl)

# ─── 1. Trình duyệt & lock cookie ───────────────────────────────
Write-Section '1. TRÌNH DUYỆT ĐANG CHẠY & TRẠNG THÁI LOCK COOKIE'
foreach ($b in @('chrome','msedge','firefox')) {
  $p = Get-Process $b -ErrorAction SilentlyContinue
  if ($p) { Write-Output ("  {0,-8}: ĐANG CHẠY ({1} process)" -f $b, $p.Count) }
  else    { Write-Output ("  {0,-8}: không chạy" -f $b) }
}
$chromeCookie = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Network\Cookies'
if (Test-Path $chromeCookie) {
  try {
    $fs = [System.IO.File]::Open($chromeCookie,'Open','Read','None'); $fs.Close()
    Write-Output '  Chrome cookie DB: KHÔNG bị lock (đọc được)'
  } catch {
    Write-Output '  Chrome cookie DB: ĐANG BỊ LOCK (Chrome chưa đóng hẳn)'
  }
}

# ─── Helper chạy 1 attempt ──────────────────────────────────────
function Invoke-Attempt {
  param([string]$Label, [string[]]$CookieArgs)

  Write-Section "ATTEMPT: $Label"
  $errFile = Join-Path $env:TEMP ('ytdiag_{0}.err' -f ([guid]::NewGuid().ToString('N')))
  $allArgs = @()
  $allArgs += $CookieArgs
  $allArgs += @('-J','--no-playlist','--no-warnings','--skip-download',$TestUrl)

  Write-Output ("Lệnh: yt-dlp {0}" -f ($allArgs -join ' '))
  $null = & $YtDlp @allArgs 2> $errFile
  $code = $LASTEXITCODE
  $stderr = (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
  Remove-Item $errFile -ErrorAction SilentlyContinue

  Write-Output ("ExitCode: {0}" -f $code)
  if ($code -eq 0) {
    Write-Output '>>> KẾT QUẢ: THÀNH CÔNG ✓'
  } else {
    Write-Output '>>> KẾT QUẢ: THẤT BẠI ✗'
    Write-Output '--- stderr đầy đủ ---'
    Write-Output ($stderr.Trim())
  }
  return $code
}

# ─── 2. Tái hiện chuỗi attempt giống fetchVideoInfo ─────────────
# Thứ tự: baseline (no cookie) → chrome::Default → chrome::Profile 1/2 → edge → firefox
$results = [ordered]@{}
$results['No cookies (baseline)'] = (Invoke-Attempt 'No cookies (baseline)' @())

$chromeBase = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
if (Test-Path $chromeBase) {
  $results['chrome::Default'] = (Invoke-Attempt 'chrome::Default' @('--cookies-from-browser','chrome::Default'))
  if (Test-Path (Join-Path $chromeBase 'Profile 1')) {
    $results['chrome::Profile 1'] = (Invoke-Attempt 'chrome::Profile 1' @('--cookies-from-browser','chrome::Profile 1'))
  }
}
$edgeBase = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'
if (Test-Path $edgeBase) {
  $results['edge::Default'] = (Invoke-Attempt 'edge::Default' @('--cookies-from-browser','edge::Default'))
}
$ffBase = Join-Path $env:APPDATA 'Mozilla\Firefox\Profiles'
if (Test-Path $ffBase) {
  $results['firefox'] = (Invoke-Attempt 'firefox' @('--cookies-from-browser','firefox'))
}

# ─── 3. Các thử nghiệm vượt bot detection (không cần cookie) ─────
# Đây là phần KEY: nếu baseline fail vì bot, thử các player_client khác.
$results['player_client=android'] = (Invoke-Attempt 'extractor-args player_client=android' @('--extractor-args','youtube:player_client=android'))
$results['player_client=ios']     = (Invoke-Attempt 'extractor-args player_client=ios'     @('--extractor-args','youtube:player_client=ios'))
$results['player_client=web_safari'] = (Invoke-Attempt 'extractor-args player_client=web_safari' @('--extractor-args','youtube:player_client=web_safari'))
$results['player_client=tv']      = (Invoke-Attempt 'extractor-args player_client=tv'      @('--extractor-args','youtube:player_client=tv'))

# ─── 4. Tổng kết ────────────────────────────────────────────────
Write-Section '4. TỔNG KẾT'
foreach ($k in $results.Keys) {
  $status = if ($results[$k] -eq 0) { 'THÀNH CÔNG ✓' } else { 'THẤT BẠI ✗' }
  Write-Output ("  {0,-35} : {1}" -f $k, $status)
}
Write-Output ''
Write-Output 'Hãy gửi lại TOÀN BỘ output ở trên (đặc biệt phần stderr của các attempt THẤT BẠI).'
