# Configuración de Ubicaciones de Sensores

## Descripción
Esta carpeta contiene la configuración de ubicaciones de los sensores para el sistema de monitoreo acústico. Los archivos en esta carpeta definen las coordenadas físicas de cada sensor, permitiendo la visualización espacial correcta en los mapas de calor.

## Archivos Principales

### `sensores.yaml`
Archivo principal de configuración que define las ubicaciones de todos los sensores en el sistema.

### `sensores.example.yaml`
Ejemplo de configuración con valores de demostración.

## Formato del Archivo sensores.yaml

### Estructura Básica
```yaml
microcontrollers:
  micro_E1:
    location: [1.5, 3]
    coordinates_type: "relative"
    room: "Exterior 1"
  micro_E2:
    location: [3.5, 2]
    coordinates_type: "relative"
    room: "Exterior 2"
  # ... más sensores
```

### Campos Requeridos

#### `location` (array de 2 números)
- **Formato**: `[x, y]` en metros
- **Sistema de coordenadas**:
  - `x`: 0-5 metros (derecha=0, izquierda=5)
  - `y`: 0-14 metros (abajo=0, arriba=14)
- **Ejemplo**: `[1.5, 3]` significa 1.5m desde la derecha, 3m desde abajo

#### `coordinates_type` (string)
- **Valores posibles**:
  - `"relative"`: Coordenadas relativas en metros (recomendado para planos interiores)
  - `"gps"`: Coordenadas GPS (latitud, longitud)

#### `room` (string)
- Nombre descriptivo de la ubicación
- Se muestra en la interfaz de usuario
- Ejemplos: "Exterior 1", "Sala - Entrada", "Oficina"

## Sistemas de Coordenadas

### Sistema Relativo (recomendado)
Ideal para planos interiores o áreas delimitadas:
- **Origen**: Esquina inferior derecha
- **Eje X**: Horizontal (0=derecha, 5=izquierda)
- **Eje Y**: Vertical (0=abajo, 14=arriba)
- **Unidades**: Metros

### Sistema GPS
Para ubicaciones geográficas reales:
```yaml
micro_E1:
  location: [4.609710, -74.081749]  # [latitud, longitud]
  coordinates_type: "gps"
  room: "Bogotá - Centro"
```

## Configuración de Ejemplo

### Para un Plano Interior de 5x14 metros
```yaml
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
```

### Mapeo de IDs
Los `micro_id` de los sensores deben mapearse a las claves en este archivo:
- Sensor con `micro_id: "E1"` → `micro_E1` en YAML
- Sensor con `micro_id: "E255"` → `micro_E255` en YAML

## Proceso de Configuración

### 1. Medir las Ubicaciones
1. **Definir el área**: Establecer límites (ej: 5x14 metros)
2. **Medir posiciones**: Usar cinta métrica para cada sensor
3. **Registrar coordenadas**: Anotar (x, y) desde la esquina inferior derecha

### 2. Crear/Editar el Archivo
```bash
# Copiar ejemplo si no existe
cp sensores.example.yaml sensores.yaml

# Editar con las coordenadas reales
nano sensores.yaml
```

### 3. Validar la Configuración
```bash
# El backend validará automáticamente al iniciar
docker-compose logs -f backend

# Verificar en la API
curl http://localhost:8000/api/sensores
```

## Herramientas de Ayuda

### Script de Conversión (opcional)
Para convertir mediciones manuales al formato YAML:
```python
# convert_coordinates.py
import yaml

mediciones = [
    {"id": "E1", "x": 1.5, "y": 3, "nombre": "Exterior 1"},
    {"id": "E2", "x": 3.5, "y": 2, "nombre": "Exterior 2"},
]

config = {"microcontrollers": {}}
for m in mediciones:
    key = f"micro_{m['id']}"
    config["microcontrollers"][key] = {
        "location": [m["x"], m["y"]],
        "coordinates_type": "relative",
        "room": m["nombre"]
    }

with open("sensores.yaml", "w") as f:
    yaml.dump(config, f, default_flow_style=False)
```

### Visualización de Ubicaciones
El frontend incluye una cuadrícula de referencia (1x1 metros) para verificar posiciones.

## Solución de Problemas

### Problemas Comunes

#### Sensores no aparecen en el mapa
1. Verificar que el `micro_id` coincida con la clave en YAML
2. Confirmar que las coordenadas estén dentro del rango (0-5, 0-14)
3. Revisar logs del backend para errores de carga

#### Posiciones incorrectas
1. Verificar sistema de coordenadas (origen en esquina inferior derecha)
2. Confirmar unidades (metros, no centímetros o pies)
3. Revisar orientación del plano de referencia

#### Error al cargar configuración
1. Validar sintaxis YAML (usar validador online)
2. Verificar que todos los campos requeridos estén presentes
3. Comprobar tipos de datos (arrays para location, strings para room)

### Diagnóstico
```bash
# Verificar que el archivo existe
ls -la location/sensores.yaml

# Verificar sintaxis YAML
python -c "import yaml; yaml.safe_load(open('location/sensores.yaml'))"

# Verificar en API
curl -s http://localhost:8000/api/sensores | jq .
```

## Buenas Prácticas

### Nomenclatura
- Usar nombres descriptivos para `room`
- Mantener consistencia en formatos (ej: "Área - Subárea")
- Incluir información de piso/nivel si aplica

### Documentación
- Mantener un diagrama del área con ubicaciones
- Documentar sistema de coordenadas usado
- Incluir referencias físicas (paredes, puertas, ventanas)

### Mantenimiento
- Versionar cambios en el archivo YAML
- Actualizar cuando se muevan sensores
- Revisar periódicamente la precisión de ubicaciones

## Integración con el Sistema

### Backend
El backend carga este archivo al iniciar y:
1. Convierte coordenadas a píxeles para visualización
2. Proporciona ubicaciones a través de la API
3. Usa posiciones para cálculos de interpolación IDW

### Frontend
El frontend utiliza estas ubicaciones para:
1. Posicionar marcadores en el mapa
2. Generar mapas de calor con interpolación espacial
3. Mostrar información contextual de cada sensor

## Escalabilidad

### Múltiples Áreas
Para monitorear múltiples áreas independientes:
```yaml
# area_edificio_a.yaml
microcontrollers:
  micro_A1:
    location: [2.0, 4.0]
    coordinates_type: "relative"
    room: "Edificio A - Planta Baja"

# area_edificio_b.yaml
microcontrollers:
  micro_B1:
    location: [4.609710, -74.081749]
    coordinates_type: "gps"
    room: "Edificio B - Terraza"
```

### Migración a GPS
Para transicionar de coordenadas relativas a GPS:
1. Medir coordenadas GPS reales de cada sensor
2. Actualizar `coordinates_type` a `"gps"`
3. Convertir ubicaciones a [latitud, longitud]

## Referencias

### Herramientas de Medición
- Cinta métrica láser para precisión
- Aplicaciones móviles de nivel y medición
- GPS de smartphone para coordenadas geográficas

### Recursos
- [Documentación YAML](https://yaml.org/)
- [Sistemas de coordenadas](https://es.wikipedia.org/wiki/Sistema_de_coordenadas)
- [Herramientas de validación YAML](https://www.yamllint.com/)

---

*Nota: Este archivo es esencial para la correcta visualización espacial de los datos. Cualquier cambio requiere reinicio del backend para que surta efecto. Ultimo cambio: Febrero 2026*
