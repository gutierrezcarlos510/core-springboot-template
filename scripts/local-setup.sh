#!/bin/bash
# local-setup.sh — Setup inicial de backend para desarrollo local
# Uso: bash scripts/local-setup.sh NOMBRE_SERVICIO
# Genera: certs JWT, .env, valida Docker

set -e

SERVICE="${1:-demo}"
SERVICE_LOWER=$(echo "$SERVICE" | tr '[:upper:]' '[:lower:]')

echo "⚙️  Setup de backend '$SERVICE' para desarrollo local..."

# 1. Crear directorio de certificados
echo "📁 Creando directorio certs/..."
mkdir -p certs

# 2. Generar claves JWT si no existen
if [ ! -f certs/private_key.pem ] || [ ! -f certs/public_key.pem ]; then
    echo "🔑 Generando claves JWT..."
    openssl genrsa -out certs/private_key.pem 2048 2>/dev/null
    openssl rsa -in certs/private_key.pem -pubout -out certs/public_key.pem 2>/dev/null
    chmod 600 certs/private_key.pem
    echo "✅ Claves JWT creadas"
else
    echo "✅ Claves JWT ya existen"
fi

# 3. Crear .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando .env..."
    cat > .env <<EOF
# Base de datos local
DB_HOST=$SERVICE_LOWER-postgres-dev
DB_PORT=5432
DB_NAME=${SERVICE_LOWER}_db
DB_USER=postgres
DB_PASSWORD=postgres

# JWT local
JWT_PRIVATE_KEY_PATH=file:/app/certs/private_key.pem
JWT_PUBLIC_KEY_PATH=file:/app/certs/public_key.pem

# App
PORT=8080
SPRING_PROFILES_ACTIVE=dev

# CORS
APP_CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:*

# Si necesitas conectar a core-backend
CORE_BASE_URL=http://host.docker.internal:8080/api

# Interna (push notifications, etc.)
PUSH_INTERNAL_API_KEY=dev_key_local_12345
EOF
    echo "✅ .env creado (revisar valores)"
else
    echo "✅ .env ya existe"
fi

# 4. Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no instalado. Instalar e intentar de nuevo."
    exit 1
fi

# 5. Crear .env example si no existe
if [ ! -f .env.example ]; then
    cp .env .env.example
fi

# 6. Git init si needed
if [ ! -d .git ]; then
    echo "📦 Inicializando repo git..."
    git init
    git config user.email "dev@infosystem.local" 2>/dev/null || true
fi

# 7. Pre-commit hooks
if [ ! -d .githooks ]; then
    echo "📋 Instalando pre-commit hooks..."
    mkdir -p .githooks
    cp scripts/.githooks/* .githooks/ 2>/dev/null || true
    git config core.hooksDir .githooks 2>/dev/null || true
fi

echo ""
echo "✅ Setup completado para '$SERVICE'"
echo ""
echo "Próximos pasos:"
echo "  1. Revisar .env con tus valores"
echo "  2. make dev-up       # Levantar Postgres + app"
echo "  3. curl http://localhost:8080/actuator/health"
echo ""
