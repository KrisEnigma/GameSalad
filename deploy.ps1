try {
    # Verificar que estamos en main y el repo está inicializado
    if (-not (Test-Path .git)) {
        Write-Host "🔄 Inicializando repositorio git..." -ForegroundColor Yellow
        git init
        git add .
        git commit -m "Initial commit"
        git branch -M main
    }

    # Verificar que dist existe
    if (-not (Test-Path dist)) {
        Write-Host "❌ El directorio dist no existe. Ejecuta 'npm run build' primero" -ForegroundColor Red
        exit 1
    }

    # Verificar/agregar remote
    $remoteExists = git remote -v | Select-String -Pattern "origin"
    if (-not $remoteExists) {
        Write-Host "🔄 Agregando remote origin..." -ForegroundColor Yellow
        git remote add origin https://github.com/KrisEnigma/GameSalad.git
    }

    # Crear directorio temporal para el deploy
    $tempDir = "temp_deploy"
    Write-Host "🔄 Preparando deploy en directorio temporal..." -ForegroundColor Yellow
    
    # Limpiar directorio temporal si existe
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
    }
    
    # Crear nuevo directorio temporal y copiar contenido de dist
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    Copy-Item -Path "dist/*" -Destination $tempDir -Recurse
    
    # Inicializar git en el directorio temporal
    Push-Location $tempDir
    git init
    
    # Obtener último commit de main
    git remote add origin https://github.com/KrisEnigma/GameSalad.git
    git fetch origin main --depth=1
    
    try {
        # Intentar crear rama desde el último commit
        git reset --soft origin/main
        $hasHistory = $true
    } catch {
        # Si no hay historial, empezar desde cero
        $hasHistory = $false
    }
    
    # Agregar archivos y verificar cambios
    git add .
    $status = $(git status --porcelain)
    
    if ($status) {
        # Si hay cambios, hacer commit y push
        Write-Host "🔄 Detectados cambios, subiendo..." -ForegroundColor Yellow
        git commit -m "Update build files"
        
        if ($hasHistory) {
            # Push normal si hay historial
            git push origin HEAD:main
        } else {
            # Force push si es primer commit
            git push -f origin HEAD:main
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Deploy completado exitosamente" -ForegroundColor Green
        } else {
            Write-Host "❌ Error haciendo push a main" -ForegroundColor Red
        }
    } else {
        Write-Host "ℹ️ No hay cambios para deployar" -ForegroundColor Blue
    }

    # Volver al directorio original y limpiar
    Pop-Location
    Remove-Item -Path $tempDir -Recurse -Force
}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    # Limpiar en caso de error
    Pop-Location
    if (Test-Path "temp_deploy") {
        Remove-Item -Path "temp_deploy" -Recurse -Force
    }
    exit 1
}
