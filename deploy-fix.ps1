# Optimized Deployment Script
# This script creates a smaller deployment package

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Optimized Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js not found." -ForegroundColor Red
    exit 1
}
node -v
Write-Host "OK: Node.js is installed" -ForegroundColor Green
Write-Host ""

# 2. Build project
Write-Host "[2/5] Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "OK: Build successful" -ForegroundColor Green
Write-Host ""

# 3. Create deployment package WITHOUT node_modules
Write-Host "[3/5] Creating deployment package (without node_modules)..." -ForegroundColor Yellow

$deployDir = "deploy-temp"
$zipFile = "deploy-fix.zip"

# Clean old deployment files
if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force
}
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

# Create temporary deployment directory
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy necessary files (EXCLUDING node_modules)
Write-Host "  Copying .next..." -ForegroundColor Gray
Copy-Item -Path ".next" -Destination "$deployDir\.next" -Recurse

Write-Host "  Copying public..." -ForegroundColor Gray
Copy-Item -Path "public" -Destination "$deployDir\public" -Recurse

Write-Host "  Copying prisma..." -ForegroundColor Gray
# IMPORTANT: Do NOT ship the SQLite database file in deploy packages.
# Otherwise `unzip -o` will overwrite the server database and users will
# "lose" their vocabulary after each deployment.
New-Item -ItemType Directory -Path "$deployDir\prisma" | Out-Null
Copy-Item -Path "prisma\schema.prisma" -Destination "$deployDir\prisma"
Copy-Item -Path "prisma\migration_lock.toml" -Destination "$deployDir\prisma"
Copy-Item -Path "prisma\migrations" -Destination "$deployDir\prisma\migrations" -Recurse

Write-Host "  Copying src..." -ForegroundColor Gray
Copy-Item -Path "src" -Destination "$deployDir\src" -Recurse

Write-Host "  Copying config files..." -ForegroundColor Gray
Copy-Item -Path "package.json" -Destination $deployDir
Copy-Item -Path "package-lock.json" -Destination $deployDir
Copy-Item -Path "ecosystem.config.js" -Destination $deployDir
Copy-Item -Path "start.sh" -Destination $deployDir

# Compress
Write-Host "  Compressing files..." -ForegroundColor Gray
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipFile -Force

# Clean temporary directory
Remove-Item $deployDir -Recurse -Force

Write-Host "OK: Deployment package created: $zipFile" -ForegroundColor Green
$size = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)
Write-Host "  Size: $size MB" -ForegroundColor Green
Write-Host ""

# 4. Display upload instructions
Write-Host "[4/5] Upload Instructions" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please upload $zipFile to the server:" -ForegroundColor Cyan
Write-Host "  Path: /www/wwwroot/114.55.58.90" -ForegroundColor Gray
Write-Host ""

# 5. Display server commands
Write-Host "[5/5] Server Deployment Commands" -ForegroundColor Yellow
Write-Host ""
Write-Host "Execute these commands on the server:" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "cd /www/wwwroot/114.55.58.90" -ForegroundColor White
Write-Host ""
Write-Host "# 1. Stop application" -ForegroundColor Yellow
Write-Host "pm2 stop cet4-web" -ForegroundColor White
Write-Host ""
Write-Host "# 2. Backup" -ForegroundColor Yellow
Write-Host "cp -r /www/wwwroot/114.55.58.90 /www/wwwroot/114.55.58.90.backup.`$(date +%Y%m%d_%H%M%S)" -ForegroundColor White
Write-Host ""
Write-Host "# 3. Delete old .next" -ForegroundColor Yellow
Write-Host "rm -rf .next" -ForegroundColor White
Write-Host ""
Write-Host "# 4. Extract" -ForegroundColor Yellow
Write-Host "unzip -o $zipFile" -ForegroundColor White
Write-Host ""
Write-Host "# 5. Install dependencies on server" -ForegroundColor Yellow
Write-Host "npm install --production" -ForegroundColor White
Write-Host ""
Write-Host "# 6. Regenerate Prisma" -ForegroundColor Yellow
Write-Host "npx prisma generate" -ForegroundColor White
Write-Host ""
Write-Host "# 7. Restart" -ForegroundColor Yellow
Write-Host "pm2 restart cet4-web" -ForegroundColor White
Write-Host ""
Write-Host "# 8. Check logs" -ForegroundColor Yellow
Write-Host "pm2 logs cet4-web --lines 50" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Deployment preparation complete!" -ForegroundColor Green
Write-Host ""
