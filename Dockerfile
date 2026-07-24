FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p data public/uploads && chmod 777 data public/uploads
EXPOSE 8000
CMD ["node", "server.js"]
