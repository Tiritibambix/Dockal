# builder stage: install all deps and build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# install dev + prod deps to run tsc
RUN npm ci

COPY . .
RUN npm run build

# runtime stage: install only production deps and copy built artifacts
FROM node:20-alpine AS runtime

WORKDIR /app

COPY package*.json ./
# install only production deps
RUN npm ci --omit=dev

# copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
