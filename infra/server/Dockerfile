# Production images, built by deploy.sh from the repo checkout (/opt/ewamon/repo) as build context.
# `ewamon/deps` is the repo Dockerfile's `deps` target (workspace + Linux node_modules), tagged by deploy.sh first,
# so the install step stays defined in one place.

# the client bundle: relative URLs, Caddy serves the page and proxies these on the same origin
FROM ewamon/deps:latest AS web
ENV VITE_API_URL=/api \
    VITE_WS_URL=/colyseus \
    VITE_NPC_LLM_URL=/npc/llm/v1 \
    VITE_NPC_LLM_MODEL=gemma4-e2b
WORKDIR /app/packages/client
RUN pnpm exec vite build --outDir /out --emptyOutDir

# exported with `docker build --output`, never run
FROM scratch AS site
COPY --from=web /out /

# Colyseus WS :2567 + Fastify REST :4000; migrations run at boot (main.ts)
FROM ewamon/deps:latest AS server
ENV NODE_ENV=production DATA_DIR=/data PORT_WS=2567 PORT_REST=4000
RUN mkdir -p /data
VOLUME /data
EXPOSE 2567 4000
WORKDIR /app/packages/server
CMD ["pnpm", "start"]
