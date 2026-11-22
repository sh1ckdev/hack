FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile \
    --store-dir=/pnpm/store --fetch-timeout=180000 --fetch-retries=3
COPY . .
ARG VITE_ITSM_INCIDENT_URL
RUN npm run build:deploy

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
RUN install -d -o node -g node /app/data /app/.local
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --chown=node:node --from=build /app/data/character_problems.json ./data/
USER node
EXPOSE 8080
CMD ["node", "dist-server/production.js"]
