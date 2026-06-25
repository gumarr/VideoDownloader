<#
  diagnose-youtube.ps1
  --------------------
  Diagnoses the "YouTube bot detection / login required" error on fetch.

  It reproduces EXACTLY the attempt chain that fetchVideoInfo() runs
  (ytDlpService.ts), printing the FULL stderr of each attempt - the part
  the app hides behind its "prettified" error message.

  Usage on the failing Win10 machine:
    1. Open the app once (so it installs yt-dlp), then close it.
    2. Copy this file to that machine (e.g. Desktop).
    3. Open PowerShell in the folder containing the file and run:
         powershell -ExecutionPolicy Bypass -File .\diagnose-youtube.ps1
    4. Send back the file 'ket-qua.txt' it writes next to the script.

  Read-only: never edits anything, never downloads (uses --skip-download).
  ASCII-only so it parses under any console code page.
  Each attempt has a 45s timeout so a hung/locked browser can't stall it.
#>

$ErrorActionPreference = 'Continue'
$env:PYTHONIOENCODING = 'utf-8'

# Collect every line here, then write once as UTF-8 (no UTF-16 / spacing issues)
$script:Log = New-Object System.Collections.Generic.List[string]
function Out-Log {
  param([string]$Line = '')
  $script:Log.Add($Line)
  Write-Host $Line
}

# Test URL (override by passing one as the first argument)
$TestUrl = if ($args.Count -ge 1) { $args[0] } else { 'https://www.youtube.com/watch?v=Nh2zEJaOMqE' }

function Resolve-YtDlp {
  # productName "Video Downloader" (with space) for installed builds;
  # "videodownloader" for dev builds. Prefer the installed one.
  $candidates = @(
    (Join-Path $env:APPDATA 'Video Downloader\bin\yt-dlp.exe'),
    (Join-Path $env:APPDATA 'videodownloader\bin\yt-dlp.exe')
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}
$YtDlp = Resolve-YtDlp

function Write-Section($title) {
  Out-Log ''
  Out-Log ('=' * 70)
  Out-Log "  $title"
  Out-Log ('=' * 70)
}

# --- 0. Environment ---------------------------------------------
Write-Section '0. ENVIRONMENT'
$os = Get-CimInstance Win32_OperatingSystem
Out-Log ("OS            : {0} (Build {1})" -f $os.Caption, $os.BuildNumber)
if ($YtDlp -and (Test-Path $YtDlp)) {
  Out-Log ("yt-dlp path   : {0}" -f $YtDlp)
  Out-Log ("yt-dlp exists : YES ({0} bytes)" -f (Get-Item $YtDlp).Length)
  Out-Log ("yt-dlp version: {0}" -f (& $YtDlp --version 2>&1))
} else {
  Out-Log 'yt-dlp exists : NO - open the app once, then re-run this script.'
  $script:Log -join "`r`n" | Out-File -FilePath (Join-Path $PSScriptRoot 'ket-qua.txt') -Encoding utf8
  Out-Log 'STOP. Binary not found.'
  exit 1
}
Out-Log ("Test URL      : {0}" -f $TestUrl)

# --- 1. Browsers running & cookie lock --------------------------
Write-Section '1. BROWSERS RUNNING & COOKIE LOCK STATE'
foreach ($b in @('chrome','msedge','firefox')) {
  $p = Get-Process $b -ErrorAction SilentlyContinue
  if ($p) { Out-Log ("  {0,-8}: RUNNING ({1} process)" -f $b, $p.Count) }
  else    { Out-Log ("  {0,-8}: not running" -f $b) }
}
$chromeCookie = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Network\Cookies'
if (Test-Path $chromeCookie) {
  try {
    $fs = [System.IO.File]::Open($chromeCookie,'Open','Read','None'); $fs.Close()
    Out-Log '  Chrome cookie DB: NOT locked (readable)'
  } catch {
    Out-Log '  Chrome cookie DB: LOCKED (Chrome not fully closed)'
  }
}

# --- Helper: run one attempt with a hard timeout ----------------
function Invoke-Attempt {
  param([string]$Label, [string[]]$CookieArgs, [int]$TimeoutSec = 45)

  Write-Section "ATTEMPT: $Label"
  $outFile = Join-Path $env:TEMP ('ytdiag_' + [guid]::NewGuid().ToString('N') + '.out')
  $errFile = Join-Path $env:TEMP ('ytdiag_' + [guid]::NewGuid().ToString('N') + '.err')
  $allArgs = @()
  $allArgs += $CookieArgs
  $allArgs += @('-J','--no-playlist','--no-warnings','--skip-download',$TestUrl)

  Out-Log ("Command: yt-dlp {0}" -f ($allArgs -join ' '))

  $proc = Start-Process -FilePath $YtDlp -ArgumentList $allArgs -NoNewWindow -PassThru `
            -RedirectStandardOutput $outFile -RedirectStandardError $errFile
  if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
    try { $proc.Kill() } catch {}
    Start-Sleep -Milliseconds 300
    Out-Log (">>> RESULT: TIMEOUT (killed after ${TimeoutSec}s - likely a hang/lock)")
    $stderr = (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
    if ($stderr) { Out-Log '--- partial stderr ---'; Out-Log ($stderr.Trim()) }
    Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
    return 124
  }

  $code = $proc.ExitCode
  $stderr = (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
  Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue

  Out-Log ("ExitCode: {0}" -f $code)
  if ($code -eq 0) {
    Out-Log '>>> RESULT: SUCCESS'
  } else {
    Out-Log '>>> RESULT: FAILED'
    Out-Log '--- full stderr ---'
    if ($stderr) { Out-Log ($stderr.Trim()) }
  }
  return $code
}

# --- 2. Reproduce the fetchVideoInfo attempt chain --------------
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
$results['player_client=android']    = (Invoke-Attempt 'extractor-args player_client=android'    @('--extractor-args','youtube:player_client=android'))
$results['player_client=ios']        = (Invoke-Attempt 'extractor-args player_client=ios'        @('--extractor-args','youtube:player_client=ios'))
$results['player_client=web_safari'] = (Invoke-Attempt 'extractor-args player_client=web_safari' @('--extractor-args','youtube:player_client=web_safari'))
$results['player_client=tv']         = (Invoke-Attempt 'extractor-args player_client=tv'         @('--extractor-args','youtube:player_client=tv'))

# --- 4. Summary -------------------------------------------------
Write-Section '4. SUMMARY'
foreach ($k in $results.Keys) {
  $status = switch ($results[$k]) { 0 { 'SUCCESS' } 124 { 'TIMEOUT' } default { 'FAILED' } }
  Out-Log ("  {0,-35} : {1}" -f $k, $status)
}
Out-Log ''
Out-Log 'Done. Send back the ket-qua.txt file written next to this script.'

# --- Write the log as clean UTF-8 -------------------------------
$outPath = Join-Path $PSScriptRoot 'ket-qua.txt'
$script:Log -join "`r`n" | Out-File -FilePath $outPath -Encoding utf8
Write-Host ''
Write-Host ("Saved to: {0}" -f $outPath)
