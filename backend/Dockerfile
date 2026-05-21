FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY seeders ./seeders

EXPOSE 3001

CMD ["node", "src/app.js"]
