#!/bin/bash

# deploy.sh - Script para automatizar el despliegue del sistema de monitoreo acústico
# Autor: Sistema de Monitoreo Acústico
# Uso: ./deploy.sh [comando]

set -e  # Salir en error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
PROJECT_NAME="monitoreo-acustico"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

# Funciones de utilidad
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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_dependencies() {
    print_header "Verificando dependencias"
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        echo "Instala Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker está instalado"
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose no está instalado"
        echo "Instala Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose está instalado"
    
    # Verificar archivo .env
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "Archivo $ENV_FILE no encontrado"
        if [ -f ".env.example" ]; then
            print_info "Copiando .env.example a .env"
            cp .env.example .env
            print_warning "Por favor, edita el archivo .env con tus credenciales"
            exit 1
        else
            print_error "No hay archivo .env.example para copiar"
            exit 1
        fi
    fi
    print_success "Archivo $ENV_FILE encontrado"
}

check_config_files() {
    print_header "Verificando archivos de configuración"
    
    # Verificar configuración de sensores en location/
    if [ ! -f "location/sensores.yaml" ]; then
        print_error "Archivo location/sensores.yaml no encontrado"
        print_info "Creando configuración básica de sensores..."
        mkdir -p "location"
        cat > "location/sensores.yaml" << EOF
microcontrollers:
  micro_E1:
    location: [4.609710, -74.081749]
  micro_E2:
    location: [4.599710, -74.091749]
  micro_E3:
    location: [4.619710, -74.071749]
  micro_E4:
    location: [4.629710, -74.061749]
  micro_E5:
    location: [4.639710, -74.051749]
  micro_E255:
    location: [4.649710, -74.041749]
EOF
        print_warning "Configuración de sensores creada. Edita location/sensores.yaml con tus coordenadas reales"
    else
        print_success "Configuración de sensores encontrada en location/sensores.yaml"
    fi
}

build_images() {
    print_header "Construyendo imágenes Docker"
    
    # Construir backend
    print_info "Construyendo imagen del backend..."
    if docker-compose -f "$COMPOSE_FILE" build backend; then
        print_success "Backend construido exitosamente"
    else
        print_error "Error construyendo el backend"
        exit 1
    fi
    
    # Construir frontend
    print_info "Construyendo imagen del frontend..."
    if docker-compose -f "$COMPOSE_FILE" build frontend; then
        print_success "Frontend construido exitosamente"
    else
        print_error "Error construyendo el frontend"
        exit 1
    fi
    
    print_success "Todas las imágenes construidas exitosamente"
}

start_services() {
    print_header "Iniciando servicios"
    
    local services="$1"
    
    if [ -z "$services" ]; then
        services="backend frontend cache"
        print_info "Iniciando servicios principales: $services"
    fi
    
    if docker-compose -f "$COMPOSE_FILE" up -d $services; then
        print_success "Servicios iniciados: $services"
    else
        print_error "Error iniciando servicios"
        exit 1
    fi
}

stop_services() {
    print_header "Deteniendo servicios"
    
    if docker-compose -f "$COMPOSE_FILE" down; then
        print_success "Servicios detenidos"
    else
        print_error "Error deteniendo servicios"
        exit 1
    fi
}

restart_services() {
    print_header "Reiniciando servicios"
    
    if docker-compose -f "$COMPOSE_FILE" restart; then
        print_success "Servicios reiniciados"
    else
        print_error "Error reiniciando servicios"
        exit 1
    fi
}

show_status() {
    print_header "Estado de los servicios"
    
    echo -e "\n${BLUE}Contenedores en ejecución:${NC}"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo -e "\n${BLUE}Logs recientes:${NC}"
    docker-compose -f "$COMPOSE_FILE" logs --tail=10
    
    echo -e "\n${BLUE}Uso de recursos:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" | head -6
    
    # Verificar endpoints
    echo -e "\n${BLUE}Verificando endpoints:${NC}"
    
    # Backend
    if curl -s -f http://localhost:8000/health > /dev/null; then
        print_success "Backend (http://localhost:8000) - ONLINE"
    else
        print_error "Backend (http://localhost:8000) - OFFLINE"
    fi
    
    # Frontend
    if curl -s -f http://localhost:3000 > /dev/null; then
        print_success "Frontend (http://localhost:3000) - ONLINE"
    else
        print_error "Frontend (http://localhost:3000) - OFFLINE"
    fi
    
    # Dash (si está ejecutándose)
    if docker-compose -f "$COMPOSE_FILE" ps dash-app | grep -q "Up"; then
        if curl -s -f http://localhost:8050 > /dev/null; then
            print_success "Dash legacy (http://localhost:8050) - ONLINE"
        else
            print_error "Dash legacy (http://localhost:8050) - OFFLINE"
        fi
    fi
}

