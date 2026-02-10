# builder stage: install all deps and build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# install dev + prod deps to run tsc
RUN npm install

COPY . .
RUN npm run build
# remove devDependencies to keep only production deps
RUN npm prune --production

# runtime stage: copy built artifacts and production deps from builder
FROM node:20-alpine AS runtime

WORKDIR /app
# copy compiled output and production node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
