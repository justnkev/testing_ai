# Debug Check Subagents Type
# Checks if subagents is a file or directory, and lists agents.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Checking /opt/openclaw_config contents..." -ForegroundColor Cyan
Write-Host "========================================"

# 1. List /opt/openclaw_config to see agents vs subagents
Write-Host "`n[1/2] Listing /opt/openclaw_config..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/openclaw_config"

# 2. Check if agents directory has content
Write-Host "`n[2/2] Listing /opt/openclaw_config/agents..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/openclaw_config/agents"
