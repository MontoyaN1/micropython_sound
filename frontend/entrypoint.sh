#!/bin/sh

# Script de entrada simplificado para frontend React
# Usa http-server con soporte SPA

set -e

# Variables de configuración
PORT=${PORT:-3000}
HOST=${HOST:-0.0.0.0}
DIR=${DIR:-dist}

# Verificar que el directorio dist existe
if [ ! -d "$DIR" ]; then
    echo "ERROR: El directorio '$DIR' no existe"
    exit 1
fi

# Verificar archivos esenciales
if [ ! -f "$DIR/index.html" ]; then
    echo "ERROR: No se encontró index.html en $DIR/"
    exit 1
fi

# Instalar http-server si no está disponible
if ! command -v http-server &> /dev/null; then
    echo "Instalando http-server..."
    npm install -g http-server
fi

echo "========================================"
echo "  Configuración del servidor frontend"
echo "========================================"
echo "Directorio: $DIR"
echo "Puerto: $PORT"
echo "Host: $HOST"
echo "Modo SPA: Habilitado (-P)"
echo "CORS: Habilitado (--cors)"
echo "========================================"

# Ejecutar http-server con soporte SPA
echo "Iniciando http-server con soporte SPA..."
echo "Comando: http-server $DIR -a $HOST -p $PORT --cors --proxy http://$HOST:$PORT?"

# Ejecutar http-server en primer plano
exec http-server "$DIR" -a "$HOST" -p "$PORT" --cors --proxy "http://$HOST:$PORT?"
