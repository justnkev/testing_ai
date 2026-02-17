# Debug Find Subagents
# Locates subagents directory and IDENTITY.md to see where they ended up.

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

Write-Host "Finding subagent files..." -ForegroundColor Cyan
Write-Host "========================="

# 1. Find directories named 'subagents'
Write-Host "`n[1/2] Searching for 'subagents' directory..."
ssh ${VPS_USER}@${VPS_HOST} "find /opt/openclaw_config -name 'subagents' -type d"

# 2. Find files named 'IDENTITY.md'
Write-Host "`n[2/2] Searching for 'IDENTITY.md'..."
ssh ${VPS_USER}@${VPS_HOST} "find /opt/openclaw_config -name 'IDENTITY.md'"
