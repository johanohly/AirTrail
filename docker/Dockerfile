FROM oven/bun:debian AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ENV NODE_ENV=production
RUN bun run build

FROM node:22-slim AS release
WORKDIR /app
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=build /app/build build
COPY --from=build /app/package.json .
COPY --from=build /app/prisma/migrations ./prisma/migrations

COPY ./docker/migrate.js /app/docker/
COPY ./docker/entrypoint.sh /app/bin/
RUN chmod +x /app/bin/entrypoint.sh

USER node
EXPOSE 3000/tcp
ENTRYPOINT [ "/app/bin/entrypoint.sh" ]
