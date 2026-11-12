# Web app image (E11-F08): Vite build served by nginx, /api proxied to the API container.
#   docker build -t myvideo-web .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/stage/package.json packages/stage/
COPY packages/timeline-core/package.json packages/timeline-core/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @myvideo/web build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
