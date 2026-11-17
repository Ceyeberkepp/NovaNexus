FROM node:26-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY go.mod ./
COPY backend ./backend
RUN go mod tidy && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /novanexus ./backend

FROM alpine:3.24
RUN addgroup -S nova && adduser -S -G nova nova && apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=frontend /app/dist ./dist
COPY --from=backend /novanexus /usr/local/bin/novanexus
ENV NODE_ENV=production PORT=3000
USER nova
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/novanexus"]
