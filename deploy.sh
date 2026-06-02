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

# Configuración de logs (estilo Minecraft)
LOG_DIR="${LOG_DIR:-./logs}"
LOG_MAX_SIZE_MB=${LOG_MAX_SIZE_MB:-10}
LOG_MAX_FILES=${LOG_MAX_FILES:-5}
mkdir -p "$LOG_DIR"

# Determinar si usar nginx en desarrollo
if [ "$ENVIRONMENT" = "dev" ] && [ "$3" = "true" ]; then
    NGINX_DEV_ENABLED=true
    print_info "Modo desarrollo con nginx habilitado"
else
    NGINX_DEV_ENABLED=false
fi

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
    local environment="$2"
    print_header "Construyendo imágenes Docker"

    if [ "$environment" = "prod" ]; then
        # En producción: construir nginx (que incluye frontend) y backend
        print_info "Construyendo imagen del backend..."
        if docker-compose -f "$compose_file" build backend; then
            print_success "Backend construido exitosamente"
        else
            print_error "Error construyendo el backend"
            exit 1
        fi

        print_info "Construyendo imagen de nginx (con frontend incluido)..."
        if docker-compose -f "$compose_file" build nginx; then
            print_success "Nginx construido exitosamente"
        else
            print_error "Error construyendo nginx"
            exit 1
        fi
    else
        # En desarrollo: construir backend y frontend por separado
        print_info "Construyendo imagen del backend..."
        if docker-compose -f "$compose_file" build backend; then
            print_success "Backend construido exitosamente"
        else
            print_error "Error construyendo el backend"
            exit 1
        fi

        print_info "Construyendo imagen del frontend..."
        if docker-compose -f "$compose_file" build frontend; then
            print_success "Frontend construido exitosamente"
        else
            print_error "Error construyendo el frontend"
            exit 1
        fi

        # Construir nginx-dev si está habilitado
        if [ "$NGINX_DEV_ENABLED" = true ]; then
            print_info "Construyendo imagen de nginx-dev..."
            if docker-compose -f "$compose_file" build nginx-dev; then
                print_success "Nginx-dev construido exitosamente"
            else
                print_error "Error construyendo nginx-dev"
                exit 1
            fi
        fi
    fi

    # Construir cache (siempre)
    print_info "Construyendo imagen del cache..."
    if docker-compose -f "$compose_file" build cache; then
        print_success "Cache construido exitosamente"
    else
        print_error "Error construyendo el cache"
        exit 1
    fi

    print_success "Todas las imágenes construidas exitosamente"
}

