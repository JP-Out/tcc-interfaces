@echo off
setlocal

set "BASE_URL=https://jp-out.github.io/tcc-interfaces/v1/index.html"
set "HOSTNAME_ENCODED="

for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[uri]::EscapeDataString($env:COMPUTERNAME)"`) do set "HOSTNAME_ENCODED=%%A"

if not defined HOSTNAME_ENCODED set "HOSTNAME_ENCODED=%COMPUTERNAME%"

start "" "%BASE_URL%?computerName=%HOSTNAME_ENCODED%"

endlocal
