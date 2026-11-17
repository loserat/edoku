FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
# Python bleibt für Vollsicherung und Rückweg erhalten; Compiler nur im Build.
RUN apk add --no-cache python3
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "scripts/container-healthcheck.js"]
CMD ["node", "server.js"]
