# Fix OpenClaw Permissions (Nuclear Option)

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

Write-Host "Applying permissions fix (chmod 777)..." -ForegroundColor Cyan
Write-Host "============================"

$CMD = @"
echo '--- Fixing /opt/openclaw_config ---'
chmod -R 777 /opt/openclaw_config

# Also ensure workspace is writable
mkdir -p /opt/openclaw_config/workspace
chmod -R 777 /opt/openclaw_config/workspace

echo '--- Restarting Gateway ---'
cd /opt/openclaw
docker compose restart openclaw-gateway
sleep 5
docker compose logs --tail 20 openclaw-gateway
"@

ssh ${VPS_USER}@${VPS_HOST} $CMD
