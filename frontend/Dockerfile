FROM node:18-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package.json package-lock.json* ./
RUN npm install

# Copiar código de la aplicación
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando para desarrollo (se sobreescribirá en producción)
CMD ["npm", "run", "dev"]