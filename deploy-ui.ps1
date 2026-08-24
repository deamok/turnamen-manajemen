# deploy-ui.ps1
Write-Host "1. Membangun aplikasi lokal (Vite)..." -ForegroundColor Cyan
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "2. Mengirim file hasil build ke server..." -ForegroundColor Cyan
    scp -o StrictHostKeyChecking=no -r dist/* deamok@192.168.1.12:/home/deamok/tenis-meja-app/dist/
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Selesai! Buka http://192.168.1.12:8082 untuk melihat perubahan." -ForegroundColor Green
    } else {
        Write-Host "Gagal mengirim file ke server." -ForegroundColor Red
    }
} else {
    Write-Host "Gagal membangun aplikasi." -ForegroundColor Red
}
