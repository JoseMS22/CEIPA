# frontend/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
# En prod, define variables necesarias antes del build (o con .env.production)
RUN npm run build

# --- Runtime stage ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Solo copiamos lo mínimo necesario
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["npm", "run", "start"]
