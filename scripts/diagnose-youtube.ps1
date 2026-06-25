<#
  diagnose-youtube.ps1
  --------------------
  Diagnoses the "YouTube bot detection / login required" error on fetch.

  It reproduces EXACTLY the attempt chain that fetchVideoInfo() runs
  (ytDlpService.ts), but prints the FULL stderr of each attempt - the part
  the app hides behind its "prettified" error message.

  Usage on the failing Win10 machine:
    1. Open the app once (so it copies yt-dlp into userData/bin), then close it.
    2. Copy this file to that machine (e.g. Desktop).
    3. Open PowerShell in the folder containing the file and run:
         powershell -ExecutionPolicy Bypass -File .\diagnose-youtube.ps1
    4. Send back the ENTIRE output.

  Read-only: never edits anything, never downloads (uses --skip-download).
  ASCII-only on purpose so it parses under any console code page.
#>

$ErrorActionPreference = 'Continue'
$env:PYTHONIOENCODING = 'utf-8'

# Test URL (override by passing one as the first argument)
$TestUrl = if ($args.Count -ge 1) { $args[0] } else { 'https://www.youtube.com/watch?v=Nh2zEJaOMqE' }

# Path to the yt-dlp binary the app actually uses (userData/bin), NOT assets
$YtDlp = Join-Path $env:APPDATA 'videodownloader\bin\yt-dlp.exe'

function Write-Section($title) {
  Write-Output ''
  Write-Output ('=' * 70)
  Write-Output "  $title"
  Write-Output ('=' * 70)
}

# --- 0. Environment ---------------------------------------------
Write-Section '0. ENVIRONMENT'
$os = Get-CimInstance Win32_OperatingSystem
Write-Output ("OS            : {0} (Build {1})" -f $os.Caption, $os.BuildNumber)
Write-Output ("yt-dlp path   : {0}" -f $YtDlp)
if (Test-Path $YtDlp) {
  Write-Output ("yt-dlp exists : YES ({0} bytes)" -f (Get-Item $YtDlp).Length)
  Write-Output ("yt-dlp version: {0}" -f (& $YtDlp --version 2>&1))
} else {
  Write-Output 'yt-dlp exists : NO - has the app run yet? Open it once, then re-run this script.'
  Write-Output 'STOP. Binary not found.'
  exit 1
}
Write-Output ("Test URL      : {0}" -f $TestUrl)

# --- 1. Browsers running & cookie lock --------------------------
Write-Section '1. BROWSERS RUNNING & COOKIE LOCK STATE'
foreach ($b in @('chrome','msedge','firefox')) {
  $p = Get-Process $b -ErrorAction SilentlyContinue
  if ($p) {
    Write-Output ("  {0,-8}: RUNNING ({1} process)" -f $b, $p.Count)
  } else {
    Write-Output ("  {0,-8}: not running" -f $b)
  }
}
$chromeCookie = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Network\Cookies'
if (Test-Path $chromeCookie) {
  try {
    $fs = [System.IO.File]::Open($chromeCookie,'Open','Read','None')
    $fs.Close()
    Write-Output '  Chrome cookie DB: NOT locked (readable)'
  } catch {
    Write-Output '  Chrome cookie DB: LOCKED (Chrome not fully closed)'
  }
}

# --- Helper: run one attempt ------------------------------------
function Invoke-Attempt {
  param([string]$Label, [string[]]$CookieArgs)

  Write-Section "ATTEMPT: $Label"
  $errFile = Join-Path $env:TEMP ('ytdiag_' + [guid]::NewGuid().ToString('N') + '.err')
  $allArgs = @()
  $allArgs += $CookieArgs
  $allArgs += @('-J','--no-playlist','--no-warnings','--skip-download',$TestUrl)

  Write-Output ("Command: yt-dlp {0}" -f ($allArgs -join ' '))
  $null = & $YtDlp @allArgs 2> $errFile
  $code = $LASTEXITCODE
  $stderr = (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
  Remove-Item $errFile -ErrorAction SilentlyContinue

  Write-Output ("ExitCode: {0}" -f $code)
  if ($code -eq 0) {
    Write-Output '>>> RESULT: SUCCESS'
  } else {
    Write-Output '>>> RESULT: FAILED'
    Write-Output '--- full stderr ---'
    if ($stderr) { Write-Output ($stderr.Trim()) }
  }
  return $code
}

# --- 2. Reproduce the fetchVideoInfo attempt chain --------------
# Order: baseline (no cookie) -> chrome::Default -> chrome::Profile 1 -> edge -> firefox
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

# --- 3. Bot-detection bypass tests (no cookies needed) ----------
# KEY part: if baseline fails on bot detection, try alternate player clients.
$results['player_client=android']    = (Invoke-Attempt 'extractor-args player_client=android'    @('--extractor-args','youtube:player_client=android'))
$results['player_client=ios']        = (Invoke-Attempt 'extractor-args player_client=ios'        @('--extractor-args','youtube:player_client=ios'))
$results['player_client=web_safari'] = (Invoke-Attempt 'extractor-args player_client=web_safari' @('--extractor-args','youtube:player_client=web_safari'))
$results['player_client=tv']         = (Invoke-Attempt 'extractor-args player_client=tv'         @('--extractor-args','youtube:player_client=tv'))

# --- 4. Summary -------------------------------------------------
Write-Section '4. SUMMARY'
foreach ($k in $results.Keys) {
  $status = if ($results[$k] -eq 0) { 'SUCCESS' } else { 'FAILED' }
  Write-Output ("  {0,-35} : {1}" -f $k, $status)
}
Write-Output ''
Write-Output 'Send back the ENTIRE output above (especially the stderr of FAILED attempts).'
