# Configuración de Node-RED para el Sistema de Monitoreo de Sonido

⚠️ **NOTA IMPORTANTE**: Los archivos en esta carpeta han sido sanitizados para compartir públicamente.
Todos los datos sensibles (tokens, URLs, credenciales) han sido reemplazados por placeholders (`TU_*`).

Esta carpeta contiene los flujos de Node-RED utilizados en el sistema de monitoreo de sonido con MicroPython. Estos archivos están listos para ser importados en Node-RED después de configurar las credenciales apropiadas.

## Archivos de Configuración

### `flow.json`
Flujo completo de Node-RED que incluye:
- Conexión MQTT al broker EMQX
- Procesamiento de datos de sensores
- Envío a InfluxDB
- Manejo de errores
- Nodos de debug

### Archivos Individuales
- `consultar_emqx.json`: Configuración del nodo MQTT Input
- `http_request.json`: Configuración del nodo HTTP Request para InfluxDB
- `procesamiento.json`: Función JavaScript para procesar datos
- `error_catch.json`: Configuración de manejo de errores
- `logs_emqx.json` y `logs_http.json`: Nodos de debug

## Configuración Requerida

### 1. Configurar Broker MQTT
En los archivos `flow.json` y `consultar_emqx.json`, reemplazar:
```json
"broker": "TU_BROKER_MQTT_AQUI"
```
con la URL de tu broker MQTT (ej: `"http://localhost:1883"` o `"http://tu-servidor.com:1883"`).

### 2. Configurar InfluxDB
En los archivos `flow.json` y `http_request.json`, actualizar:

#### URL de InfluxDB:
```json
"url": "http://influxdb:8086/api/v2/write?org=TU_ORGANIZACION&bucket=TU_BUCKET&precision=ns"
```
Reemplazar:
- `TU_ORGANIZACION`: Nombre de tu organización en InfluxDB
- `TU_BUCKET`: Nombre del bucket donde se almacenarán los datos

#### Token de Autenticación:
```json
"valueValue": "Token TU_TOKEN_INFLUXDB_AQUI"
```
Reemplazar con tu token de InfluxDB V2.

### 3. Configurar Tópico MQTT
El flujo está configurado para suscribirse al tópico:
```
sensors/espnow/grouped_data
```
Asegúrate de que tus dispositivos MicroPython publiquen en este tópico o modifica el tópico según sea necesario.

## Estructura del Flujo

1. **MQTT Input**: Recibe datos del broker MQTT
2. **Debug (emqx_logs)**: Muestra los datos recibidos por MQTT
3. **Función "Procesar datos"**: Convierte JSON a formato InfluxDB Line Protocol
4. **HTTP Request**: Envía datos a InfluxDB
5. **Debug (logs_http)**: Muestra la respuesta de InfluxDB
6. **Catch Node**: Captura y muestra errores

## Formato de Datos Esperado

Los dispositivos MicroPython deben enviar datos en el siguiente formato JSON:
```json
{
  "micro_id": "ID_DEL_MICROCONTROLADOR",
  "sensors": [
    {
      "sensor_id": "ID_DEL_SENSOR",
      "value": 123.45
    }
  ]
}
```

## Instalación en Node-RED

1. Importar el archivo `flow.json` en Node-RED:
   - Menú → Import → Seleccionar archivo
   - O copiar el contenido y usar "Import from clipboard"

2. Configurar las credenciales como se describe arriba

3. Desplegar el flujo

## Variables de Entorno (Opcional)

Para mayor seguridad, puedes usar variables de entorno en Node-RED:

1. En `settings.js` de Node-RED, configurar:
```javascript
process.env.INFLUXDB_TOKEN = "tu_token"
process.env.INFLUXDB_URL = "http://influxdb:8086"
process.env.MQTT_BROKER = "http://localhost:1883"
```

2. Modificar los archivos JSON para usar:
```json
"broker": "{{env.MQTT_BROKER}}",
"url": "{{env.INFLUXDB_URL}}/api/v2/write?org=TU_ORGANIZACION&bucket=TU_BUCKET&precision=ns",
"valueValue": "Token {{env.INFLUXDB_TOKEN}}"
```

## Solución de Problemas

### Error de Conexión MQTT
- Verificar que el broker MQTT esté ejecutándose
- Comprobar credenciales y puerto
- Verificar firewall/red

### Error de Conexión a InfluxDB
- Verificar que InfluxDB esté ejecutándose
- Comprobar token y permisos
- Verificar organización y bucket existen

### Datos No Llegan a InfluxDB
- Revisar logs de debug (emqx_logs y logs_http)
- Verificar formato de datos enviados por MicroPython
- Comprobar tópico MQTT

## Notas de Seguridad

⚠️ **IMPORTANTE**: Los archivos en esta carpeta contienen placeholders. Antes de usar el sistema:

### Para replicación académica:
1. Los archivos ya están sanitizados y son seguros para compartir
2. Contienen placeholders (`TU_*`) que deben ser reemplazados
3. Sigue las instrucciones de configuración anteriores

### Para uso en producción:
1. Reemplazar todos los placeholders (`TU_*`) con valores reales
2. No compartir tokens o URLs públicas en repositorios
3. Usar variables de entorno para datos sensibles
4. Considerar usar autenticación segura en MQTT
5. Mantener el archivo `.env` en `.gitignore`

## Licencia

Este flujo de Node-RED es parte del proyecto de tesis de monitoreo de sonido con MicroPython.