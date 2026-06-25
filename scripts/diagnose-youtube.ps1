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

# Resolve the script's folder robustly. $PSScriptRoot can be empty when invoked
# via `powershell -File`, so fall back to MyInvocation, then the current dir.
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$OutPath = Join-Path $ScriptDir 'ket-qua.txt'

# Write each line to console AND append to the output file immediately, so the
# file always exists with content even if an attempt hangs or the script dies.
Set-Content -Path $OutPath -Value '' -Encoding utf8 -ErrorAction SilentlyContinue
function Out-Log {
  param([string]$Line = '')
  Write-Host $Line
  Add-Content -Path $OutPath -Value $Line -Encoding utf8 -ErrorAction SilentlyContinue
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
  Out-Log 'STOP. Binary not found.'
  Write-Host ''
  Write-Host ("Saved to: {0}" -f $OutPath)
  exit 1
}
Out-Log ("Output file   : {0}" -f $OutPath)
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
  $allArgs = @()
  $allArgs += $CookieArgs
  $allArgs += @('-J','--no-playlist','--no-warnings','--skip-download',$TestUrl)

  Out-Log ("Command: yt-dlp {0}" -f ($allArgs -join ' '))

  # Use System.Diagnostics.Process directly for a reliable ExitCode and clean
  # async stdout/stderr capture (Start-Process -PassThru does not report
  # ExitCode reliably after WaitForExit with a timeout).
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $YtDlp
  foreach ($a in $allArgs) { [void]$psi.ArgumentList.Add($a) }
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute        = $false
  $psi.CreateNoWindow         = $true
  $psi.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $sbOut = New-Object System.Text.StringBuilder
  $sbErr = New-Object System.Text.StringBuilder
  $onOut = Register-ObjectEvent $p OutputDataReceived -Action { if ($EventArgs.Data) { [void]$Event.MessageData.Append($EventArgs.Data); [void]$Event.MessageData.Append("`n") } } -MessageData $sbOut
  $onErr = Register-ObjectEvent $p ErrorDataReceived  -Action { if ($EventArgs.Data) { [void]$Event.MessageData.Append($EventArgs.Data); [void]$Event.MessageData.Append("`n") } } -MessageData $sbErr

  [void]$p.Start()
  $p.BeginOutputReadLine()
  $p.BeginErrorReadLine()

  $code = $null
  if ($p.WaitForExit($TimeoutSec * 1000)) {
    $code = $p.ExitCode
  } else {
    try { $p.Kill() } catch {}
    $code = 124
  }
  Start-Sleep -Milliseconds 200  # let async handlers flush
  Unregister-Event -SourceIdentifier $onOut.Name -ErrorAction SilentlyContinue
  Unregister-Event -SourceIdentifier $onErr.Name -ErrorAction SilentlyContinue
  $p.Dispose()

  $stderr = $sbErr.ToString().Trim()

  if ($code -eq 124) {
    Out-Log (">>> RESULT: TIMEOUT (killed after ${TimeoutSec}s - likely a hang/lock)")
    if ($stderr) { Out-Log '--- partial stderr ---'; Out-Log $stderr }
  } elseif ($code -eq 0) {
    Out-Log 'ExitCode: 0'
    Out-Log '>>> RESULT: SUCCESS'
  } else {
    Out-Log ("ExitCode: {0}" -f $code)
    Out-Log '>>> RESULT: FAILED'
    Out-Log '--- full stderr ---'
    if ($stderr) { Out-Log $stderr }
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
Out-Log 'Done.'
Write-Host ''
Write-Host ("Saved to: {0}" -f $OutPath)
