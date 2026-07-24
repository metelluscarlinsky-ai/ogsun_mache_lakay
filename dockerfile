FROM node:18-alpine

WORKDIR /app

# Kopye pakè yo
COPY package*.json ./

# Enstale tout depandans
RUN npm install --production

# Kopye tout kòd la
COPY . .

# Kreye dosye ki nesesè
RUN mkdir -p data public/uploads && chmod 777 data public/uploads

# Espoze pò 8000
EXPOSE 8000

# Kòmanse sèvè a
CMD ["node", "server.js"]
