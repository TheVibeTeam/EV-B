#!/bin/bash

# Script para configurar Google Cloud Storage para Auralix API

PROJECT_ID="pro-platform-470721-v2"
BUCKET_NAME="auralix-uploads"
REGION="us-central1"
SERVICE_ACCOUNT="default@pro-platform-470721-v2.iam.gserviceaccount.com"

echo "🚀 Configurando Google Cloud Storage para Auralix API"
echo ""

# 1. Crear el bucket si no existe
echo "📦 Creando bucket ${BUCKET_NAME}..."
gsutil mb -p ${PROJECT_ID} -c STANDARD -l ${REGION} gs://${BUCKET_NAME}/ 2>/dev/null || echo "✅ Bucket ya existe"

# 2. Configurar CORS para permitir acceso desde el frontend
echo "🌐 Configurando CORS..."
cat > cors.json <<EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://${BUCKET_NAME}/
rm cors.json

# 3. Hacer el bucket público para lectura
echo "🔓 Haciendo el bucket público para lectura..."
gsutil iam ch allUsers:objectViewer gs://${BUCKET_NAME}/

# 4. Dar permisos al Service Account de Cloud Run
echo "🔑 Dando permisos al Service Account..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member=serviceAccount:${SERVICE_ACCOUNT} \
    --role=roles/storage.objectAdmin

# 5. Configurar lifecycle (opcional: borrar archivos antiguos después de 90 días)
echo "♻️  Configurando lifecycle policy..."
cat > lifecycle.json <<EOF
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
EOF

gsutil lifecycle set lifecycle.json gs://${BUCKET_NAME}/
rm lifecycle.json

echo ""
echo "✅ Configuración completada!"
echo ""
echo "📊 Información del bucket:"
gsutil ls -L -b gs://${BUCKET_NAME}/
echo ""
echo "🎉 Ahora puedes deployar tu aplicación a Cloud Run"
