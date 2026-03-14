FROM node:22-alpine
WORKDIR /app
COPY package.json /app/package.json
COPY src /app/src
RUN npm install --omit=dev
EXPOSE 8080
CMD ["node", "/app/src/container-server.mjs"]
