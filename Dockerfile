# Ewamon Remastered, standalone with live reload: `docker compose up -d --build` (see docker-compose.yml).
# Targets: `deps` (the workspace and its Linux node_modules; the `client` service runs the Vite dev server from it)
# and `server` (Colyseus WS + Fastify REST under `tsx watch`, the compose `postgres` service as its database, mail
# files in /data). The sources are mounted at run time.

FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app
COPY . .
# only the game's packages; the asset tools (sharp, playwright, …) stay out of the image
RUN pnpm install --frozen-lockfile --filter "@ewa/server..." --filter "@ewa/client..."

FROM deps AS server
ENV NODE_ENV=development DATA_DIR=/data PORT_WS=2567 PORT_REST=4000
RUN mkdir -p /data
VOLUME /data
EXPOSE 2567 4000
WORKDIR /app/packages/server
CMD ["pnpm", "dev"]
