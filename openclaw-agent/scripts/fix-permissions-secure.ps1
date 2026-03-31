# Fix OpenClaw Permissions (Secure) - Resilient to Windows Line Endings

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

Write-Host "Applying permissions fix (chmod 644/755)..." -ForegroundColor Cyan
Write-Host "============================"

# Using a single-line command to avoid Windows/Linux newline issues
$CMD = "chmod 755 /opt/openclaw_config && chmod 644 /opt/openclaw_config/openclaw.json && cd /opt/openclaw && docker compose restart openclaw-gateway && echo 'Waiting for restart...' && sleep 5 && docker compose logs --tail 20 openclaw-gateway"

ssh ${VPS_USER}@${VPS_HOST} $CMD
