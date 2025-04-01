# Stage 1: Build
FROM node:20-alpine as builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN npm install -g pnpm

# Copy package files and config files
COPY package.json pnpm-lock.yaml tsconfig.json tsup.config.ts ./

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src

# Build the application
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine as production
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and built assets
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Environment variables
ENV PORT=8090
ENV NODE_ENV=production
ENV DEBUG=*

# Expose port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8090/health || exit 1

# Start the application with debugging flags
CMD ["node", "--enable-source-maps", "--inspect=0.0.0.0:9229", "dist/server.esm.js"] 