# OpenClaw SSH Tunnel Script
# This script establishes a local port forward to access the OpenClaw dashboard

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
$LOCAL_PORT = 18789
$REMOTE_PORT = 18789

Write-Host "🔒 Establishing SSH tunnel to OpenClaw dashboard..." -ForegroundColor Cyan
Write-Host "   Local:  http://localhost:$LOCAL_PORT" -ForegroundColor Green
Write-Host "   Remote: $VPS_USER@$VPS_HOST:$REMOTE_PORT" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to close the tunnel" -ForegroundColor Gray
Write-Host ""

ssh -N -L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT} ${VPS_USER}@${VPS_HOST}
