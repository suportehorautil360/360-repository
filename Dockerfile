# syntax=docker/dockerfile:1
# Web admin (Vite + React) — build estático servido pelo nginx.
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
# Base da API NestJS embutida no build (Vite lê VITE_* do process.env).
# Sem isso, o build de produção cai em BASE_URL="/api" (sem proxy no nginx).
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# .env (VITE_*) é lido pelo Vite no build — precisa estar no contexto.
COPY . .
RUN pnpm build

# ── runner: nginx servindo o dist/ com fallback de SPA ──
FROM nginx:alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
