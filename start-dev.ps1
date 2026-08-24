# start-dev.ps1
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
Write-Host "Menjalankan aplikasi lokal untuk uji coba..." -ForegroundColor Cyan
npm run dev
