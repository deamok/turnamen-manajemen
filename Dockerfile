# Tahap 1: Build aplikasi React/Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Salin package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Install dependensi
RUN npm install

# Salin semua source code ke dalam container
COPY . .

# Jalankan proses build (akan menghasilkan folder dist/)
RUN npm run build

# Tahap 2: Setup web server Nginx
FROM nginx:alpine

# Salin konfigurasi nginx custom
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Salin hasil build dari tahap 1 ke folder Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Ekspos port 80 untuk lalu lintas HTTP
EXPOSE 80

# Jalankan Nginx
CMD ["nginx", "-g", "daemon off;"]
