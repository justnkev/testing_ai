# Deploy Subagents to VPS
# Uploads the 'subagents' directory to the VPS and restarts the agent.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"
$REMOTE_CONFIG_DIR = "/opt/openclaw_config"
$REMOTE_DOCKER_DIR = "/opt/openclaw"

# Resolve path relative to THIS script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOCAL_SUBAGENTS = Join-Path $ScriptDir "..\subagents"
$LOCAL_SUBAGENTS = Resolve-Path $LOCAL_SUBAGENTS

Write-Host "Deploying Subagents..." -ForegroundColor Cyan
Write-Host "======================"
Write-Host "Local Source: $LOCAL_SUBAGENTS"
Write-Host "Remote Dest:  ${REMOTE_CONFIG_DIR}/subagents"

# 1. Ensure remote directory exists (just in case)
Write-Host "`n[1/4] Checking remote directory structure..."
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p ${REMOTE_CONFIG_DIR}/subagents"

# 2. Upload Directory (Recursive)
Write-Host "`n[2/4] Uploading 'subagents' directory..."
# Scp -r copies the *contents* of the source to the dest if dest exists, 
# or creates dest if it matches the source name. 
# To be safe and predictable, we upload the *contents* of local subagents to remote subagents.
scp -r "$LOCAL_SUBAGENTS\*" "${VPS_USER}@${VPS_HOST}:${REMOTE_CONFIG_DIR}/subagents/"

# 3. Fix Permissions
Write-Host "`n[3/4] Fixing Permissions (chown 1000:1000)..."
ssh ${VPS_USER}@${VPS_HOST} "chown -R 1000:1000 ${REMOTE_CONFIG_DIR}/subagents"

# 4. Restart & Log
Write-Host "`n[4/4] Restarting Agent..."
# We must execute docker compose from the directory containing docker-compose.yml
ssh ${VPS_USER}@${VPS_HOST} "cd ${REMOTE_DOCKER_DIR} && docker compose restart openclaw-gateway && echo 'Wait for restart...' && sleep 5 && docker compose logs --tail 20 openclaw-gateway"

Write-Host "`nDeployment Complete." -ForegroundColor Green
