#!/bin/bash

PROJECT_ID="tu-project-id"
SERVICE_NAME="auralix-api"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Iniciando deployment a Google Cloud Run..."

echo "📦 Construyendo imagen Docker..."
docker build -t $SERVICE_NAME:latest .

echo "🏷️  Etiquetando imagen..."
docker tag $SERVICE_NAME:latest $IMAGE_NAME:latest

echo "🔐 Configurando autenticación..."
gcloud auth configure-docker

echo "⬆️  Subiendo imagen a GCR..."
docker push $IMAGE_NAME:latest

echo "🚀 Desplegando a Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --set-env-vars "NODE_ENV=production" \
  --project $PROJECT_ID

echo "✅ Deployment completado!"
echo "🌐 URL del servicio:"
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
