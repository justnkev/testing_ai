# Inspect OpenClaw JSON Config

# Load .env variables
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir "..\.env"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}
else {
    Write-Warning ".env file not found at $EnvFile"
}

$VPS_HOST = $env:VPS_HOST
$VPS_USER = $env:VPS_USER

if (-not $VPS_HOST) {
    Write-Error "VPS_HOST not set in .env"
    exit 1
}

Write-Host "OpenClaw Config Inspector" -ForegroundColor Cyan
Write-Host "========================="

Write-Host "`nReading /opt/openclaw_config/openclaw.json (via Docker volume)..." -ForegroundColor Yellow
# We know the volume is mapped to /opt/openclaw_config on the host
ssh ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/openclaw.json"

Write-Host "`nDone." -ForegroundColor Green
