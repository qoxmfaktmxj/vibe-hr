FROM node:22-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app/frontend
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend ./
COPY config ../config
RUN npm run build:deploy

FROM node:22-alpine AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app/frontend/.next ./.next
COPY --from=builder --chown=node:node /app/frontend/public ./public
COPY --from=builder --chown=node:node /app/frontend/package.json ./package.json
COPY --from=builder --chown=node:node /app/frontend/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/frontend/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/frontend/tsconfig.json ./tsconfig.json

EXPOSE 3000
USER node
CMD ["npm", "run", "start"]
