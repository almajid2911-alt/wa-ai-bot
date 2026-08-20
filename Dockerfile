FROM node:20-alpine

# Install build dependencies jika diperlukan
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependensi
RUN npm install --omit=dev

# Copy seluruh source code
COPY . .

# Expose Port Web Server
EXPOSE 3000

# Environment default
ENV PORT=3000
ENV NODE_ENV=production

# Jalankan aplikasi
CMD ["npm", "start"]
