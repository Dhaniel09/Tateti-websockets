FROM mirror.gcr.io/library/node:18-alpine

WORKDIR /app

COPY server/package*.json ./server/

RUN cd server && npm ci --only=production

COPY server/ ./server/
COPY public/ ./public/

WORKDIR /app/server

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
