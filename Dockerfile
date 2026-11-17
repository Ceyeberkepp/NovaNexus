FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
USER node
EXPOSE 3000
CMD ["node","server/index.js"]
