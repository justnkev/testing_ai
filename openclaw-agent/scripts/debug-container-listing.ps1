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

if (-not $VPS_HOST) {
    Write-Error "VPS_HOST not set in .env"
    exit 1
}

Write-Host "Inspecting Container File System..."
Write-Host "Target: $VPS_USER@$VPS_HOST"

# 1. List /home/node/.openclaw
Write-Host "`n[1/2] Listing /home/node/.openclaw..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.openclaw"

# 2. List /home/node/.openclaw/workspace
Write-Host "`n[2/2] Listing /home/node/.openclaw/workspace..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.openclaw/workspace"
