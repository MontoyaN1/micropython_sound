if (!msg?.payload) {
  node.error("Mensaje o payload no definido");
  return null;
}

const data = msg.payload;

if (!Array.isArray(data?.sensors) || data.sensors.length === 0) {
  node.error("No hay datos de sensores en el payload");
  return null;
}

const lines = [];

for (let sensor of data.sensors) {
  // Validar campos requeridos
  if (sensor.micro_id === undefined || sensor.value === undefined) {
    node.warn(`Sensor incompleto: ${JSON.stringify(sensor)}`);
    continue;
  }

  // Escapar caracteres especiales en el tag (micro_id)
  const escapeTag = (v) =>
    String(v).replace(/ /g, "\\ ").replace(/,/g, "\\,").replace(/=/g, "\\=");

  const microId = escapeTag(sensor.micro_id);

  // Construir línea SOLO con measurement, tag y field
  // SIN timestamp para que InfluxDB use la hora del servidor
  // SIN sample
  let line = `sonido,micro_id=${microId} valor=${sensor.value}`;

  lines.push(line);
}

// Unir con salto de línea
msg.payload = lines.join("\n");

// Metadata opcional (sin timestampNs)
msg.metadata = {
  originalMessageId: data.message_id,
  sensorCount: data.sensors.length,
  processedAt: new Date().toISOString(),
};

return msg;
