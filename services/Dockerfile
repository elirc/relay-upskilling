FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY scripts/ ./scripts/
COPY services/ ./services/
RUN mkdir -p /models && chown node:node /models
USER node
CMD ["node","scripts/ai-service.mjs"]