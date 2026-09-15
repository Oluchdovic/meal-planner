FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN yarn install --frozen-lockfile

FROM deps AS web-build
WORKDIR /app
COPY web/ ./web/
RUN yarn workspace meal-planner-web build

FROM deps AS server-build
WORKDIR /app
COPY server/ ./server/
RUN yarn workspace meal-planner-server build

FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV WEB_DIST_DIR=/app/web/dist

COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/server/package.json ./server/package.json
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/migrations ./server/migrations
COPY --from=web-build /app/web/dist ./web/dist

EXPOSE 3000

CMD ["node", "server/dist/server.js"]
