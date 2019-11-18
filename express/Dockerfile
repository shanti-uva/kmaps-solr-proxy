FROM node:7.9-alpine
MAINTAINER Yuji Shinozaki <yuji.shinozaki@gmail.com>

#--------------
# Arguments
#--------------
ARG dir
ARG port
ARG env

#--------------
# Variables
#--------------
ENV HOME_DIR $dir
ENV PORT $port
ENV BUILDVAR $env
# ENV DEBUG express-http-proxy


# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
COPY package.json /tmp/package.json
RUN cd /tmp && yarn
RUN mkdir -p $HOME_DIR && cp -a /tmp/node_modules $HOME_DIR/
RUN apk update && apk add \
  openssl \
  curl

WORKDIR $HOME_DIR
COPY . $HOME_DIR

# Expose port 3000 for NGINX
EXPOSE $PORT

CMD yarn start
