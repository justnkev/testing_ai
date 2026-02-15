$ErrorActionPreference = "Stop"

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"
$REMOTE_CONFIG_DIR = "/opt/openclaw_config"
$REMOTE_DOCKER_DIR = "/opt/openclaw"

Write-Host "Verifying Remote Configuration..."
Write-Host "Target: $VPS_USER@$VPS_HOST"
Write-Host "================================"

# 1. Check Docker Compose Volumes
Write-Host "`n[1/4] Checking Docker Compose Volumes..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cat ${REMOTE_DOCKER_DIR}/docker-compose.yml"

# 2. List Config Directory Hierarchy
Write-Host "`n[2/4] Listing ${REMOTE_CONFIG_DIR} structure..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "ls -laR ${REMOTE_CONFIG_DIR}"

# 3. Check for openclaw.json
Write-Host "`n[3/4] Checking for config file..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "ls -la ${REMOTE_CONFIG_DIR}/"

# 4. Check for agents directory specific
Write-Host "`n[4/4] Checking agents directory..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "ls -laR ${REMOTE_CONFIG_DIR}/agents || echo 'No agents folder'"
