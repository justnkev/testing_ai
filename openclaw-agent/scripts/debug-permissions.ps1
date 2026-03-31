# Debug OpenClaw Permissions
# This script will check the container user and file ownership on the VPS.

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

Write-Host "Checking effective user and permissions..." -ForegroundColor Cyan
Write-Host "=========================================="

# Check container user and file permissions
# Note: Using 'id' inside the container to see what user it runs as
# and 'ls -ln' on host to see numeric ownership
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && echo '--- Container User ---' && docker compose exec openclaw-gateway id && echo '--- Directory (Host, numeric) ---' && ls -lnd /opt/openclaw_config && echo '--- File (Host, numeric) ---' && ls -ln /opt/openclaw_config/openclaw.json"
