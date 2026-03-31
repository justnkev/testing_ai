# Debug Check Subagents Type
# Checks if subagents is a file or directory, and lists agents.

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

if (-not $VPS_HOST) {
    Write-Error "VPS_HOST not set in .env"
    exit 1
}

Write-Host "Checking /opt/openclaw_config contents..." -ForegroundColor Cyan
Write-Host "========================================"

# 1. List /opt/openclaw_config to see agents vs subagents
Write-Host "`n[1/2] Listing /opt/openclaw_config..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/openclaw_config"

# 2. Check if agents directory has content
Write-Host "`n[2/2] Listing /opt/openclaw_config/agents..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/openclaw_config/agents"
