FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (cache layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código fuente
COPY src/ ./src/

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
