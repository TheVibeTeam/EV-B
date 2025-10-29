# Script de PowerShell para configurar Google Cloud Storage para Auralix API

$PROJECT_ID = "pro-platform-470721-v2"
$BUCKET_NAME = "auralix-uploads"
$REGION = "us-central1"
$SERVICE_ACCOUNT = "default@pro-platform-470721-v2.iam.gserviceaccount.com"

Write-Host "🚀 Configurando Google Cloud Storage para Auralix API" -ForegroundColor Green
Write-Host ""

# 1. Crear el bucket si no existe
Write-Host "📦 Creando bucket $BUCKET_NAME..." -ForegroundColor Yellow
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME/ 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "✅ Bucket ya existe o fue creado" -ForegroundColor Green
}

# 2. Configurar CORS
Write-Host "🌐 Configurando CORS..." -ForegroundColor Yellow
$corsConfig = @"
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
"@
$corsConfig | Out-File -FilePath "cors.json" -Encoding utf8
gsutil cors set cors.json gs://$BUCKET_NAME/
Remove-Item cors.json

# 3. Hacer el bucket público para lectura
Write-Host "🔓 Haciendo el bucket público para lectura..." -ForegroundColor Yellow
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME/

# 4. Dar permisos al Service Account
Write-Host "🔑 Dando permisos al Service Account..." -ForegroundColor Yellow
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member=serviceAccount:$SERVICE_ACCOUNT `
    --role=roles/storage.objectAdmin

# 5. Configurar lifecycle (borrar archivos después de 90 días)
Write-Host "♻️  Configurando lifecycle policy..." -ForegroundColor Yellow
$lifecycleConfig = @"
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
"@
$lifecycleConfig | Out-File -FilePath "lifecycle.json" -Encoding utf8
gsutil lifecycle set lifecycle.json gs://$BUCKET_NAME/
Remove-Item lifecycle.json

Write-Host ""
Write-Host "✅ Configuración completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Información del bucket:" -ForegroundColor Cyan
gsutil ls -L -b gs://$BUCKET_NAME/
Write-Host ""
Write-Host "🎉 Ahora puedes deployar tu aplicación a Cloud Run" -ForegroundColor Green
