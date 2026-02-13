from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Crear aplicación FastAPI
app = FastAPI(
    title="API de Monitoreo Acústico",
    description="Backend para visualización en tiempo real de sensores de ruido",
    version="1.0.0"
)

# Tarea para broadcast periódico
periodic_broadcast_task = None

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción restringir a dominios específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Importar routers y manejadores
from app.api.endpoints import router as api_router
from app.websocket.manager import websocket_manager
from app.mqtt.client import mqtt_client

# Incluir router de API
app.include_router(api_router, prefix="/api")

# Eventos de inicio y apagado
@app.on_event("startup")
async def startup_event():
    """Inicializar servicios al arrancar la aplicación"""
    logger.info("Iniciando servicios...")
    
    # Conectar a MQTT
    try:
        await mqtt_client.connect()
        logger.info("Conectado a broker MQTT")
    except Exception as e:
        logger.error(f"Error conectando a MQTT: {e}")
    
    # Iniciar broadcast periódico
    global periodic_broadcast_task
    periodic_broadcast_task = asyncio.create_task(
        websocket_manager.start_periodic_broadcast(interval=5)
    )
    logger.info("Broadcast periódico iniciado (cada 5 segundos)")
    
    # Iniciar tareas en segundo plano si es necesario
    # ...

@app.on_event("shutdown")
async def shutdown_event():
    """Limpiar recursos al apagar la aplicación"""
    logger.info("Apagando servicios...")
    
    # Cancelar broadcast periódico
    global periodic_broadcast_task
    if periodic_broadcast_task:
        periodic_broadcast_task.cancel()
        try:
            await periodic_broadcast_task
        except asyncio.CancelledError:
            pass
        logger.info("Broadcast periódico cancelado")
    
    # Desconectar de MQTT
    try:
        await mqtt_client.disconnect()
        logger.info("Desconectado de broker MQTT")
    except Exception as e:
        logger.error(f"Error desconectando de MQTT: {e}")

# Endpoint básico de salud
@app.get("/")
async def root():
    return {
        "message": "API de Monitoreo Acústico",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# WebSocket endpoint para datos en tiempo real
@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    """Endpoint WebSocket para datos en tiempo real"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Mantener conexión abierta - manejar tanto texto como desconexión
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Opcional: procesar mensajes del cliente
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Enviar ping para mantener conexión activa
                await websocket.send_json({"type": "ping", "timestamp": datetime.now().isoformat()})
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"Error en WebSocket: {e}")
    finally:
        websocket_manager.disconnect(websocket)
        logger.info("Cliente WebSocket desconectado")