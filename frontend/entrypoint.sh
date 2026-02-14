#!/bin/sh

# Script de entrada simplificado para frontend React
# Usa serve con modo SPA para aplicaciones de una sola página

set -e
set -x  # Modo debug para diagnóstico

# Variables de configuración
PORT=${PORT:-3000}
HOST=${HOST:-0.0.0.0}
DIR=${DIR:-dist}

# Verificar que el directorio dist existe
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

# Verificar que serve está instalado
if ! command -v serve &> /dev/null; then
    echo "ERROR: El comando 'serve' no está disponible"
    echo "Intentando instalar serve..."
    npm install -g serve
    if ! command -v serve &> /dev/null; then
        echo "ERROR: No se pudo instalar serve"
        exit 1
    fi
fi

# Mostrar información de configuración
echo "========================================"
echo "  Configuración del servidor frontend"
echo "========================================"
echo "Directorio: $DIR"
echo "Puerto: $PORT"
echo "Host: $HOST"
echo "Modo SPA: Habilitado (-s)"
echo "CORS: Habilitado (--cors)"
echo "========================================"
echo ""

# Mostrar archivos en dist/ para diagnóstico
echo "Archivos en $DIR/:"
ls -la "$DIR/"
if [ -d "$DIR/assets" ]; then
    echo ""
    echo "Archivos en $DIR/assets/:"
    ls -la "$DIR/assets/"
fi
echo ""

# Verificar contenido del index.html
echo "=== VERIFICANDO CONTENIDO DE index.html ==="
if [ -f "$DIR/index.html" ]; then
    echo "Tamaño de index.html: $(wc -l < "$DIR/index.html") líneas, $(wc -c < "$DIR/index.html") bytes"
    echo "Primeras 5 líneas:"
    head -5 "$DIR/index.html"
    echo "Últimas 5 líneas:"
    tail -5 "$DIR/index.html"

    # Verificar que index.html tenga las etiquetas mínimas
    if ! grep -q "<html" "$DIR/index.html"; then
        echo "ERROR: index.html no contiene etiqueta <html>"
        exit 1
    fi
    if ! grep -q "<body" "$DIR/index.html"; then
        echo "ERROR: index.html no contiene etiqueta <body>"
        exit 1
    fi
    if ! grep -q "src=" "$DIR/index.html"; then
        echo "WARNING: index.html no contiene etiquetas src (sin JavaScript?)"
    fi
else
    echo "ERROR: index.html no encontrado en $DIR/"
    exit 1
fi
echo "✓ index.html parece válido"
echo ""

# Ejecutar servidor con modo SPA y CORS en background para poder diagnosticar
echo "Iniciando servidor..."
echo "========================================"

# Intentar primero con serve
if command -v serve &> /dev/null; then
    echo "Intentando con serve..."
    echo "Comando: serve $DIR --single --cors --port $PORT --listen $HOST"
    serve "$DIR" --single --cors --port "$PORT" --listen "$HOST" &
    SERVER_PID=$!
    SERVER_TYPE="serve"
else
    echo "serve no disponible, intentando con http-server..."
    # Instalar http-server si no está disponible
    if ! command -v http-server &> /dev/null; then
        echo "Instalando http-server..."
        npm install -g http-server
    fi

    echo "Comando: http-server $DIR -a $HOST -p $PORT --cors"
    http-server "$DIR" -a "$HOST" -p "$PORT" --cors &
    SERVER_PID=$!
    SERVER_TYPE="http-server"
fi

# Esperar a que el servidor se inicie
echo "Esperando 5 segundos para que el servidor se inicie..."
sleep 5

# Verificar si el proceso sigue ejecutándose
echo "=== DIAGNÓSTICO DEL SERVIDOR ==="
echo "PID del servidor: $SERVER_PID"
echo "Tipo de servidor: $SERVER_TYPE"

