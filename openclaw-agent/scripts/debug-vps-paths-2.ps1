# Debug VPS Paths 2
# Lists directories and reads .env to find the config path.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Debugging VPS Paths (Attempt 2)..." -ForegroundColor Cyan
Write-Host "=================================="

# 1. List valid openclaw directories
Write-Host "`n[1/2] Listing /opt/openclaw* directories..."
ssh ${VPS_USER}@${VPS_HOST} "ls -Fd /opt/openclaw*"

# 2. Check .env content
Write-Host "`n[2/2] Reading /opt/openclaw/.env..."
ssh ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw/.env"
