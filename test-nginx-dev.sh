#!/bin/bash

# test-nginx-dev.sh - Script para probar la configuración de nginx-dev
# Uso: ./test-nginx-dev.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Verificar que los servicios están corriendo
check_services() {
    print_header "Verificando servicios en ejecución"

    if docker-compose ps | grep -q "Up"; then
        print_success "Servicios Docker están en ejecución"
    else
        print_error "No hay servicios Docker en ejecución"
        echo "Ejecuta primero: ./deploy.sh start dev true"
        exit 1
    fi

    # Verificar servicios específicos
    if docker-compose ps | grep -q "nginx-dev.*Up"; then
        print_success "nginx-dev está en ejecución"
    else
        print_error "nginx-dev no está en ejecución"
    fi

    if docker-compose ps | grep -q "backend.*Up"; then
        print_success "backend está en ejecución"
    else
        print_error "backend no está en ejecución"
    fi

    if docker-compose ps | grep -q "frontend.*Up"; then
        print_success "frontend está en ejecución"
    else
        print_error "frontend no está en ejecución"
    fi
}

# Probar endpoints
test_endpoints() {
    print_header "Probando endpoints HTTP"

    # Probar nginx-dev en puerto 8080
    print_info "Probando nginx-dev (http://localhost:8080)..."
    if curl -s -f http://localhost:8080 > /dev/null; then
        print_success "nginx-dev responde correctamente"
    else
        print_error "nginx-dev no responde"
    fi

    # Probar API a través de nginx
    print_info "Probando API a través de nginx (http://localhost:8080/api/health)..."
    if curl -s -f http://localhost:8080/api/health > /dev/null; then
        print_success "API responde correctamente a través de /api"
    else
        print_error "API no responde a través de /api"
    fi

    # Probar backend directamente (puerto 8000)
    print_info "Probando backend directamente (http://localhost:8000/health)..."
    if curl -s -f http://localhost:8000/health > /dev/null; then
        print_success "Backend responde directamente"
    else
        print_warning "Backend no responde directamente (puede ser normal si solo se usa nginx)"
    fi

    # Probar frontend directamente (puerto 3000)
    print_info "Probando frontend directamente (http://localhost:3000)..."
    if curl -s -f http://localhost:3000 > /dev/null; then
        print_success "Frontend responde directamente"
    else
        print_warning "Frontend no responde directamente (puede ser normal si solo se usa nginx)"
    fi
}

# Probar WebSocket
test_websocket() {
    print_header "Probando WebSocket"

    print_info "Probando WebSocket a través de nginx (ws://localhost:8080/ws/realtime)..."
    # Usar wscat si está disponible, o curl con timeout
    if command -v wscat &> /dev/null; then
        timeout 5 wscat -c ws://localhost:8080/ws/realtime > /dev/null 2>&1 &
        WS_PID=$!
        sleep 2
        if kill -0 $WS_PID 2>/dev/null; then
            print_success "WebSocket conectado correctamente"
            kill $WS_PID 2>/dev/null
        else
            print_error "WebSocket no se pudo conectar"
        fi
    else
        print_warning "wscat no instalado, omitiendo prueba de WebSocket"
        print_info "Instala wscat con: npm install -g wscat"
    fi
}

# Verificar configuración de nginx
check_nginx_config() {
    print_header "Verificando configuración de nginx"

    if [ -f "nginx/nginx-dev.conf" ]; then
        print_success "nginx-dev.conf encontrado"
    else
        print_error "nginx-dev.conf no encontrado"
    fi

    if [ -f "nginx/dev.conf" ]; then
        print_success "dev.conf encontrado"
    else
        print_error "dev.conf no encontrado"
    fi

    # Verificar que los archivos de configuración están montados en el contenedor
    print_info "Verificando montaje de configuración en contenedor nginx-dev..."
    if docker-compose exec nginx-dev ls /etc/nginx/nginx.conf > /dev/null 2>&1; then
        print_success "Configuración nginx montada correctamente"
    else
        print_error "Configuración nginx no montada en el contenedor"
    fi
}

# Mostrar URLs de acceso
show_urls() {
    print_header "URLs de acceso"

    echo -e "${BLUE}Con nginx-dev:${NC}"
    echo "  Aplicación completa: http://localhost:8080"
    echo "  API:                 http://localhost:8080/api"
    echo "  WebSocket:           ws://localhost:8080/ws/realtime"
    echo "  Health API:          http://localhost:8080/api/health"
    echo ""
    echo -e "${BLUE}Directamente (sin nginx):${NC}"
    echo "  Frontend:            http://localhost:3000"
    echo "  Backend API:         http://localhost:8000"
    echo "  Backend WebSocket:   ws://localhost:8000/ws/realtime"
    echo "  Backend Health:      http://localhost:8000/health"
    echo ""
    echo -e "${BLUE}Para desarrollo:${NC}"
    echo "  Iniciar con nginx:   ./deploy.sh start dev true"
    echo "  Hot reload:          ./deploy.sh dev true"
    echo "  Sin nginx:           ./deploy.sh start dev"
    echo "  Hot reload sin nginx: ./deploy.sh dev"
}

# Función principal
main() {
    print_header "Prueba de configuración nginx-dev"

    check_services
    echo ""

    check_nginx_config
    echo ""

    test_endpoints
    echo ""

    test_websocket
    echo ""

    show_urls
    echo ""

    print_header "Resumen"
    print_info "Si todas las pruebas pasaron, nginx-dev está configurado correctamente."
    print_info "Ahora puedes usar VITE_API_URL=/api en el frontend sin modificaciones."
}

# Ejecutar función principal
main
