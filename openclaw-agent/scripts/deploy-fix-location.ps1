$ErrorActionPreference = "Stop"

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
$REMOTE_CONFIG_DIR = "/opt/openclaw_config"
$REMOTE_DOCKER_DIR = "/opt/openclaw"

Write-Host "Moving Subagents to Workspace..."
Write-Host "Target: $VPS_USER@$VPS_HOST"
Write-Host "================================"

# 1. Create workspace/subagents
Write-Host "`n[1/3] Creating workspace/subagents..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "mkdir -p ${REMOTE_CONFIG_DIR}/workspace/subagents"

# 2. Copy from /opt/openclaw_config/subagents to workspace/subagents
# (We copy contents to avoid nesting subagents/subagents)
Write-Host "`n[2/3] Copying files..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cp -r ${REMOTE_CONFIG_DIR}/subagents/* ${REMOTE_CONFIG_DIR}/workspace/subagents/"

# 3. Fix Permissions again
Write-Host "`n[3/3] Fixing Permissions..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "chown -R 1000:1000 ${REMOTE_CONFIG_DIR}/workspace/subagents"

# 4. Restart
Write-Host "`n[4/4] Restarting Agent..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cd ${REMOTE_DOCKER_DIR} && docker compose restart openclaw-gateway"

Write-Host "`nMove Complete."
