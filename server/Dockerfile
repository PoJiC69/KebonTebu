FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# expose port
EXPOSE 3000

# create data directory
VOLUME [ "/app/data" ]

CMD ["node", "index.js"]