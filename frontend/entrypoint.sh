#!/bin/sh

# Script de entrada personalizado para el servidor frontend
# Permite mayor control sobre la configuración del servidor

set -e

# Variables de configuración
PORT=${PORT:-3000}
HOST=${HOST:-0.0.0.0}
DIR=${DIR:-dist}
SINGLE_PAGE_APP=${SINGLE_PAGE_APP:-true}
ENABLE_CORS=${ENABLE_CORS:-true}
NO_COMPRESSION=${NO_COMPRESSION:-false}
VERBOSE=${VERBOSE:-false}

# Construir comando base
CMD="serve"

# Agregar opciones basadas en variables de entorno
if [ "$SINGLE_PAGE_APP" = "true" ]; then
    CMD="$CMD -s"
fi

if [ "$ENABLE_CORS" = "true" ]; then
    CMD="$CMD --cors"
fi

if [ "$NO_COMPRESSION" = "true" ]; then
    CMD="$CMD --no-compression"
fi

if [ "$VERBOSE" = "true" ]; then
    CMD="$CMD --debug"
fi

# Agregar directorio y configuración de puerto/host
CMD="$CMD $DIR -l $HOST:$PORT"

# Mostrar configuración
echo "========================================"
echo "  Configuración del servidor frontend"
echo "========================================"
echo "Directorio: $DIR"
echo "Puerto: $PORT"
echo "Host: $HOST"
echo "SPA Mode: $SINGLE_PAGE_APP"
echo "CORS: $ENABLE_CORS"
echo "Compresión: $([ "$NO_COMPRESSION" = "true" ] && echo "Deshabilitada" || echo "Habilitada")"
echo "Verbose: $VERBOSE"
echo "Comando: $CMD"
echo "========================================"
echo ""

# Verificar que el directorio existe
if [ ! -d "$DIR" ]; then
    echo "ERROR: El directorio '$DIR' no existe"
    echo "Contenido del directorio actual:"
    ls -la
    exit 1
fi

# Verificar archivos esenciales
if [ ! -f "$DIR/index.html" ]; then
    echo "ERROR: No se encontró index.html en $DIR/"
    exit 1
fi

if [ ! -f "$DIR/plano.png" ]; then
    echo "WARNING: No se encontró plano.png en $DIR/"
    echo "Archivos en $DIR/:"
    ls -la "$DIR/"
fi

# Ejecutar servidor
echo "Iniciando servidor..."
exec $CMD
