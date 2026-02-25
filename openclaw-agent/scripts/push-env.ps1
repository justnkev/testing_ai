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
$GEMINI_API_KEY = $env:GEMINI_API_KEY

if (-not $VPS_HOST) {
    Write-Error "VPS_HOST not set in .env"
    exit 1
}

if (-not $GEMINI_API_KEY) {
    Write-Error "GEMINI_API_KEY not set in .env"
    exit 1
}

$REMOTE_DIR = "/opt/openclaw"
$ENV_FILE = "$REMOTE_DIR/.env"

Write-Host "Deploying GEMINI_API_KEY to $VPS_USER@$VPS_HOST..."

# Check if .env exists
Write-Host "Checking for existing .env file..."
ssh $VPS_USER@$VPS_HOST "test -f $ENV_FILE || touch $ENV_FILE"

# Add or Update GEMINI_API_KEY
Write-Host "Updating GEMINI_API_KEY in $ENV_FILE..."
# This one-liner uses sed to replace if exists, or append if not
$UpdateCmd = "grep -q '^GEMINI_API_KEY=' $ENV_FILE && sed -i 's|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$GEMINI_API_KEY|' $ENV_FILE || echo 'GEMINI_API_KEY=$GEMINI_API_KEY' >> $ENV_FILE"

ssh $VPS_USER@$VPS_HOST "$UpdateCmd"

Write-Host "Restarting OpenClaw Gateway..."
ssh $VPS_USER@$VPS_HOST "cd $REMOTE_DIR && docker compose restart openclaw-gateway"

Write-Host "Done! Please check logs with: ssh $VPS_USER@$VPS_HOST 'docker compose -f $REMOTE_DIR/docker-compose.yml logs -f'"
