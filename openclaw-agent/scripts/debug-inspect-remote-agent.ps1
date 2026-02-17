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

Write-Host "Inspecting Remote Agent Config..."
Write-Host "Target: $VPS_USER@$VPS_HOST"
Write-Host "================================"

# 1. Check IDENTITY.md content
Write-Host "`n[1/3] cat /opt/openclaw_config/agents/pe-hunter/IDENTITY.md"
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/agents/pe-hunter/IDENTITY.md || echo 'File not found'"

# 2. Check agent.json content
Write-Host "`n[2/3] cat /opt/openclaw_config/agents/pe-hunter/agent.json"
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/agents/pe-hunter/agent.json || echo 'File not found'"

# 3. Check openclaw.json content
Write-Host "`n[3/3] cat /opt/openclaw_config/openclaw.json"
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/openclaw.json || echo 'File not found'"
