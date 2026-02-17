# Verify OpenClaw Fix

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

Write-Host "Verifying OpenClaw Fix" -ForegroundColor Cyan
Write-Host "======================"

Write-Host "`n1. Checking Configured Model..." -ForegroundColor Yellow
# Grep for 'model' to see what's in the file
ssh ${VPS_USER}@${VPS_HOST} "grep '\"model\":' /opt/openclaw_config/openclaw.json"

Write-Host "`n2. Checking Latest Logs..." -ForegroundColor Yellow
# Check logs for startup success
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose logs --tail 30 openclaw-gateway"

Write-Host "`nDone." -ForegroundColor Green
