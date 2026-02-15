# OpenClaw Agent - Hetzner VPS Deployment

## Overview
This project contains configuration, scripts, and documentation for running the OpenClaw agentic AI gateway on a Hetzner VPS with Telegram integration.

## VPS Details
See [Gemini Deployment Notes](gemini.md) for full setup history.

| Component | Value |
|-----------|-------|
| **Provider** | Hetzner |
| **IP Address** | `89.167.57.16` |
| **OS** | Debian/Ubuntu |
| **Access** | SSH Key (`~/.ssh/id_ed25519`) |
| **Dashboard Port** | `18789` |

## Quick Start

### 1. SSH Tunnel (Access Dashboard Locally)
```powershell
ssh -N -L 18789:127.0.0.1:18789 root@89.167.57.16
```

### 2. Access Dashboard
Open in **Incognito/Private** browser:
```
http://localhost:18789/?token=<GATEWAY_TOKEN>
```

### 3. SSH into VPS
```powershell
ssh root@89.167.57.16
```

## Docker Management

### Check Running Containers
```bash
cd /opt/openclaw && docker ps
```

### View Logs
```bash
cd /opt/openclaw && docker compose logs -f
```

### Restart Stack (Clean)
```bash
docker stop $(docker ps -q)
cd /opt/openclaw && docker compose down
cd /opt/openclaw && docker compose up -d
```

### Kill Ghost Containers
```bash
docker stop $(docker ps -q)
docker container prune -f
```

## Configuration Paths (Inside Container)

| File | Path |
|------|------|
| Main Config | `/home/node/.openclaw/openclaw.json` |

### Access Config Inside Container
```bash
docker exec -u 0 <container_name> cat /home/node/.openclaw/openclaw.json
```

## Integrations

| Integration | Status |
|-------------|--------|
| Telegram Bot | ✅ Enabled |
| Google AI (Gemini) | ✅ Configured |
| Notion | ✅ Pre-loaded |

## Troubleshooting

### Port 18789 Already in Use
```bash
# Kill all containers holding the port
docker stop $(docker ps -q)
docker compose down
docker compose up -d
```

### Token Mismatch / Auth Errors
1. Use **Incognito/Private** browser window
2. Clear cookies for `localhost:18789`
3. Re-authenticate with tokenized URL

### Permission Denied Errors
Use root user inside container:
```bash
docker exec -u 0 <container_name> <command>
```

### Billing / "Insufficient Balance" Errors
If you see "API provider returned a billing error", your OpenRouter key may be out of credits or the agent is using an old key.

1. **Run the troubleshooter** (locally):
   ```powershell
   .\openclaw-agent\scripts\troubleshoot-billing.ps1
   ```
2. **If the key is incorrect**:
   SSH into the VPS and edit the config:
   ```bash
   ssh root@89.167.57.16
   nano /home/node/.openclaw/openclaw.json
   # Update "openRouterApiKey"
   docker compose restart
   ```

## Current Status

- [x] VPS Online
- [x] Docker Stack Healthy
- [x] Authentication Verified
- [x] Integrations Pre-Loaded
- [ ] Telegram Bot Pairing - **In Progress**
