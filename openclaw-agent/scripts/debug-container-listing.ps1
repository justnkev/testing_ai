$ErrorActionPreference = "Stop"

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Inspecting Container File System..."
Write-Host "Target: $VPS_USER@$VPS_HOST"

# 1. List /home/node/.openclaw
Write-Host "`n[1/2] Listing /home/node/.openclaw..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.openclaw"

# 2. List /home/node/.openclaw/workspace
Write-Host "`n[2/2] Listing /home/node/.openclaw/workspace..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.openclaw/workspace"
