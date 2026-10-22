# Ewamon Remastered, standalone: `docker compose up --build` (see docker-compose.yml).
# Targets: `server` (Colyseus WS + Fastify REST under tsx, PGlite in /data) and `web` (the built client behind nginx,
# which also proxies /api, /colyseus and the NPC voice LLM, so the browser only ever talks to one origin).

FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app
COPY . .
# only the game's packages; the asset tools (sharp, playwright, …) stay out of the image
RUN pnpm install --frozen-lockfile --filter "@ewa/server..." --filter "@ewa/client..."

FROM deps AS client-build
# relative: nginx serves the client and proxies these on the same origin (packages/client/src/net/api.ts, npcChat.ts)
ARG VITE_API_URL=/api
ARG VITE_NPC_LLM_URL=/voice/llm/v1
ARG VITE_NPC_TOOL_URL=/voice/tools/v1
ARG VITE_NPC_LLM_MODEL=gemma3-1b
# the client needs an absolute socket URL (net/WorldSession.ts defaultWsUrl); docker-compose.yml sets it from EWA_PORT,
# a public host would use e.g. wss://ewamon.example.com/colyseus
ARG VITE_WS_URL=ws://localhost:8080/colyseus
# llama.cpp turns thinking off itself (`--reasoning-budget 0`, docker-compose.yml); the Llama.cpp switch the client
# sends by default would stop it enforcing the tool pass's `tool_choice: required` (voice/npcChat.ts `reasoning`)
ARG VITE_NPC_LLM_REASONING=default
ARG VITE_NPC_TOOL_REASONING=default
ENV VITE_API_URL=$VITE_API_URL VITE_NPC_LLM_URL=$VITE_NPC_LLM_URL VITE_NPC_TOOL_URL=$VITE_NPC_TOOL_URL \
    VITE_NPC_LLM_MODEL=$VITE_NPC_LLM_MODEL VITE_WS_URL=$VITE_WS_URL \
    VITE_NPC_LLM_REASONING=$VITE_NPC_LLM_REASONING VITE_NPC_TOOL_REASONING=$VITE_NPC_TOOL_REASONING
RUN pnpm --filter @ewa/client exec vite build

FROM deps AS server
ENV NODE_ENV=development DATA_DIR=/data PORT_WS=2567 PORT_REST=4000
RUN mkdir -p /data
VOLUME /data
EXPOSE 2567 4000
WORKDIR /app/packages/server
CMD ["pnpm", "start"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/packages/client/dist /usr/share/nginx/html
EXPOSE 8080
