import asyncio
import json
import logging
from datetime import datetime
import socketio
from typing import Dict, Any

from app.services.data_service import data_service

logger = logging.getLogger(__name__)

# Crear servidor Socket.IO
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

class SocketIOManager:
    """Gestor de conexiones Socket.IO"""
    
    def __init__(self):
        self.connected_clients: Dict[str, Any] = {}
        self.broadcast_task = None
        
    async def start_periodic_broadcast(self, interval: int = 5):
        """Iniciar broadcast periódico"""
        while True:
            try:
                await asyncio.sleep(interval)
                await self.broadcast_update()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error en broadcast periódico Socket.IO: {e}")
                await asyncio.sleep(1)
    
    async def broadcast_update(self):
        """Transmitir actualización a todos los clientes conectados"""
        if not self.connected_clients:
            return
        
        try:
            state = data_service.get_current_state()
            message = {
                "type": "update",
                "data": state,
                "timestamp": datetime.now().isoformat()
            }
            
            # Enviar a todos los clientes
            await sio.emit('update', message)
            
        except Exception as e:
            logger.error(f"Error en broadcast Socket.IO: {e}")

# Instancia global del gestor Socket.IO
socketio_manager = SocketIOManager()

# Event handlers de Socket.IO
@sio.event
async def connect(sid, environ):
    """Manejador de conexión de cliente"""
    logger.info(f"Cliente Socket.IO conectado: {sid}")
    socketio_manager.connected_clients[sid] = environ
    
    # Enviar estado inicial
    try:
        state = data_service.get_current_state()
        await sio.emit('full_update', {
            "data": state,
            "timestamp": datetime.now().isoformat()
        }, room=sid)
    except Exception as e:
        logger.error(f"Error enviando estado inicial a {sid}: {e}")

@sio.event
async def disconnect(sid):
    """Manejador de desconexión de cliente"""
    logger.info(f"Cliente Socket.IO desconectado: {sid}")
    if sid in socketio_manager.connected_clients:
        del socketio_manager.connected_clients[sid]

@sio.event
async def message(sid, data):
    """Manejador de mensajes genéricos"""
    logger.debug(f"Mensaje recibido de {sid}: {data}")
    # Puedes procesar comandos específicos aquí
    if data.get('type') == 'ping':
        await sio.emit('pong', {'timestamp': datetime.now().isoformat()}, room=sid)