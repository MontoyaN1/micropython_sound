// Datos de prueba para el plano interior (5m × 14m)
// Sistema de coordenadas: (0,0) = esquina INFERIOR DERECHA
// longitude: X position (0-5m, derecha=0, izquierda=5)
// latitude: Y position (0-14m, abajo=0, arriba=14)
// GENERADO AUTOMÁTICAMENTE desde location/sensores.yaml
// Última sincronización: ${new Date().toISOString()}
export const testSensorData = [
  {
    sensor_key: "E1",
    micro_id: "E1",
    sample: 0,
    value: 45.5,
    latitude: 3.0,
    longitude: 1.5,
    location_name: "Exterior 1",
    last_update: new Date().toISOString(),
  },
  {
    sensor_key: "E2",
    micro_id: "E2",
    sample: 0,
    value: 52.3,
    latitude: 2.0,
    longitude: 3.5,
    location_name: "Exterior 2",
    last_update: new Date().toISOString(),
  },
  {
    sensor_key: "E3",
    micro_id: "E3",
    sample: 0,
    value: 48.7,
    latitude: 7.0,
    longitude: 1.5,
    location_name: "Sala - Entrada",
    last_update: new Date().toISOString(),
  },
  {
    sensor_key: "E4",
    micro_id: "E4",
    sample: 0,
    value: 55.1,
    latitude: 11.0,
    longitude: 1.5,
    location_name: "Sala - lavadero",
    last_update: new Date().toISOString(),
  },
  {
    sensor_key: "E5",
    micro_id: "E5",
    sample: 0,
    value: 42.8,
    latitude: 11.0,
    longitude: 3.5,
    location_name: "Cocina",
    last_update: new Date().toISOString(),
  },
  {
    sensor_key: "E255",
    micro_id: "E255",
    sample: 0,
    value: 60.5,
    latitude: 5.0,
    longitude: 3.5,
    location_name: "Oficina",
    last_update: new Date().toISOString(),
  },
];

// Datos IDW de prueba para heatmap (formato 2D como el backend real)
export const testIdwData = {
  xi: [
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
  ], // Posiciones X (2D)
  yi: [
    [0, 0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2, 2],
    [4, 4, 4, 4, 4, 4],
    [6, 6, 6, 6, 6, 6],
    [8, 8, 8, 8, 8, 8],
    [10, 10, 10, 10, 10, 10],
    [12, 12, 12, 12, 12, 12],
    [14, 14, 14, 14, 14, 14],
  ], // Posiciones Y (2D)
  zi: [
    [40, 42, 45, 48, 50, 52],
    [38, 40, 43, 46, 49, 51],
    [42, 44, 47, 50, 53, 55],
    [45, 47, 50, 53, 56, 58],
    [43, 45, 48, 51, 54, 56],
    [41, 43, 46, 49, 52, 54],
    [39, 41, 44, 47, 50, 52],
    [37, 39, 42, 45, 48, 50],
  ],
  x_min: 0,
  x_max: 5,
  y_min: 0,
  y_max: 14,
  calculated_at: new Date().toISOString(),
};

// Epicentro extendido de prueba con zona y top sensores
export const testEpicenter = {
  latitude: 6.5,
  longitude: 2.5,
  max_sensor_latitude: 5.0, // E255 (mayor valor)
  max_sensor_longitude: 3.5,
  max_value: 60.5,
  sensor_count: 6,
  calculated_at: new Date().toISOString(),
  fallback: false,
  top_sensors: [
    {
      micro_id: "E255",
      latitude: 5.0,
      longitude: 3.5,
      value: 60.5,
      rank: 1,
      location_name: "Oficina",
    },
    {
      micro_id: "E4",
      latitude: 11.0,
      longitude: 1.5,
      value: 55.1,
      rank: 2,
      location_name: "Sala - lavadero",
    },
    {
      micro_id: "E2",
      latitude: 2.0,
      longitude: 3.5,
      value: 52.3,
      rank: 3,
      location_name: "Exterior 2",
    },
  ],
  zone_type: "circle",
  zone_radius: 5.675, // distancia máxima + 0.5m margen
  zone_center_latitude: 6.0, // promedio latitudes top sensores
  zone_center_longitude: 2.833, // promedio longitudes top sensores
  zone_vertices: null,
};
