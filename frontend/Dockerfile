# ==============================================================================
# Brand Bridge Frontend - Multi-Stage Production Dockerfile
# ==============================================================================
# Stage 1: Build Application Bundle
# Stage 2: Serve Production Assets via Nginx Alpine
# ==============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Install npm dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source files
COPY . .

# Build-time environment variable for the backend API URL
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Build optimized production bundle
RUN npm run build


# ------------------------------------------------------------------------------
# Stage 2: Nginx Web Server
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default nginx configuration
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom production nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose web server HTTP port
EXPOSE 80

# Healthcheck probe to verify Nginx is actively serving the SPA
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
