FROM oven/bun:debian@sha256:e2c0b11e277f0285e089ffb77ad831faeec2833b9c4b04d6d317f054e587ef4e AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock svelte.config.js /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ENV NODE_ENV=production
RUN bun run build

FROM base AS release
# Required for prisma migrations to work on arm64 (oven-sh/bun#5320)
COPY --from=node:20@sha256:7eaecf12ba40043be19af57e2c7fba35d61f9b906128e3e4d11eda81b1ecb857 /usr/local/bin/node /usr/local/bin/node
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /app/build build
COPY --from=prerelease /app/package.json .
COPY --from=prerelease /app/prisma ./prisma

COPY ./docker/entrypoint.sh /app/bin/
RUN chmod +x /app/bin/entrypoint.sh

USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "/app/bin/entrypoint.sh" ]