if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "ERROR: El servidor se detuvo inesperadamente"

    # Si serve falló, intentar con http-server como fallback
    if [ "$SERVER_TYPE" = "serve" ]; then
        echo "serve falló, intentando con http-server como fallback..."

        # Instalar http-server si no está disponible
        if ! command -v http-server &> /dev/null; then
            echo "Instalando http-server..."
            npm install -g http-server
        fi

        echo "Comando fallback: http-server $DIR -a $HOST -p $PORT --cors"
        http-server "$DIR" -a "$HOST" -p "$PORT" --cors &
        SERVER_PID=$!
        SERVER_TYPE="http-server"

        # Esperar de nuevo
        sleep 5

        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo "ERROR: http-server también falló"
            exit 1
        fi
        echo "✓ http-server en ejecución (PID: $SERVER_PID)"
    else
        exit 1
    fi
fi

echo "✓ Servidor en ejecución (PID: $SERVER_PID, Tipo: $SERVER_TYPE)"

# Mostrar información del proceso
echo "Información del proceso:"
ps -p $SERVER_PID -o pid,ppid,cmd,state 2>/dev/null || echo "No se pudo obtener información del proceso"

# Instalar herramientas de diagnóstico de red si no están disponibles
if ! command -v netstat &> /dev/null && ! command -v ss &> /dev/null; then
    echo "Instalando herramientas de diagnóstico de red..."
    apk add --no-cache net-tools iproute2 2>/dev/null || echo "No se pudieron instalar herramientas de red"
fi

# Verificar si el puerto está escuchando
echo "=== VERIFICANDO PUERTO $PORT ==="

PORT_LISTENING=false
if command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        echo "✓ netstat: Puerto $PORT está escuchando"
        PORT_LISTENING=true
    fi
fi

if command -v ss &> /dev/null; then
    if ss -tuln 2>/dev/null | grep -q ":$PORT "; then
        echo "✓ ss: Puerto $PORT está escuchando"
        PORT_LISTENING=true
    fi
fi

# Verificar con curl localmente
echo "=== VERIFICANDO CON CURL LOCAL ==="
if command -v curl &> /dev/null; then
    for i in 1 2 3; do
        if curl -s -f "http://localhost:$PORT" > /dev/null 2>&1; then
            echo "✓ curl: Servidor responde en intento $i"
            PORT_LISTENING=true
            break
        else
            echo "✗ curl: Intento $i falló"
            sleep 1
        fi
    done
else
    echo "curl no disponible, instalando..."
    apk add --no-cache curl 2>/dev/null || echo "No se pudo instalar curl"
fi

if [ "$PORT_LISTENING" = "true" ]; then
    echo "========================================"
    echo "✓ SERVIDOR INICIADO CORRECTAMENTE"
    echo "✓ Puerto $PORT escuchando"
    echo "✓ Frontend disponible en: http://localhost:$PORT"
    echo "✓ Desde el host: http://localhost:13001"
    echo "========================================"

    # Mantener el script en ejecución
    echo "Monitoreando servidor... (Ctrl+C para detener)"
    echo "Servidor iniciado correctamente. Accede en:"
    echo "  - Dentro del contenedor: http://localhost:$PORT"
    echo "  - Desde el host: http://localhost:13001"
    echo "  - Desde red: http://<IP-DEL-SERVIDOR>:13001"

    # Nota especial para http-server
    if [ "$SERVER_TYPE" = "http-server" ]; then
        echo ""
        echo "NOTA: Usando http-server. Para acceder a la aplicación:"
        echo "  - Visita: http://localhost:13001/index.html"
        echo "  - O configura tu navegador para visitar automáticamente index.html"
    fi

    wait $SERVER_PID
else
    echo "========================================"
    echo "✗ ERROR: Servidor no responde"
    echo "✗ Puerto $PORT no está accesible"
    echo "========================================"

    # Mostrar información de diagnóstico adicional
    echo "=== INFORMACIÓN ADICIONAL ==="
    echo "Proceso servidor:"
    ps aux | grep serve | grep -v grep || echo "No se encontró proceso serve"

    echo "Puertos escuchando:"
    (netstat -tuln 2>/dev/null || ss -tuln 2>/dev/null || echo "No se pueden listar puertos") | head -20

    # Intentar matar el proceso
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi
