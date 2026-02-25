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

Write-Host "Checking Internal Paths & Mounts..."
Write-Host "Target: $VPS_USER@$VPS_HOST"

# 1. Check Paths
Write-Host "`n[1/3] Checking internal paths..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -d /home/node/.openclaw/subagents /home/node/.openclaw/workspace/subagents /home/node/.openclaw/agents 2>/dev/null || echo 'Path check completed'"

# 2. List Workspace Content
Write-Host "`n[2/3] Listing Workspace Config..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.openclaw/workspace"

# 3. Inspect Mounts
Write-Host "`n[3/3] Inspecting Mounts..."
# We want to see the Mounts section nicely formatted
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker inspect openclaw-openclaw-gateway-1 --format '{{json .Mounts}}'"
