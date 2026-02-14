#!/bin/bash

# deploy.sh - Script para automatizar el despliegue del sistema de monitoreo acústico
# Autor: Sistema de Monitoreo Acústico
# Uso: ./deploy.sh [comando] [entorno]
#      entorno: dev (por defecto) o prod

set -e  # Salir en error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
PROJECT_NAME="monitoreo-acustico"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

# Determinar entorno
ENVIRONMENT="${2:-dev}"
if [ "$ENVIRONMENT" = "prod" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi
# Siempre usar .env (compatible con EasyPanel)
ENV_FILE=".env"

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
}

check_environment() {
    local env_file="$1"

    if [ ! -f "$env_file" ]; then
        print_warning "Archivo $env_file no encontrado"
        if [ -f ".env.example" ]; then
            print_info "Copiando .env.example a $env_file"
            cp .env.example "$env_file"
            print_warning "Por favor, edita el archivo $env_file con tus credenciales"
            exit 1
        else
            print_error "No hay archivo .env.example para copiar"
            exit 1
        fi
    fi
    print_success "Archivo $env_file encontrado"
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
    location: [1.5, 3]
    coordinates_type: "relative"
    room: "Exterior 1"
  micro_E2:
    location: [3.5, 2]
    coordinates_type: "relative"
    room: "Exterior 2"
  micro_E3:
    location: [1.5, 7]
    coordinates_type: "relative"
    room: "Sala - Entrada"
  micro_E4:
    location: [1.5, 11]
    coordinates_type: "relative"
    room: "Sala - lavadero"
  micro_E5:
    location: [3.5, 11]
    coordinates_type: "relative"
    room: "Cocina"
  micro_E255:
    location: [3.5, 6]
    coordinates_type: "relative"
    room: "Oficina"
EOF
        print_warning "Configuración de sensores creada. Edita location/sensores.yaml con tus coordenadas reales"
    else
        print_success "Configuración de sensores encontrada en location/sensores.yaml"
    fi
}

build_images() {
    local compose_file="$1"
    print_header "Construyendo imágenes Docker"

    # Construir backend
    print_info "Construyendo imagen del backend..."
    if docker-compose -f "$compose_file" build backend; then
        print_success "Backend construido exitosamente"
    else
        print_error "Error construyendo el backend"
        exit 1
    fi

    # Construir frontend
    print_info "Construyendo imagen del frontend..."
    if docker-compose -f "$compose_file" build frontend; then
        print_success "Frontend construido exitosamente"
    else
        print_error "Error construyendo el frontend"
        exit 1
    fi

    print_success "Todas las imágenes construidas exitosamente"
}

start_services() {
    local compose_file="$1"
    local env_file="$2"
    local services="$3"

    print_header "Iniciando servicios"

    if [ -z "$services" ]; then
        services="backend frontend cache"
        print_info "Iniciando servicios principales: $services"
    fi

    if [ -n "$env_file" ]; then
        if docker-compose -f "$compose_file" --env-file "$env_file" up -d $services; then
            print_success "Servicios iniciados: $services"
        else
            print_error "Error iniciando servicios"
            exit 1
        fi
    else
        if docker-compose -f "$compose_file" up -d $services; then
            print_success "Servicios iniciados: $services"
        else
            print_error "Error iniciando servicios"
            exit 1
        fi
    fi
}

stop_services() {
    local compose_file="$1"
    print_header "Deteniendo servicios"

    if docker-compose -f "$compose_file" down; then
        print_success "Servicios detenidos"
    else
        print_error "Error deteniendo servicios"
        exit 1
    fi
}

restart_services() {
    local compose_file="$1"
    local env_file="$2"
    print_header "Reiniciando servicios"

    if [ -n "$env_file" ]; then
        if docker-compose -f "$compose_file" --env-file "$env_file" restart; then
            print_success "Servicios reiniciados"
        else
            print_error "Error reiniciando servicios"
            exit 1
        fi
    else
        if docker-compose -f "$compose_file" restart; then
            print_success "Servicios reiniciados"
        else
            print_error "Error reiniciando servicios"
            exit 1
        fi
    fi
}

show_status() {
    local compose_file="$1"
    local environment="$2"
    print_header "Estado de los servicios"

    echo -e "\n${BLUE}Contenedores en ejecución:${NC}"
    docker-compose -f "$compose_file" ps

    echo -e "\n${BLUE}Logs recientes:${NC}"
    docker-compose -f "$compose_file" logs --tail=10

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

    # Cache - Determinar nombre del contenedor según entorno
    local cache_container_name
    if [ "$environment" = "prod" ]; then
        cache_container_name="monitoreo-cache-prod"
    else
        # En desarrollo, usar el nombre por defecto de docker-compose
        cache_container_name="micropython_sound-cache-1"
    fi

    # Verificar cache usando redis-cli desde fuera del contenedor primero
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q "PONG"; then
            print_success "Cache DragonflyDB (localhost:6379) - ONLINE"
        else
            # Intentar con docker exec como fallback
            if docker exec "$cache_container_name" redis-cli ping 2>/dev/null | grep -q "PONG"; then
                print_success "Cache DragonflyDB (localhost:6379) - ONLINE"
            else
                print_warning "Cache DragonflyDB (localhost:6379) - OFFLINE"
            fi
        fi
    else
        # Si redis-cli no está instalado, usar docker exec
        if docker exec "$cache_container_name" redis-cli ping 2>/dev/null | grep -q "PONG"; then
            print_success "Cache DragonflyDB (localhost:6379) - ONLINE"
        else
            print_warning "Cache DragonflyDB (localhost:6379) - OFFLINE"
        fi
    fi
}

