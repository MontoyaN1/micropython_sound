# Guía de Despliegue Manual - Sistema de Monitoreo Acústico

## 📋 Estado Actual
✅ **Sistema completo implementado** - Backend FastAPI + Frontend React + Cache DragonflyDB
✅ **Pruebas de estructura pasadas** - Todos los componentes verificados
⚠️ **Permisos Docker** - Necesario acceso a Docker para despliegue completo

## 🚀 Opciones de Despliegue

### Opción 1: Despliegue con Docker (Recomendado)
```bash
# 1. Verificar permisos de Docker
sudo usermod -aG docker $USER
newgrp docker

# 2. Iniciar sistema completo
./deploy.sh start

# 3. Verificar estado
./deploy.sh status

# 4. Acceder a la aplicación
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Dash legacy: http://localhost:8050
```

### Opción 2: Despliegue Manual (Sin Docker)
```bash
# 1. Backend FastAPI
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Frontend React (en otra terminal)
cd frontend
npm install
npm run dev

# 3. Cache DragonflyDB (opcional, usar Redis local)
docker run -d -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly
# O usar Redis local si está instalado
```

### Opción 3: Despliegue en EasyPanel (VPS)
```bash
# 1. Subir código al servidor
scp -r . usuario@servidor:/ruta/a/monitoreo-acustico

# 2. Conectar al servidor y ejecutar
ssh usuario@servidor
cd /ruta/a/monitoreo-acustico
./deploy.sh start

# 3. Configurar proxy inverso en EasyPanel
# - Crear aplicación web
# - Puerto: 3000 (frontend)
# - Agregar regla para /api → puerto 8000
```

## 🔧 Verificación del Sistema

### 1. Verificar Backend
```bash
# Salud del backend
curl http://localhost:8000/health

# Listar sensores
curl http://localhost:8000/api/sensors

# Datos en tiempo real (WebSocket)
# Conectar a: ws://localhost:8000/ws/realtime
```

### 2. Verificar Frontend
```bash
# Acceder en navegador
http://localhost:3000

# Verificar conexión WebSocket
# La página debería mostrar "Conectado" en la esquina superior derecha
```

### 3. Verificar Conexión MQTT
```bash
# Suscribirse manualmente al topic
mosquitto_sub -h 213.199.37.1 -p 1883 -t "sensores/ruido"

# Deberías ver mensajes en formato:
# {"message_id": "...", "timestamp": ..., "sensors": [...]}
```

## 📊 Monitoreo en Producción

### Logs del Sistema
```bash
# Backend
./deploy.sh logs backend

# Frontend  
./deploy.sh logs frontend

# Todos los servicios
./deploy.sh logs
```

### Métricas de Salud
```bash
# Estado de servicios
./deploy.sh status

# Uso de recursos
docker stats

# Logs de errores
docker-compose logs --tail=100 | grep -i error
```

## 🐛 Solución de Problemas Comunes

### 1. Error de permisos Docker
```bash
# Solución: Agregar usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker ps
```

### 2. Puerto en uso
```bash
# Verificar puertos ocupados
sudo lsof -i :3000
sudo lsof -i :8000
sudo lsof -i :8050

# Liberar puertos
sudo kill -9 <PID>
```

### 3. Error de conexión MQTT
```bash
# Verificar broker MQTT
nc -zv 213.199.37.1 1883

# Probar suscripción manual
mosquitto_sub -h 213.199.37.1 -p 1883 -t "#" -v
```

### 4. Error de conexión InfluxDB
```bash
# Verificar token y URL
echo $INFLUXDB_TOKEN
echo $INFLUXDB_URL

# Probar conexión con curl
curl -H "Authorization: Token $INFLUXDB_TOKEN" "$INFLUXDB_URL/api/v2/buckets"
```

## 🔄 Migración desde Dash Legacy

### Ejecución Paralela
```bash
# Sistema nuevo + Dash legacy
./deploy.sh start

# Solo sistema nuevo (sin Dash)
./deploy.sh start backend frontend cache

# Solo Dash legacy
cd .
python app_dash.py
```

### Migración Gradual
1. **Fase 1**: Sistema nuevo en paralelo con Dash
2. **Fase 2**: Redirigir tráfico al nuevo frontend
3. **Fase 3**: Desactivar Dash cuando el nuevo sistema sea estable
4. **Fase 4**: Eliminar componentes legacy

## 📈 Escalabilidad

### Para mayor carga:
```yaml
# En docker-compose.yml
backend:
  deploy:
    replicas: 2
  environment:
    - REDIS_URL=redis://cache:6379

cache:
  deploy:
    replicas: 1
```

### Monitoreo avanzado:
- **Prometheus** para métricas
- **Grafana** para dashboards
- **AlertManager** para notificaciones

## 📞 Soporte

### Comandos útiles
```bash
# Reiniciar servicios
./deploy.sh restart

# Actualizar sistema
./deploy.sh update

# Backup de configuración
./deploy.sh backup

# Limpieza
./deploy.sh cleanup
```

### Logs de diagnóstico
```bash
# Exportar logs para diagnóstico
docker-compose logs > logs_$(date +%Y%m%d_%H%M%S).txt

# Verificar salud de contenedores
docker-compose ps

# Estadísticas de uso
docker stats --no-stream
```

---

**Nota**: El sistema está diseñado para alta disponibilidad y escalabilidad. En producción, considera:
1. Configurar HTTPS con certificados SSL
2. Implementar autenticación JWT
3. Configurar backups automáticos
4. Monitorear métricas de rendimiento
5. Establecer políticas de retención de datos