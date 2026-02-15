$ErrorActionPreference = "Stop"

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Inspecting Remote Agent Config..."
Write-Host "Target: $VPS_USER@$VPS_HOST"
Write-Host "================================"

# 1. Check IDENTITY.md content
Write-Host "`n[1/3] cat /opt/openclaw_config/agents/pe-hunter/IDENTITY.md"
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/agents/pe-hunter/IDENTITY.md || echo 'File not found'"

# 2. Check agent.json content
Write-Host "`n[2/3] cat /opt/openclaw_config/agents/pe-hunter/agent.json"
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/agents/pe-hunter/agent.json || echo 'File not found'"

# 3. Check openclaw.json content
Write-Host "`n[3/3] cat /opt/openclaw_config/openclaw.json"
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/openclaw.json || echo 'File not found'"
