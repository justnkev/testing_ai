# Debug VPS Config Contents
# Lists contents of the config directory to verify upload location.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Checking /opt/openclaw_config..." -ForegroundColor Cyan
Write-Host "================================"

# 1. List valid openclaw directories
Write-Host "`n[1/2] Recursive ls of /opt/openclaw_config..."
ssh ${VPS_USER}@${VPS_HOST} "ls -laR /opt/openclaw_config"
