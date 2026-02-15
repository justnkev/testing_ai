@echo off
REM Launch Chrome with remote debugging enabled for Playwright MCP CDP connection
REM Run this BEFORE starting Antigravity with Playwright tools

echo Starting Chrome with remote debugging on port 9222...
echo.
echo IMPORTANT: Close all other Chrome windows first for clean connection.
echo The browser window will remain visible for AI interaction.
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
    --remote-debugging-port=9222 ^
    --user-data-dir="%USERPROFILE%\ChromeDebug" ^
    --no-first-run ^
    --no-default-browser-check

echo Chrome started with remote debugging.
echo You can now use Playwright MCP tools in Antigravity.
echo.
echo To verify connection: curl http://localhost:9222/json/version
pause
