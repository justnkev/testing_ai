# Debug OpenClaw Permissions
# This script will check the container user and file ownership on the VPS.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Checking effective user and permissions..." -ForegroundColor Cyan
Write-Host "=========================================="

# Check container user and file permissions
# Note: Using 'id' inside the container to see what user it runs as
# and 'ls -ln' on host to see numeric ownership
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && echo '--- Container User ---' && docker compose exec openclaw-gateway id && echo '--- Directory (Host, numeric) ---' && ls -lnd /opt/openclaw_config && echo '--- File (Host, numeric) ---' && ls -ln /opt/openclaw_config/openclaw.json"