start_services() {
    local compose_file="$1"
    local env_file="$2"
    local services="$3"
    local environment="$4"

    print_header "Iniciando servicios"

    if [ -z "$services" ]; then
        if [ "$environment" = "prod" ]; then
            services="nginx backend cache"
            print_info "Iniciando servicios de producción: $services"
        else
            if [ "$NGINX_DEV_ENABLED" = true ]; then
                services="nginx-dev backend frontend cache"
                print_info "Iniciando servicios de desarrollo con nginx: $services"
            else
                services="backend frontend cache"
                print_info "Iniciando servicios principales: $services"
            fi
        fi
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

dev_services() {
    local compose_file="$1"
    local env_file="$2"
    local services="$3"
    local environment="$4"

    print_header "Iniciando servicios en modo desarrollo (sin reconstruir imágenes)"

    if [ -z "$services" ]; then
        if [ "$environment" = "prod" ]; then
            services="nginx backend cache"
            print_info "Iniciando servicios de producción: $services"
        else
            if [ "$NGINX_DEV_ENABLED" = true ]; then
                services="nginx-dev backend frontend cache"
                print_info "Iniciando servicios de desarrollo con nginx: $services"
            else
                services="backend frontend cache"
                print_info "Iniciando servicios principales: $services"
            fi
        fi
    fi

    if [ -n "$env_file" ]; then
        if docker-compose -f "$compose_file" --env-file "$env_file" up $services; then
            print_success "Servicios iniciados en modo desarrollo (ejecutando en primer plano): $services"
            print_info "Los cambios en el código se reflejarán automáticamente con hot reload"
            print_info "Presione Ctrl+C para detener los servicios"
        else
            print_error "Error iniciando servicios"
            exit 1
        fi
    else
        if docker-compose -f "$compose_file" up $services; then
            print_success "Servicios iniciados en modo desarrollo (ejecutando en primer plano): $services"
            print_info "Los cambios en el código se reflejarán automáticamente con hot reload"
            print_info "Presione Ctrl+C para detener los servicios"
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
    local environment="$3"
    print_header "Reiniciando servicios"

    # Determinar qué servicios reiniciar
    local services=""
    if [ "$environment" = "prod" ]; then
        services="nginx backend cache"
    else
        if [ "$NGINX_DEV_ENABLED" = true ]; then
            services="nginx-dev backend frontend cache"
        else
            services="backend frontend cache"
        fi
    fi

    if [ -n "$env_file" ]; then
        if docker-compose -f "$compose_file" --env-file "$env_file" restart $services; then
            print_success "Servicios reiniciados: $services"
        else
            print_error "Error reiniciando servicios"
            exit 1
        fi
    else
        if docker-compose -f "$compose_file" restart $services; then
            print_success "Servicios reiniciados: $services"
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

    # Nginx (si está configurado)
    if [ "$environment" = "prod" ]; then
        if curl -s -f http://localhost:8082/health > /dev/null; then
            print_success "Nginx (http://localhost:8082) - ONLINE"
        else
            print_warning "Nginx (http://localhost:8082) - OFFLINE"
        fi
    elif [ "$NGINX_DEV_ENABLED" = true ]; then
        if curl -s -f http://localhost:8080/health > /dev/null; then
            print_success "Nginx-dev (http://localhost:8080) - ONLINE"
        else
            print_warning "Nginx-dev (http://localhost:8080) - OFFLINE"
        fi
    fi

    # Backend - puertos diferentes según entorno
    if [ "$environment" = "prod" ]; then
        # En producción, backend expuesto en 18081 directamente
        if curl -s -f http://localhost:18081/health > /dev/null; then
            print_success "Backend (http://localhost:18081) - ONLINE"
        else
            print_error "Backend (http://localhost:18081) - OFFLINE"
        fi
    else
        if [ "$NGINX_DEV_ENABLED" = true ]; then
            # En desarrollo con nginx, backend accesible a través de /api
            if curl -s -f http://localhost:8080/api/health > /dev/null; then
                print_success "Backend (http://localhost:8080/api) - ONLINE"
            else
                print_error "Backend (http://localhost:8080/api) - OFFLINE"
            fi
        else
            # En desarrollo sin nginx, backend en puerto 8000
            if curl -s -f http://localhost:8000/health > /dev/null; then
                print_success "Backend (http://localhost:8000) - ONLINE"
            else
                print_error "Backend (http://localhost:8000) - OFFLINE"
            fi
        fi
    fi

    # Frontend (solo en desarrollo)
    if [ "$environment" != "prod" ]; then
        if [ "$NGINX_DEV_ENABLED" = true ]; then
            # En desarrollo con nginx, frontend accesible a través de nginx
            if curl -s -f http://localhost:8080 > /dev/null; then
                print_success "Frontend (http://localhost:8080) - ONLINE"
            else
                print_error "Frontend (http://localhost:8080) - OFFLINE"
            fi
        else
            # En desarrollo sin nginx, frontend en puerto 3000
            if curl -s -f http://localhost:3000 > /dev/null; then
                print_success "Frontend (http://localhost:3000) - ONLINE"
            else
                print_error "Frontend (http://localhost:3000) - OFFLINE"
            fi
        fi
    fi

    # Cache - Determinar nombre del contenedor según entorno
    local cache_container_name
    if [ "$environment" = "prod" ]; then
        cache_container_name="monitoreo-cache-prod"
    else
        # En desarrollo, usar el nombre por defecto de docker-compose
        # Obtener el nombre real del contenedor cache
        cache_container_name=$(docker-compose -f "$compose_file" ps -q cache 2>/dev/null | head -1)
        if [ -z "$cache_container_name" ]; then
            cache_container_name="micropython_sound-cache-1"
        else
            # Obtener el nombre completo del contenedor
            cache_container_name=$(docker inspect --format='{{.Name}}' "$cache_container_name" 2>/dev/null | sed 's/^\///')
            if [ -z "$cache_container_name" ]; then
                cache_container_name="micropython_sound-cache-1"
            fi
        fi
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

# Función principal para manejar comandos de logs (evita local fuera de función)
handle_logs_command() {
    local log_subcommand="${1:-show}"
    local log_param="${2:-}"
    local log_third="${3:-}"

    # Determinar servicio y líneas según el subcomando
    local log_service=""
    local log_lines="100"

    case "$log_subcommand" in
        show)
            log_service="$log_param"
            show_logs "$COMPOSE_FILE" "$log_service"
            ;;
        last|recent)
            # Si log_param es numérico, es el número de líneas, si no es el servicio
            if [[ "$log_param" =~ ^[0-9]+$ ]]; then
                log_lines="$log_param"
                # log_third sería el servicio si se pasó
                log_service="$log_third"
            else
                log_service="$log_param"
                log_lines="${log_third:-100}"
            fi
            view_recent_logs "$log_service" "$log_lines"
            ;;
        list)
            list_logs
            ;;
        clean)
            clean_old_logs
            ;;
        *)
            print_info "Uso: $0 logs [show|last|list|clean] [servicio] [líneas]"
            echo
            echo "  show    - Mostrar logs en tiempo real y guardar (por defecto)"
            echo "  last    - Ver últimos logs guardados"
            echo "  list    - Listar archivos de log disponibles"
            echo "  clean   - Limpiar logs antiguos"
            echo
            echo "  Ejemplos:"
            echo "    $0 logs show           # Ver todos los logs en tiempo real"
            echo "    $0 logs show backend   # Ver logs del backend"
            echo "    $0 logs last           # Ver últimos 100 líneas guardadas"
            echo "    $0 logs last backend   # Ver últimos logs del backend"
            echo "    $0 logs last 50        # Ver últimas 50 líneas"
            echo "    $0 logs last 50 backend  # Ver últimas 50 líneas del backend"
            echo "    $0 logs list           # Listar archivos"
            echo "    $0 logs clean          # Limpiar logs antiguos"
            ;;
    esac
}

