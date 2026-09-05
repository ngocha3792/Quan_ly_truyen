@echo off
set SSR_API_ORIGIN=https://103.74.100.55.nip.io
set APP_PUBLIC_ORIGIN=https://103.74.100.55.nip.io
cd /d "%~dp0"
npx ng serve --proxy-config proxy.remote.json
