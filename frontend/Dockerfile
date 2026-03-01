FROM node:18-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package.json package-lock.json* ./
RUN npm install

# Copiar código de la aplicación
COPY . .

# Configurar variable de entorno para API URL
# En desarrollo con nginx: usar /api
# En desarrollo sin nginx: usar http://localhost:8000
# En producción: usar /api (configurado en nginx)
ENV VITE_API_URL=/api

# Exponer puerto
EXPOSE 3000

# Comando para desarrollo (se sobreescribirá en producción)
CMD ["npm", "run", "dev"]
