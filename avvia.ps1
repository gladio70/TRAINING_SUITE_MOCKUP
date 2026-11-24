# Avvia il mockup TRAINING SUITE in locale usando il Node portatile in _toolchain
$root = $PSScriptRoot
$env:PATH = "$root\_toolchain\node;$env:PATH"
Set-Location $root
if (-not (Test-Path "$root\node_modules")) { npm install --no-fund --no-audit }
Start-Process "http://localhost:5180"
npm run dev -- --port 5180
