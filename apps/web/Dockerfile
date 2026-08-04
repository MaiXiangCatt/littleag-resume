# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
ARG BUILD_REVISION=local
ENV BUILD_REVISION=${BUILD_REVISION}
RUN corepack enable
WORKDIR /src
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/vega-cli/package.json packages/vega-cli/
RUN pnpm install --frozen-lockfile --filter web
COPY contracts/ contracts/
COPY docs/legal/ docs/legal/
COPY apps/web/ apps/web/
RUN pnpm --filter web build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
EXPOSE 80
