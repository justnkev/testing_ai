$ErrorActionPreference = "Stop"

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"
# Resolve path relative to THIS script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOCAL_SUBAGENTS = Join-Path $ScriptDir "..\subagents"
$LOCAL_SUBAGENTS = Resolve-Path $LOCAL_SUBAGENTS
$REMOTE_TMP = "/tmp/pe-hunter-subagents"

Write-Host "Nuclear Deployment: Force Copy to Container"
Write-Host "Target: $VPS_USER@$VPS_HOST"
Write-Host "Local Source: $LOCAL_SUBAGENTS"

# 1. Upload to /tmp on VPS first (staging)
Write-Host "`n[1/5] Staging files to VPS /tmp..."
ssh ${VPS_USER}@${VPS_HOST} "rm -rf ${REMOTE_TMP} && mkdir -p ${REMOTE_TMP}"
scp -r "$LOCAL_SUBAGENTS\*" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}/"

# 2. Docker CP to .openclaw/subagents
Write-Host "`n[2/5] Injecting into ~/.openclaw/subagents..."
ssh ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 mkdir -p /home/node/.openclaw/subagents"
ssh ${VPS_USER}@${VPS_HOST} "docker cp ${REMOTE_TMP}/. openclaw-openclaw-gateway-1:/home/node/.openclaw/subagents/"

# 3. Docker CP to .openclaw/workspace/subagents
Write-Host "`n[3/5] Injecting into ~/.openclaw/workspace/subagents..."
ssh ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 mkdir -p /home/node/.openclaw/workspace/subagents"
ssh ${VPS_USER}@${VPS_HOST} "docker cp ${REMOTE_TMP}/. openclaw-openclaw-gateway-1:/home/node/.openclaw/workspace/subagents/"

# 4. Fix Permissions inside container
Write-Host "`n[4/5] Fixing Container Permissions..."
ssh ${VPS_USER}@${VPS_HOST} "docker exec -u 0 openclaw-openclaw-gateway-1 chown -R node:node /home/node/.openclaw/subagents /home/node/.openclaw/workspace/subagents"

# 5. Restart
Write-Host "`n[5/5] Restarting Agent..."
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose restart openclaw-gateway"

Write-Host "`nNuclear Deployment Complete."
