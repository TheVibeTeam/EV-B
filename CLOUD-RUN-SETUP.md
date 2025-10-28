# Guía de Configuración para Google Cloud Run

## Paso 1: Preparar el proyecto

1. Instalar dependencias actualizadas:
```bash
npm install
```

2. Compilar el proyecto:
```bash
npm run build
```

## Paso 2: Configurar Google Cloud

1. Instalar Google Cloud SDK (gcloud CLI)
2. Autenticarse:
```bash
gcloud auth login
```

3. Configurar proyecto:
```bash
gcloud config set project TU-PROJECT-ID
```

4. Habilitar APIs necesarias:
```bash
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

## Paso 3: Configurar Secrets en Google Secret Manager

Para variables sensibles como JWT_SECRET y SESSION_SECRET:

```bash
# Crear secrets
echo -n "tu-jwt-secret-aqui" | gcloud secrets create jwt-secret --data-file=-
echo -n "tu-session-secret-aqui" | gcloud secrets create session-secret --data-file=-
echo -n "mongodb+srv://..." | gcloud secrets create mongodb-url --data-file=-

# Dar permisos a Cloud Run
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Paso 4: Configurar MongoDB Atlas

1. Crear cluster en MongoDB Atlas
2. Agregar IPs de Cloud Run a whitelist (0.0.0.0/0 para permitir todas)
3. Crear usuario con permisos de lectura/escritura
4. Copiar connection string

## Paso 5: Build y Deploy

### Opción A: Usando script automatizado
```bash
chmod +x deploy-cloud-run.sh
./deploy-cloud-run.sh
```

### Opción B: Manual

1. Construir imagen:
```bash
docker build -t gcr.io/TU-PROJECT-ID/backend-api:latest .
```

2. Subir a GCR:
```bash
docker push gcr.io/TU-PROJECT-ID/backend-api:latest
```

3. Desplegar:
```bash
gcloud run deploy backend-api \
  --image gcr.io/TU-PROJECT-ID/backend-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets "JWT_SECRET=jwt-secret:latest,SESSION_SECRET=session-secret:latest,MONGODB_URL=mongodb-url:latest" \
  --set-env-vars "NODE_ENV=production,WEBSERVER_NAME=Auralix API,FRONTEND_URL=https://theearthvibe.xyz"
```

## Paso 6: Configurar variables de entorno en Cloud Run

En la consola de Google Cloud o mediante CLI:

```bash
gcloud run services update backend-api \
  --region us-central1 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "WEBSERVER_NAME=Auralix API" \
  --set-env-vars "FRONTEND_URL=https://theearthvibe.xyz" \
  --set-env-vars "COOKIE_DOMAIN=.theearthvibe.xyz" \
  --set-env-vars "MONGODB_DB_NAME=production_db"
```

## Paso 7: Configurar dominio personalizado (opcional)

1. En Cloud Run, ir a "Manage Custom Domains"
2. Agregar dominio verificado
3. Configurar DNS según instrucciones

## Paso 8: Monitoreo y Logs

Ver logs en tiempo real:
```bash
gcloud run services logs tail backend-api --region us-central1
```

Ver métricas en Cloud Console:
- CPU, memoria, latencia
- Requests por segundo
- Errores y crashes

## Consideraciones Importantes

### Socket.IO en Cloud Run
- Cloud Run tiene timeout de 60 minutos para conexiones HTTP
- Para WebSockets de larga duración, considerar:
  - Google Kubernetes Engine (GKE)
  - Usar adaptador Socket.IO con Redis
  - Implementar reconexión automática en cliente

### Almacenamiento de archivos
- NO usar sistema de archivos local
- Migrar a Google Cloud Storage:
```bash
npm install @google-cloud/storage
```

### Sesiones persistentes
- Ya configurado con connect-mongo
- Las sesiones se almacenan en MongoDB
- Funciona con múltiples instancias

### Base de datos
- SQLite REMOVIDO (no compatible)
- Usar MongoDB Atlas exclusivamente
- Configurar índices para mejor performance

### Escalado automático
- Min instances: 0 (para ahorrar costos)
- Max instances: 10 (ajustar según necesidad)
- Concurrency: 80 requests por instancia

### Costos
- Free tier: 2 millones requests/mes
- Cobra por CPU/memoria/tiempo
- Min instances > 0 cobra siempre

## Troubleshooting

### Error de puerto
- Cloud Run asigna PORT automáticamente
- El código ya está configurado para usar process.env.PORT

### Error de conexión MongoDB
- Verificar whitelist de IPs en Atlas
- Verificar credenciales en Secret Manager
- Revisar logs: `gcloud run services logs`

### Cold starts lentos
- Aumentar min-instances a 1 o más
- Reducir tamaño de imagen Docker
- Optimizar tiempo de inicio de app

### Errores de CORS
- Verificar FRONTEND_URL en variables de entorno
- Revisar configuración de origins en server.ts

## Actualizar deployment

Para actualizar código:
```bash
npm run build
docker build -t gcr.io/TU-PROJECT-ID/backend-api:latest .
docker push gcr.io/TU-PROJECT-ID/backend-api:latest
gcloud run deploy backend-api --image gcr.io/TU-PROJECT-ID/backend-api:latest --region us-central1
```

## Rollback a versión anterior

```bash
gcloud run services update-traffic backend-api \
  --to-revisions=REVISION-NAME=100 \
  --region us-central1
```
