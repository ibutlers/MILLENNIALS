FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile=false
FROM deps AS build
COPY . .
RUN pnpm --filter @realstate/api build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --prod --filter @realstate/api --frozen-lockfile=false
COPY --from=build /app/apps/api/dist apps/api/dist
EXPOSE 3001
CMD ["node","apps/api/dist/server.js"]
