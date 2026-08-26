# ============================================================
# Smart Space — multi-stage Docker build
# Stage 1: build frontend (Vite)
# Stage 2: build backend TypeScript -> dist (perlu `typescript` devDep)
# Stage 3: lean runtime (production deps saja + artifact hasil build)
# ============================================================

# ---------- Stage 1: frontend build ----------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: backend build ----------
# Perhatian: `typescript` ada di devDependencies, jadi di sini kami
# butuh `npm ci` penuh (tanpa --omit=dev) agar `tsc` tersedia.
# Pada stage sebelumnya `--omit=dev` dipakai, sehingga `npx tsc`
# gagal karena paket `typescript` tidak terpasang (npx justru
# mengunduh paket tak-berkaitan `tsc@2.0.4`).
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build

# ---------- Stage 3: lean runtime ----------
FROM node:22-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
# production dependencies saja (tanpa typescript/tsx) agar image ramping
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# salin hasil kompilasi backend (bukan source) + frontend statis
COPY --from=backend-builder /app/backend/dist /app/backend/dist
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/backend/data /app/backend/uploads

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "dist/index.js"]