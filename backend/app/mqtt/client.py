import asyncio
import json
import logging
from typing import Optional
import os
from aiomqtt import Client, MqttError

from app.mqtt.handler import handle_mqtt_message

logger = logging.getLogger(__name__)

class MQTTClient:
    """Cliente MQTT para suscribirse a EMQX"""
    
    def __init__(self):
        self.broker = os.getenv("MQTT_BROKER", "localhost")
        self.port = int(os.getenv("MQTT_PORT", "1883"))
        self.topic = os.getenv("MQTT_TOPIC", "sensores/ruido")
        self.client: Optional[Client] = None
        self.connected = False
        
    async def connect(self):
        """Conectar al broker MQTT y suscribirse al tópico"""
        try:
            self.client = Client(
                hostname=self.broker,
                port=self.port,
                # Si el broker requiere autenticación, añadir parámetros
                # username=os.getenv("MQTT_USERNAME"),
                # password=os.getenv("MQTT_PASSWORD"),
            )
            
            await self.client.__aenter__()
            await self.client.subscribe(self.topic)
            self.connected = True
            
            logger.info(f"Conectado a MQTT broker {self.broker}:{self.port}, suscrito a {self.topic}")
            
            # Iniciar loop de recepción de mensajes
            asyncio.create_task(self._message_loop())
            
        except Exception as e:
            logger.error(f"Error conectando a MQTT: {e}")
            raise
    
    async def disconnect(self):
        """Desconectar del broker MQTT"""
        if self.client:
            try:
                await self.client.__aexit__(None, None, None)
                self.connected = False
                logger.info("Desconectado de MQTT broker")
            except Exception as e:
                logger.error(f"Error desconectando de MQTT: {e}")
    
    async def _message_loop(self):
        """Loop principal para recibir mensajes MQTT"""
        if not self.client:
            return
        
        try:
            async for message in self.client.messages:
                try:
                    payload = message.payload.decode("utf-8")
                    topic = message.topic
                    
                    logger.debug(f"Mensaje MQTT recibido en {topic}: {payload[:100]}...")
                    
                    # Procesar mensaje
                    await handle_mqtt_message(topic, payload)
                    
                except UnicodeDecodeError:
                    logger.error("Error decodificando payload MQTT (no UTF-8)")
                except json.JSONDecodeError as e:
                    logger.error(f"Error parseando JSON del payload: {e}")
                except Exception as e:
                    logger.error(f"Error procesando mensaje MQTT: {e}")
                    
        except MqttError as e:
            logger.error(f"Error en conexión MQTT: {e}")
            self.connected = False
            # Intentar reconectar después de un tiempo
            await asyncio.sleep(5)
            if not self.connected:
                logger.info("Intentando reconectar a MQTT...")
                asyncio.create_task(self._reconnect())
    
    async def _reconnect(self):
        """Intentar reconexión al broker MQTT"""
        max_retries = 10
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                await self.connect()
                logger.info("Reconexión exitosa a MQTT")
                return
            except Exception as e:
                logger.warning(f"Intento de reconexión {attempt + 1}/{max_retries} fallido: {e}")
                await asyncio.sleep(retry_delay)
        
        logger.error(f"No se pudo reconectar después de {max_retries} intentos")

# Instancia global del cliente MQTT
mqtt_client = MQTTClient()