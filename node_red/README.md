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
- `procesamiento.json`: Función JavaScript para procesar datos (nodo Node-RED)
- `procesamiento.js`: Módulo JavaScript independiente con la función de procesamiento
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
### Función "Procesar datos": Convierte JSON a formato InfluxDB Line Protocol
- Valida la estructura de datos con validación mejorada (optional chaining)
- Escapa caracteres especiales para InfluxDB (incluyendo espacios, comas y signos igual)
- Convierte cada sensor a formato Line Protocol simplificado
- NO incluye timestamp (InfluxDB usa la hora del servidor)
- NO incluye el campo `sample` como tag
- Agrega metadata para debugging
4. **HTTP Request**: Envía datos a InfluxDB
5. **Debug (logs_http)**: Muestra la respuesta de InfluxDB
6. **Catch Node**: Captura y muestra errores

## Formato de Datos Esperado

Los dispositivos MicroPython deben enviar datos en el siguiente formato JSON:
```json
{
  "message_id": "esp32_000657",
  "timestamp": 3433,
  "sensors": [
    {"micro_id": "E3", "value": 34.3, "sample": 1},
    {"micro_id": "E3", "value": 36.6, "sample": 2},
    {"micro_id": "E4", "value": 35.9, "sample": 1},
    {"micro_id": "E4", "value": 36.4, "sample": 2},
    {"micro_id": "E5", "value": 36.3, "sample": 1},
    {"micro_id": "E5", "value": 37.4, "sample": 2}
  ]
}
```

**Campos:**
- `message_id`: Identificador único del mensaje (string)
- `timestamp`: Marca de tiempo en milisegundos (opcional, number)
- `sensors`: Array de lecturas de sensores
  - `micro_id`: Identificador del microcontrolador (string)
  - `value`: Valor de la lectura (number)
  - `sample`: Número de muestra (opcional, number, default: 0) - Nota: este campo ya no se incluye en el formato Line Protocol

## Archivo `procesamiento.js`

El archivo `procesamiento.js` contiene la función de procesamiento como un módulo JavaScript independiente. Esto permite:

1. **Reutilización**: Usar la misma función en diferentes proyectos
2. **Testing**: Probar la función fuera de Node-RED
3. **Mantenimiento**: Gestionar la lógica de procesamiento separadamente

### Uso del módulo:
```javascript
// En Node.js o entorno JavaScript
const procesarDatosInfluxDB = require('./procesamiento.js');
const resultado = procesarDatosInfluxDB({ payload: datos });

// En Node-RED function node (código actualizado en procesamiento.json y flow.json)
```

### Características:
- Validación mejorada de datos de entrada con optional chaining (`?.`)
- Escape completo de caracteres especiales para InfluxDB (espacios, comas y signos igual)
- Manejo robusto de errores y warnings
- Metadata para debugging
- Formato simplificado sin timestamp (InfluxDB usa hora del servidor)
- Eliminación del campo `sample` como tag para simplificar la estructura
- Retorna array de líneas unidas con saltos de línea

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

---
*Última actualización: Febrero 2026*
