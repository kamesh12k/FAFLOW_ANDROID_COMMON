FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;

    location /assets/ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
