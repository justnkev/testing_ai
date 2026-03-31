$ErrorActionPreference = "Stop"

# Load .env variables
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir "..\.env"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}
else {
    Write-Warning ".env file not found at $EnvFile"
}

$VPS_HOST = $env:VPS_HOST
$VPS_USER = $env:VPS_USER
$REMOTE_FILE = "/opt/openclaw/docker-compose.yml"
$LOCAL_FILE = "temp_docker_compose.yml"

if (-not $VPS_HOST) {
    Write-Error "VPS_HOST not set in .env"
    exit 1
}

# Helper to check for commands
function Test-Command ($command) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        Write-Error "$command is required but not installed."
        exit 1
    }
}

Test-Command ssh
Test-Command scp
Test-Command python

Write-Host "1. Downloading remote docker-compose.yml..."
scp "${VPS_USER}@${VPS_HOST}:${REMOTE_FILE}" $LOCAL_FILE

Write-Host "2. Injecting Browser Service configuration..."
python scripts/inject_browser.py $LOCAL_FILE

Write-Host "3. Uploading modified configuration..."
scp $LOCAL_FILE "${VPS_USER}@${VPS_HOST}:${REMOTE_FILE}"

Write-Host "4. Restarting OpenClaw Stack..."
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose up -d --remove-orphans"

Write-Host "5. Checking Logs..."
ssh ${VPS_USER}@${VPS_HOST} "docker compose -f /opt/openclaw/docker-compose.yml logs -f --tail=20"

# Cleanup
Remove-Item $LOCAL_FILE
