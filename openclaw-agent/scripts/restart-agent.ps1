# Restart OpenClaw Agent

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

Write-Host "Restarting OpenClaw Agent..." -ForegroundColor Cyan
Write-Host "============================"

# Restart and show logs
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose restart openclaw-gateway && sleep 5 && docker compose logs --tail 50 openclaw-gateway"

Write-Host "`nCheck logs above for 'listening on ws://...'" -ForegroundColor Green
