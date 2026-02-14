#!/bin/bash

# check_nginx.sh - Verifica que nginx esté funcionando correctamente
# Uso: ./check_nginx.sh [host]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Host por defecto
HOST="${1:-localhost}"

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

echo "========================================"
echo "  Verificación de configuración Nginx"
echo "========================================"
echo "Host: $HOST"
echo ""

# Verificar que nginx está corriendo
print_info "1. Verificando servicio nginx..."
if docker ps --format '{{.Names}}' | grep -q "monitoreo-nginx-prod"; then
    print_success "Contenedor nginx está corriendo"

    # Verificar estado del contenedor
    CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' monitoreo-nginx-prod 2>/dev/null || echo "no encontrado")
    if [ "$CONTAINER_STATUS" = "running" ]; then
        print_success "Contenedor nginx está en estado 'running'"
    else
        print_error "Contenedor nginx está en estado '$CONTAINER_STATUS'"
    fi
else
    print_error "Contenedor nginx NO está corriendo"
fi

echo ""

# Verificar endpoints
print_info "2. Verificando endpoints HTTP..."

# Endpoint raíz (frontend)
if curl -s -f "http://$HOST" > /dev/null; then
    print_success "Endpoint raíz (/) responde correctamente"
else
    print_error "Endpoint raíz (/) NO responde"
fi

# Endpoint API
if curl -s -f "http://$HOST/api/health" > /dev/null; then
    print_success "Endpoint API (/api/health) responde correctamente"
else
    print_error "Endpoint API (/api/health) NO responde"
fi

# Endpoint frontend health
if curl -s -f "http://$HOST/healthz" > /dev/null; then
    print_success "Endpoint healthz (/healthz) responde correctamente"
else
    print_warning "Endpoint healthz (/healthz) NO responde (puede ser normal)"
fi

echo ""

# Verificar WebSocket
print_info "3. Verificando configuración WebSocket..."
# Intentar conexión WebSocket básica
if command -v wscat &> /dev/null; then
    echo "Probando WebSocket con wscat..."
    timeout 5 wscat -c "ws://$HOST/ws/realtime" || echo "WebSocket test completado"
elif command -v websocat &> /dev/null; then
    echo "Probando WebSocket con websocat..."
    timeout 5 websocat "ws://$HOST/ws/realtime" || echo "WebSocket test completado"
else
    print_info "Instalando wscat para prueba WebSocket..."
    npm install -g wscat 2>/dev/null || echo "No se pudo instalar wscat"
fi

echo ""

# Verificar configuración nginx
print_info "4. Verificando configuración nginx interna..."
if docker exec monitoreo-nginx-prod nginx -t 2>/dev/null; then
    print_success "Configuración nginx es válida"
else
    print_error "Configuración nginx tiene errores"

    # Mostrar logs de error
    echo "Últimos logs de nginx:"
    docker logs --tail=10 monitoreo-nginx-prod 2>/dev/null | tail -10
fi

echo ""

# Verificar conectividad con servicios internos
print_info "5. Verificando conectividad interna..."

# Verificar frontend
if docker exec monitoreo-nginx-prod curl -s -f http://frontend:3000 > /dev/null 2>&1; then
    print_success "Nginx puede conectar con frontend (frontend:3000)"
else
    print_error "Nginx NO puede conectar con frontend"
fi

# Verificar backend
if docker exec monitoreo-nginx-prod curl -s -f http://backend:8000/health > /dev/null 2>&1; then
    print_success "Nginx puede conectar con backend (backend:8000)"
else
    print_error "Nginx NO puede conectar con backend"
fi

echo ""

# Resumen
print_info "RESUMEN DE VERIFICACIÓN:"
echo "========================================"

# Contar éxitos y errores
SUCCESS_COUNT=$(grep -c "✓" <<< "$(cat /proc/self/fd/1)")
ERROR_COUNT=$(grep -c "✗" <<< "$(cat /proc/self/fd/1)")

if [ $ERROR_COUNT -eq 0 ]; then
    print_success "TODAS las verificaciones pasaron ($SUCCESS_COUNT/$(($SUCCESS_COUNT + $ERROR_COUNT)))"
    echo ""
    print_info "Accesos disponibles:"
    echo "  - Aplicación: http://$HOST"
    echo "  - API: http://$HOST/api"
    echo "  - WebSocket: ws://$HOST/ws/realtime"
    echo "  - Health: http://$HOST/health"
    echo ""
    print_success "✅ Nginx está configurado correctamente"
else
    print_error "Algunas verificaciones fallaron ($ERROR_COUNT errores)"
    echo ""
    print_info "Solución de problemas:"
    echo "  1. Verifica que todos los servicios estén corriendo:"
    echo "     docker-compose -f docker-compose.prod.yml ps"
    echo "  2. Revisa logs de nginx:"
    echo "     docker logs monitoreo-nginx-prod"
    echo "  3. Verifica configuración nginx:"
    echo "     docker exec monitoreo-nginx-prod nginx -t"
    echo "  4. Reconstruye servicios si es necesario:"
    echo "     docker-compose -f docker-compose.prod.yml up -d --build"
fi

echo "========================================"