show_logs() {
    local compose_file="$1"
    local service="$2"

    print_header "Mostrando logs"

    if [ -z "$service" ]; then
        print_info "Mostrando logs de todos los servicios (Ctrl+C para salir)"
        docker-compose -f "$compose_file" logs -f
    else
        print_info "Mostrando logs de $service (Ctrl+C para salir)"
        docker-compose -f "$compose_file" logs -f "$service"
    fi
}

cleanup() {
    local compose_file="$1"
    print_header "Limpieza del sistema"

    print_warning "Esta acción eliminará contenedores, imágenes y volúmenes no utilizados"
    read -p "¿Continuar? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Eliminando contenedores detenidos..."
        docker-compose -f "$compose_file" down -v

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
    local compose_file="$1"
    local env_file="$2"
    print_header "Actualizando sistema"

    print_info "Reconstruyendo servicios..."
    if [ -n "$env_file" ]; then
        docker-compose -f "$compose_file" --env-file "$env_file" up -d --build
    else
        docker-compose -f "$compose_file" up -d --build
    fi

    print_success "Sistema actualizado"
}

backup_config() {
    local compose_file="$1"
    local env_file="$2"
    print_header "Creando backup de configuración"

    local backup_dir="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    # Copiar archivos importantes
    if [ -f "$env_file" ]; then
        cp "$env_file" "$backup_dir/" 2>/dev/null || true
    fi
    cp -r "location" "$backup_dir/" 2>/dev/null || true
    cp "$compose_file" "$backup_dir/" 2>/dev/null || true
    cp "docker-compose.yml" "$backup_dir/" 2>/dev/null || true
    cp "docker-compose.prod.yml" "$backup_dir/" 2>/dev/null || true

    # Crear archivo de información
    cat > "$backup_dir/INFO.txt" << EOF
Backup creado: $(date)
Sistema: Monitoreo Acústico
Entorno: $ENVIRONMENT
Contenido:
- Variables de entorno
- Configuración de sensores
- Configuración de servicios Docker

Para restaurar:
1. Copiar los archivos de vuelta al directorio principal
2. Ejecutar: ./deploy.sh start $ENVIRONMENT
EOF

    print_success "Backup creado en: $backup_dir"
    print_info "Contenido:"
    ls -la "$backup_dir/"
}

show_help() {
    print_header "Sistema de Monitoreo Acústico - Script de despliegue"

    cat << EOF

Uso: ./deploy.sh [COMANDO] [ENTORNO]

Comandos disponibles:
  start        Iniciar todos los servicios
  stop         Detener todos los servicios
  restart      Reiniciar todos los servicios
  status       Mostrar estado de los servicios
  logs [servicio] Mostrar logs (todos o de un servicio específico)
  build        Construir imágenes Docker
  update       Actualizar sistema (rebuild)
  backup       Crear backup de configuración
  cleanup      Limpiar contenederos, imágenes y volúmenes no utilizados
  help         Mostrar esta ayuda

Entornos disponibles:
  dev          Desarrollo (por defecto) - usa docker-compose.yml
  prod         Producción - usa docker-compose.prod.yml

Nota: Ambos entornos usan el mismo archivo .env (compatible con EasyPanel)

Servicios disponibles:
  - backend    (FastAPI + WebSocket + MQTT)
  - frontend   (React + Leaflet)
  - cache      (DragonflyDB/Redis)

Ejemplos:
  ./deploy.sh start          # Iniciar desarrollo
  ./deploy.sh start prod     # Iniciar producción
  ./deploy.sh logs backend   # Ver logs del backend
  ./deploy.sh status prod    # Ver estado de producción
  ./deploy.sh cleanup        # Limpiar recursos Docker

Accesos después del despliegue:
  Frontend React:    http://localhost:3000
  Backend API:       http://localhost:8000
  WebSocket:         ws://localhost:8000/ws/realtime

EOF
}

# Manejo de comandos
case "${1:-help}" in
    start)
        check_dependencies
        check_environment "$ENV_FILE"
        check_config_files
        build_images "$COMPOSE_FILE"
        start_services "$COMPOSE_FILE" "$ENV_FILE" "$3"
        sleep 5
        show_status "$COMPOSE_FILE" "$ENVIRONMENT"
        ;;
    stop)
        check_dependencies
        stop_services "$COMPOSE_FILE"
        ;;
    restart)
        check_dependencies
        check_environment "$ENV_FILE"
        restart_services "$COMPOSE_FILE" "$ENV_FILE"
        sleep 3
        show_status "$COMPOSE_FILE" "$ENVIRONMENT"
        ;;
    status)
        check_dependencies
        show_status "$COMPOSE_FILE" "$ENVIRONMENT"
        ;;
    logs)
        check_dependencies
        show_logs "$COMPOSE_FILE" "$3"
        ;;
    build)
        check_dependencies
        check_environment "$ENV_FILE"
        build_images "$COMPOSE_FILE"
        ;;
    update)
        check_dependencies
        check_environment "$ENV_FILE"
        update_system "$COMPOSE_FILE" "$ENV_FILE"
        ;;
    backup)
        backup_config "$COMPOSE_FILE" "$ENV_FILE"
        ;;
    cleanup)
        check_dependencies
        cleanup "$COMPOSE_FILE"
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