show_logs() {
    print_header "Mostrando logs"
    
    local service="$1"
    
    if [ -z "$service" ]; then
        print_info "Mostrando logs de todos los servicios (Ctrl+C para salir)"
        docker-compose -f "$COMPOSE_FILE" logs -f
    else
        print_info "Mostrando logs de $service (Ctrl+C para salir)"
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    fi
}

cleanup() {
    print_header "Limpieza del sistema"
    
    print_warning "Esta acción eliminará contenedores, imágenes y volúmenes no utilizados"
    read -p "¿Continuar? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Eliminando contenedores detenidos..."
        docker-compose -f "$COMPOSE_FILE" down -v
        
        print_info "Eliminando imágenes huérfanas..."
        docker image prune -f
        
        print_info "Eliminando volúmenes no utilizados..."
        docker volume prune -f
        
        print_success "Limpieza completada"
    else
        print_info "Limpieza cancelada"
    fi
}

update_system() {
    print_header "Actualizando sistema"
    
    print_info "Actualizando imágenes Docker..."
    docker-compose -f "$COMPOSE_FILE" pull
    
    print_info "Reconstruyendo servicios..."
    docker-compose -f "$COMPOSE_FILE" up -d --build
    
    print_success "Sistema actualizado"
}

backup_config() {
    print_header "Creando backup de configuración"
    
    local backup_dir="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Copiar archivos importantes
    cp "$ENV_FILE" "$backup_dir/" 2>/dev/null || true
    cp -r "location" "$backup_dir/" 2>/dev/null || true
    cp "$COMPOSE_FILE" "$backup_dir/" 2>/dev/null || true
    
    # Crear archivo de información
    cat > "$backup_dir/INFO.txt" << EOF
Backup creado: $(date)
Sistema: Monitoreo Acústico
Contenido:
- .env (variables de entorno)
- location/ (configuración de sensores)
- docker-compose.yml (configuración de servicios)

Para restaurar:
1. Copiar los archivos de vuelta al directorio principal
2. Ejecutar: ./deploy.sh start
EOF
    
    print_success "Backup creado en: $backup_dir"
    print_info "Contenido:"
    ls -la "$backup_dir/"
}

show_help() {
    print_header "Sistema de Monitoreo Acústico - Script de despliegue"
    
    cat << EOF

Uso: ./deploy.sh [COMANDO]

Comandos disponibles:
  start        Iniciar todos los servicios
  stop         Detener todos los servicios
  restart      Reiniciar todos los servicios
  status       Mostrar estado de los servicios
  logs [servicio] Mostrar logs (todos o de un servicio específico)
  build        Construir imágenes Docker
  update       Actualizar sistema (pull + rebuild)
  backup       Crear backup de configuración
  cleanup      Limpiar contenederos, imágenes y volúmenes no utilizados
  help         Mostrar esta ayuda

Servicios disponibles:
  - backend    (FastAPI + WebSocket + MQTT)
  - frontend   (React + Leaflet)
  - cache      (DragonflyDB/Redis)
  - dash-app   (Dash legacy - opcional)

Ejemplos:
  ./deploy.sh start          # Iniciar sistema completo
  ./deploy.sh logs backend   # Ver logs del backend
  ./deploy.sh status         # Ver estado del sistema
  ./deploy.sh cleanup        # Limpiar recursos Docker

Accesos después del despliegue:
  Frontend React:    http://localhost:3000
  Backend API:       http://localhost:8000
  Dash legacy:       http://localhost:8050 (si se inicia)
  WebSocket:         ws://localhost:8000/ws/realtime

EOF
}

# Manejo de comandos
case "${1:-help}" in
    start)
        check_dependencies
        check_config_files
        build_images
        start_services "$2"
        sleep 5
        show_status
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        sleep 3
        show_status
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    build)
        check_dependencies
        build_images
        ;;
    update)
        update_system
        ;;
    backup)
        backup_config
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Comando no reconocido: $1"
        echo
        show_help
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Script completado${NC}"