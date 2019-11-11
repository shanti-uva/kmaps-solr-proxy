FROM redis:alpine

RUN apk update && apk add \
  openssl \
  curl

COPY redis.conf /usr/local/etc/redis/redis.conf