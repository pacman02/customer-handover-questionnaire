FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY views ./views
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
