import asyncio
import json
import logging
from typing import List, Set
from fastapi import WebSocket
from datetime import datetime

from app.services.data_service import data_service

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Gestor de conexiones WebSocket"""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.broadcast_task = None
        
    async def connect(self, websocket: WebSocket):
        """Aceptar nueva conexión WebSocket"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Nueva conexión WebSocket. Total: {len(self.active_connections)}")
        
        # Enviar estado inicial
        await self.send_current_state(websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Eliminar conexión WebSocket"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Conexión WebSocket cerrada. Total: {len(self.active_connections)}")
    
    async def send_current_state(self, websocket: WebSocket):
        """Enviar estado actual a un cliente específico"""
        try:
            state = data_service.get_current_state()
            await websocket.send_json({
                "type": "full_update",
                "data": state,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error enviando estado a WebSocket: {e}")
    
    async def broadcast_update(self):
        """Transmitir actualización a todos los clientes conectados"""
        if not self.active_connections:
            return
        
        try:
            state = data_service.get_current_state()
            message = json.dumps({
                "type": "update",
                "data": state,
                "timestamp": datetime.now().isoformat()
            })
            
            # Enviar a todas las conexiones
            tasks = []
            for connection in self.active_connections:
                try:
                    tasks.append(connection.send_text(message))
                except Exception as e:
                    logger.error(f"Error enviando a WebSocket: {e}")
                    # La conexión podría estar rota, se limpiará en el próximo ciclo
            
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
                
        except Exception as e:
            logger.error(f"Error en broadcast: {e}")
    
    async def start_periodic_broadcast(self, interval: int = 5):
        """Iniciar broadcast periódico (para mantener actualizaciones regulares)"""
        while True:
            try:
                await asyncio.sleep(interval)
                await self.broadcast_update()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error en broadcast periódico: {e}")
                await asyncio.sleep(1)

# Instancia global del gestor WebSocket
websocket_manager = WebSocketManager()