show_logs() {
    local compose_file="$1"
    local service="$2"
    local timestamp
    timestamp=$(date +"%Y-%m-%d_%H-%M-%S")

    print_header "Mostrando/M guardando logs"

    # Función interna para rotar logs si es necesario
    rotate_logs_if_needed() {
        local log_file="$1"
        if [ -f "$log_file" ]; then
            local size_mb
            size_mb=$(du -m "$log_file" 2>/dev/null | cut -f1 || echo "0")
            if [ "$size_mb" -ge "$LOG_MAX_SIZE_MB" ]; then
                mv "$log_file" "${log_file}.old"
                # Comprimir el archivo antiguo
                gzip -9 "${log_file}.old" &
            fi
        fi
    }

    if [ -z "$service" ]; then
        local current_log="$LOG_DIR/${ENVIRONMENT}_all_${timestamp}.log"
        print_info "Guardando logs en: $current_log"
        print_info "Mostrando en tiempo real (Ctrl+C para salir)..."
        docker-compose -f "$compose_file" logs -f --timestamps 2>&1 | tee "$current_log"
    else
        local current_log="$LOG_DIR/${ENVIRONMENT}_${service}_${timestamp}.log"
        print_info "Guardando logs en: $current_log"
        print_info "Mostrando logs de $service en tiempo real (Ctrl+C para salir)..."
        docker-compose -f "$compose_file" logs -f "$service" --timestamps 2>&1 | tee "$current_log"
    fi
}

