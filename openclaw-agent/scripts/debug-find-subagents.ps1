# Debug Find Subagents
# Locates subagents directory and IDENTITY.md to see where they ended up.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Finding subagent files..." -ForegroundColor Cyan
Write-Host "========================="

# 1. Find directories named 'subagents'
Write-Host "`n[1/2] Searching for 'subagents' directory..."
ssh ${VPS_USER}@${VPS_HOST} "find /opt/openclaw_config -name 'subagents' -type d"

# 2. Find files named 'IDENTITY.md'
Write-Host "`n[2/2] Searching for 'IDENTITY.md'..."
ssh ${VPS_USER}@${VPS_HOST} "find /opt/openclaw_config -name 'IDENTITY.md'"
