import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import Delaunator from "delaunator";

// Helper para verificar si un punto está dentro de un triángulo
const pointInTriangle = (px, py, t0, t1, t2) => {
  const [x0, y0] = t0;
  const [x1, y1] = t1;
  const [x2, y2] = t2;

  const denominator = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(denominator) < 1e-10) return false;

  const a = ((y2 - y1) * (px - x2) + (x1 - x2) * (py - y2)) / denominator;
  const b = ((y0 - y2) * (px - x2) + (x2 - x0) * (py - y2)) / denominator;
  const c = 1 - a - b;

  return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
};

const TriangulationLayer = ({ sensors, epicenter }) => {
  const map = useMap();
  const trianglesLayerRef = useRef(null);
  const epicenterTriangleLayerRef = useRef(null);

  useEffect(() => {
    if (!sensors || sensors.length < 3) {
      // Limpiar capas si no hay suficientes sensores
      if (trianglesLayerRef.current) {
        map.removeLayer(trianglesLayerRef.current);
        trianglesLayerRef.current = null;
      }
      if (epicenterTriangleLayerRef.current) {
        map.removeLayer(epicenterTriangleLayerRef.current);
        epicenterTriangleLayerRef.current = null;
      }
      return;
    }

    // Limpiar capas anteriores
    if (trianglesLayerRef.current) {
      map.removeLayer(trianglesLayerRef.current);
    }
    if (epicenterTriangleLayerRef.current) {
      map.removeLayer(epicenterTriangleLayerRef.current);
    }

    // Preparar puntos para Delaunator [lng, lat] porque usa coords cartesianas
    const points = sensors.map((s) => [s.longitude, s.latitude]);

    // Calcular triangulación Delaunay
    const delaunay = new Delaunator(points);
    const triangles = delaunay.triangles;

    // Crear grupo para las líneas de triangulación
    const trianglesGroup = L.layerGroup();
    const epicenterTriangleGroup = L.layerGroup();

    // Dibujar todos los bordes de triángulos (líneas grises)
    for (let i = 0; i < triangles.length; i += 3) {
      const i0 = triangles[i];
      const i1 = triangles[i + 1];
      const i2 = triangles[i + 2];

      const p0 = points[i0];
      const p1 = points[i1];
      const p2 = points[i2];

      // Dibujar los 3 bordes del triángulo
      const triangleCoords = [
        [p0[1], p0[0]], // [lat, lng]
        [p1[1], p1[0]],
        [p2[1], p2[0]],
        [p0[1], p0[0]], // Cerrar el triángulo
      ];

      const polyline = L.polyline(triangleCoords, {
        color: "#6b7280", // Gris
        weight: 1.5,
        opacity: 0.6,
        fill: false,
      });

      trianglesGroup.addLayer(polyline);
    }

    // Si hay epicentro, encontrar el triángulo que lo contiene
    if (epicenter && epicenter.latitude && epicenter.longitude) {
      const epLat = epicenter.latitude;
      const epLng = epicenter.longitude;

      let foundTriangle = null;

      // Buscar el triángulo que contiene el epicentro
      for (let i = 0; i < triangles.length; i += 3) {
        const i0 = triangles[i];
        const i1 = triangles[i + 1];
        const i2 = triangles[i + 2];

        const t0 = [points[i0][1], points[i0][0]]; // [lat, lng]
        const t1 = [points[i1][1], points[i1][0]];
        const t2 = [points[i2][1], points[i2][0]];

        if (pointInTriangle(epLat, epLng, t0, t1, t2)) {
          foundTriangle = [t0, t1, t2];
          break;
        }
      }

      // Si encontramos el triángulo, dibujarlo en rojo
      if (foundTriangle) {
        const epicenterCoords = [
          [foundTriangle[0][0], foundTriangle[0][1]],
          [foundTriangle[1][0], foundTriangle[1][1]],
          [foundTriangle[2][0], foundTriangle[2][1]],
          [foundTriangle[0][0], foundTriangle[0][1]], // Cerrar
        ];

        // Relleno semitransparente rojo
        const epicenterPolygon = L.polygon(epicenterCoords, {
          color: "#ef4444", // Rojo
          weight: 3,
          opacity: 1,
          fill: true,
          fillColor: "#ef4444",
          fillOpacity: 0.25,
        });

        epicenterTriangleGroup.addLayer(epicenterPolygon);
      } else {
        // Si no está dentro de ningún triángulo, dibujar línea al sensor más cercano
        console.log(
          "Epicentro fuera de la triangulación, marcando sensor más cercano",
        );
      }
    }

    // Añadir capas al mapa
    trianglesGroup.addTo(map);
    epicenterTriangleGroup.addTo(map);

    // Guardar referencias para limpiar después
    trianglesLayerRef.current = trianglesGroup;
    epicenterTriangleLayerRef.current = epicenterTriangleGroup;

    // Cleanup
    return () => {
      if (trianglesLayerRef.current) {
        map.removeLayer(trianglesLayerRef.current);
      }
      if (epicenterTriangleLayerRef.current) {
        map.removeLayer(epicenterTriangleLayerRef.current);
      }
    };
  }, [map, sensors, epicenter]);

  return null;
};

export default TriangulationLayer;
