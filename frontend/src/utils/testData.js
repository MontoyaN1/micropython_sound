// Datos de prueba para el plano interior (5m × 14m)
// Sistema de coordenadas: (0,0) = esquina INFERIOR DERECHA
// longitude: X position (0-5m, derecha=0, izquierda=5)
// latitude: Y position (0-14m, abajo=0, arriba=14)
// GENERADO AUTOMÁTICAMENTE desde location/sensores.yaml
// Última sincronización: 2026-02-13T13:59:01.006561
export const testSensorData = [
  {
    "sensor_key": "E1",
    "micro_id": "E1",
    "sample": 0,
    "value": 45.5,
    "latitude": 3.0,
    "longitude": 1.5,
    "location_name": "Exterior 1",
    "last_update": "2026-02-13T13:59:01.006249"
  },
  {
    "sensor_key": "E2",
    "micro_id": "E2",
    "sample": 0,
    "value": 52.3,
    "latitude": 2.0,
    "longitude": 3.5,
    "location_name": "Exterior 2",
    "last_update": "2026-02-13T13:59:01.006264"
  },
  {
    "sensor_key": "E3",
    "micro_id": "E3",
    "sample": 0,
    "value": 48.7,
    "latitude": 7.0,
    "longitude": 1.5,
    "location_name": "Sala - Entrada",
    "last_update": "2026-02-13T13:59:01.006269"
  },
  {
    "sensor_key": "E4",
    "micro_id": "E4",
    "sample": 0,
    "value": 55.1,
    "latitude": 11.0,
    "longitude": 1.5,
    "location_name": "Sala - lavadero",
    "last_update": "2026-02-13T13:59:01.006273"
  },
  {
    "sensor_key": "E5",
    "micro_id": "E5",
    "sample": 0,
    "value": 42.8,
    "latitude": 11.0,
    "longitude": 3.5,
    "location_name": "Cocina",
    "last_update": "2026-02-13T13:59:01.006276"
  },
  {
    "sensor_key": "E255",
    "micro_id": "E255",
    "sample": 0,
    "value": 60.5,
    "latitude": 5.0,
    "longitude": 3.5,
    "location_name": "Oficina",
    "last_update": "2026-02-13T13:59:01.006280"
  }
]

// Datos IDW de prueba para heatmap
export const testIdwData = {
  xi: [0, 1, 2, 3, 4, 5], // Posiciones X
  yi: [0, 2, 4, 6, 8, 10, 12, 14], // Posiciones Y
  zi: [
    [40, 42, 45, 48, 50, 52],
    [38, 40, 43, 46, 49, 51],
    [42, 44, 47, 50, 53, 55],
    [45, 47, 50, 53, 56, 58],
    [43, 45, 48, 51, 54, 56],
    [41, 43, 46, 49, 52, 54],
    [39, 41, 44, 47, 50, 52],
    [37, 39, 42, 45, 48, 50]
  ],
  x_min: 0,
  x_max: 5,
  y_min: 0,
  y_max: 14,
  calculated_at: new Date().toISOString()
}

// Epicentro de prueba
export const testEpicenter = {
  "latitude": 6.5,
  "longitude": 2.5,
  "calculated_at": "2026-02-13T13:59:01.006556"
}
