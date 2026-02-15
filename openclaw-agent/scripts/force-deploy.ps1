# Force Deploy OpenClaw Config
# This uploads the local 'fixed' config to the VPS and restarts the agent.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

# Resolve path relative to THIS script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOCAL_CONFIG = Join-Path $ScriptDir "..\config\openclaw_fixed.json"
$LOCAL_CONFIG = Resolve-Path $LOCAL_CONFIG

$REMOTE_PATH = "/opt/openclaw_config/openclaw.json"

Write-Host "Force Deploying Configuration..." -ForegroundColor Cyan
Write-Host "================================"
Write-Host "Local Config: $LOCAL_CONFIG"

# 1. Upload File
Write-Host "Uploading to VPS..."
scp $LOCAL_CONFIG ${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}

# 2. Restart & Log
Write-Host "Restarting Agent..."
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose restart openclaw-gateway && echo 'Wait for restart...' && sleep 5 && docker compose logs --tail 50 openclaw-gateway"