# Función para ver últimos logs guardados (sin seguir)
view_recent_logs() {
    local service="${1:-all}"
    local lines="${2:-100}"

    print_header "Últimos logs guardados"

    if [ "$service" = "all" ]; then
        local latest_log
        latest_log=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)
        if [ -n "$latest_log" ]; then
            print_info "Mostrando últimas $lines líneas de: $latest_log"
            tail -n "$lines" "$latest_log"
        else
            print_warning "No hay logs guardados"
        fi
    else
        local latest_log
        latest_log=$(ls -t "$LOG_DIR"/${ENVIRONMENT}_${service}_*.log 2>/dev/null | head -1)
        if [ -n "$latest_log" ]; then
            print_info "Mostrando últimas $lines líneas de: $latest_log"
            tail -n "$lines" "$latest_log"
        else
            print_warning "No hay logs guardados para el servicio: $service"
        fi
    fi
}

# Función para listar archivos de log disponibles
list_logs() {
    print_header "Archivos de log disponibles"

    if ls "$LOG_DIR"/*.log* &>/dev/null; then
        echo
        ls -lh "$LOG_DIR"/*.log* 2>/dev/null | tail -20
        echo
        print_info "Ubicación: $LOG_DIR"
    else
        print_warning "No hay archivos de log"
    fi
}

# Función para limpiar logs antiguos
clean_old_logs() {
    print_header "Limpiando logs antiguos"

    # Contar archivos
    local total_logs
    total_logs=$(ls "$LOG_DIR"/*.log* 2>/dev/null | wc -l)

    if [ "$total_logs" -gt "$LOG_MAX_FILES" ]; then
        print_info "Eliminando logs antiguos (manteniendo últimos $LOG_MAX_FILES)..."
        ls -t "$LOG_DIR"/*.log* 2>/dev/null | tail -n +$((LOG_MAX_FILES + 1)) | xargs rm -f 2>/dev/null
        print_success "Limpieza completada"
    else
        print_info "No hay logs antiguos que eliminar"
    fi
}

cleanup() {
    local compose_file="$1"
    print_header "Limpieza del sistema"

    print_warning "Esta acción detendrá y eliminará todos los contenedores, imágenes y volúmenes"
    read -p "¿Continuar? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Deteniendo y eliminando contenedores..."
        docker-compose -f "$compose_file" down -v --remove-orphans

        print_info "Eliminando imágenes huérfanas..."
        docker image prune -af

        print_info "Eliminando volúmenes no utilizados..."
        docker volume prune -af

        print_info "Eliminando redes no utilizadas..."
        docker network prune -f

        print_success "Limpieza completada"
    else
        print_info "Limpieza cancelada"
    fi
}

update_system() {
    local compose_file="$1"
    local env_file="$2"
    local environment="$3"
    print_header "Actualizando sistema"

    # Determinar qué servicios actualizar
    local services=""
    if [ "$environment" = "prod" ]; then
        services="nginx backend cache"
        print_info "Actualizando servicios de producción: $services"
    else
        if [ "$NGINX_DEV_ENABLED" = true ]; then
            services="nginx-dev backend frontend cache"
            print_info "Actualizando servicios de desarrollo con nginx: $services"
        else
            services="backend frontend cache"
            print_info "Actualizando servicios: $services"
        fi
    fi

    print_info "Reconstruyendo servicios..."
    if [ -n "$env_file" ]; then
        docker-compose -f "$compose_file" --env-file "$env_file" up -d --build $services
    else
        docker-compose -f "$compose_file" up -d --build $services
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
  dev          Iniciar servicios en modo desarrollo (primer plano, hot reload)
  stop         Detener todos los servicios
  restart      Reiniciar todos los servicios
  status       Mostrar estado de los servicios
  logs         Sistema de logs (ver abajo para subcomandos)
  build        Construir imágenes Docker
  update       Actualizar sistema (rebuild)
  backup       Crear backup de configuración
  cleanup      Limpiar contenedores, imágenes y volúmenes no utilizados
  help         Mostrar esta ayuda

Subcomandos de logs:
  logs show [servicio]   - Mostrar logs en tiempo real y guardar en ./logs/
  logs last [servicio] [n] - Ver últimos n líneas de logs guardados (default: 100)
  logs list             - Listar archivos de log disponibles
  logs clean            - Limpiar logs antiguos (mantiene últimos $LOG_MAX_FILES)

  Ejemplos:
    ./deploy.sh logs show           # Ver todos los logs en tiempo real
    ./deploy.sh logs show backend   # Ver logs del backend
    ./deploy.sh logs last           # Ver últimos 100 líneas guardadas
    ./deploy.sh logs last backend 50  # Ver últimas 50 líneas del backend
    ./deploy.sh logs list           # Listar archivos de log
    ./deploy.sh logs clean          # Limpiar logs antiguos

Entornos disponibles:
  dev          Desarrollo (por defecto) - usa docker-compose.yml
  prod         Producción - usa docker-compose.prod.yml

Opciones para desarrollo:
  true         Habilitar nginx en desarrollo (tercer parámetro)
               Ejemplo: ./deploy.sh start dev true

Parámetros:
  COMANDO      Comando a ejecutar (start, dev, stop, etc.)
  ENTORNO      Entorno (dev o prod)
  [NGINX]      Solo para desarrollo: "true" para habilitar nginx-dev

Nota: Ambos entornos usan el mismo archivo .env (compatible con EasyPanel)

Servicios disponibles:
  - nginx     (Reverse Proxy - solo en producción)
  - nginx-dev (Reverse Proxy para desarrollo - opcional)
  - backend   (FastAPI + WebSocket + MQTT)
  - frontend  (React + Leaflet)
  - cache     (DragonflyDB)

Ejemplos:
  ./deploy.sh start          # Iniciar desarrollo (con build)
  ./deploy.sh dev            # Iniciar desarrollo (hot reload, primer plano)
  ./deploy.sh start dev true # Iniciar desarrollo con nginx (para usar /api)
  ./deploy.sh dev true       # Iniciar desarrollo con nginx (hot reload)
  ./deploy.sh start prod     # Iniciar producción (con nginx)
  ./deploy.sh logs show backend  # Ver logs del backend en tiempo real
  ./deploy.sh logs last backend  # Ver últimos logs guardados del backend
  ./deploy.sh status prod    # Ver estado de producción
  ./deploy.sh cleanup        # Limpiar recursos Docker

Ubicación de logs: ./logs/ (configurable con LOG_DIR)

Accesos después del despliegue:
  Desarrollo local (sin nginx):
    Frontend React:    http://localhost:3000
    Backend API:       http://localhost:8000
    WebSocket:         ws://localhost:8000/ws/realtime

  Desarrollo local (con nginx):
    Aplicación completa: http://localhost:8080
    API:                 http://localhost:8080/api
    WebSocket:           ws://localhost:8080/ws/realtime

  Producción (con nginx):
    Aplicación completa: http://localhost:8082
    API:                 http://localhost:8082/api
    WebSocket:           ws://localhost:8082/ws/realtime

EOF
}

# Manejo de comandos
case "${1:-help}" in
    start)
        check_dependencies
        check_environment "$ENV_FILE"
        check_config_files
        build_images "$COMPOSE_FILE" "$ENVIRONMENT"
        start_services "$COMPOSE_FILE" "$ENV_FILE" "$3" "$ENVIRONMENT"
        sleep 5
        show_status "$COMPOSE_FILE" "$ENVIRONMENT"
        ;;
    dev)
        check_dependencies
        check_environment "$ENV_FILE"
        check_config_files
        dev_services "$COMPOSE_FILE" "$ENV_FILE" "$3" "$ENVIRONMENT"
        ;;
    stop)
        check_dependencies
        stop_services "$COMPOSE_FILE"
        ;;
    restart)
        check_dependencies
        check_environment "$ENV_FILE"
        restart_services "$COMPOSE_FILE" "$ENV_FILE" "$ENVIRONMENT"
        sleep 3
        show_status "$COMPOSE_FILE" "$ENVIRONMENT"
        ;;
    status)
        check_dependencies
        show_status "$COMPOSE_FILE" "$ENVIRONMENT"
        ;;
    logs)
        check_dependencies
        handle_logs_command "$2" "$3" "$4"
        ;;
    build)
    check_dependencies
    check_environment "$ENV_FILE"
    build_images "$COMPOSE_FILE" "$ENVIRONMENT"
    ;;
    update)
        check_dependencies
        check_environment "$ENV_FILE"
        update_system "$COMPOSE_FILE" "$ENV_FILE" "$ENVIRONMENT"
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
