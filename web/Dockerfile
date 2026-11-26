# syntax=docker/dockerfile:1
# The web app as static files served by nginx, which also proxies /api to the Rails API,
# so the browser sees one origin and the session cookie stays same-site.
#
#   docker build -t employee-information-system-web .
#   docker run -p 8080:80 -e API_UPSTREAM=http://host.docker.internal:3000 employee-information-system-web

# Build stage. Debian-based, not Alpine: the TypeScript 7 and Rolldown native binaries need glibc.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Base path of the API as the browser sees it; nginx forwards it to API_UPSTREAM.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Runtime stage.
FROM nginx:1.29-alpine
# The official image renders /etc/nginx/templates/*.template with the container's environment
# (defined variables only, so nginx's own $variables are left alone).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://api:3000
EXPOSE 80
