# Deploy Fixed OpenClaw Config

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
$LOCAL_CONFIG = Join-Path $PSScriptRoot "..\config\openclaw_fixed.json"
$REMOTE_CONFIG = "/opt/openclaw_config/openclaw.json"

Write-Host "Deploying Fixed Config..." -ForegroundColor Cyan
Write-Host "========================"

if (-not (Test-Path $LOCAL_CONFIG)) {
    Write-Error "Local config file not found at $LOCAL_CONFIG!"
    exit 1
}

Write-Host "`n1. Uploading $LOCAL_CONFIG to $REMOTE_CONFIG..." -ForegroundColor Yellow
# Read local file and pipe to ssh cat > remote_file
# This avoids scp and works with the same ssh session method (prompting for pass)
Get-Content -Raw $LOCAL_CONFIG | ssh ${VPS_USER}@${VPS_HOST} "cat > $REMOTE_CONFIG"

Write-Host "`n2. Verifying remote file content..." -ForegroundColor Yellow
$VERIFY_CMD = "grep 'primary' $REMOTE_CONFIG" -replace "`r", ""
ssh ${VPS_USER}@${VPS_HOST} $VERIFY_CMD

Write-Host "`n3. Restarting openclaw-gateway..." -ForegroundColor Yellow
$RESTART_CMD = "cd /opt/openclaw && docker compose restart openclaw-gateway && sleep 5 && docker compose logs --tail 30 openclaw-gateway" -replace "`r", ""
ssh ${VPS_USER}@${VPS_HOST} $RESTART_CMD

Write-Host "`nDeployment complete." -ForegroundColor Green
