# Debug VPS Paths
# Checks the remote .env and lists directories to find the real config path.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Debugging VPS Paths..." -ForegroundColor Cyan
Write-Host "======================"

# 1. Check .env for OPENCLAW_CONFIG_DIR
Write-Host "`n[1/3] Reading /opt/openclaw/.env..."
ssh ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw/.env | grep OPENCLAW_CONFIG_DIR"

# 2. List /opt to see what directories exist
Write-Host "`n[2/3] Listing /opt..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/"

# 3. Check /opt/openclaw contents
Write-Host "`n[3/3] Listing /opt/openclaw..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/openclaw/"
