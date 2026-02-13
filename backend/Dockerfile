FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias para algunas bibliotecas
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Actualizar pip primero
RUN pip install --upgrade pip

# Copiar requirements.txt e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY app ./app
# NOTA: El archivo sensores.yaml se montará como volumen en docker-compose

# Variables de entorno (se pueden sobreescribir en runtime)
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Exponer puerto
EXPOSE 8000

# Comando para ejecutar la aplicación
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
