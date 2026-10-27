# Interface Angular - build multi-étapes : compilation Node puis service via nginx.
#   docker build -t cnps-web ./web
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# configuration : SPA + reverse-proxy /api -> service "api"
COPY nginx.conf /etc/nginx/conf.d/default.conf
# le builder Angular place le site dans dist/web/browser
COPY --from=build /app/dist/web/browser /usr/share/nginx/html
EXPOSE 80
