# syntax=docker/dockerfile:1
FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY apps/server/go.mod apps/server/go.sum ./
RUN go mod download
COPY apps/server/ ./
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/api

# headless-shell 自带精简版 headless Chromium；中文渲染必须补装 CJK 字体。
FROM chromedp/headless-shell:stable
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fontconfig fonts-noto-cjk tzdata \
    && fc-cache -f && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/server /usr/local/bin/vega-server
ENV CHROME_EXEC_PATH=/headless-shell/headless-shell
EXPOSE 8080
# 基础镜像的 ENTRYPOINT 是 headless-shell 本体，必须覆盖为 API 服务。
ENTRYPOINT ["/usr/local/bin/vega-server"]
