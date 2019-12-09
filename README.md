# Kmaps Solr Proxy

### Description
A Docker Stack deployed to a Docker Swarm which provides a Reverse Proxy for Solr queries to the kmaps solr indexes.   

- provides the basis for facilitating Public and Private Solr data
- uses OAuth to provide group data to make filtering decisions     
    - Mandala (Drupal) is the OAuth **Server** and **Provider**
    - This proxy is the **Client** which makes calls to Mandala (**Provider**) on behalf of the **User**.

### Implementations used:
- Node.js
- ExpressJs
- Nginx
- Redis
- Docker (Swarm, Stacks, local Registry, Secrets)
- NPM

## Requirements

- [Docker](http://docker.com) Download the app for: [Mac OSX](https://download.docker.com/mac/stable/Docker.dmg) or [Windows 10 App](https://download.docker.com/win/stable/InstallDocker.msi)
- [Docker Compose](http://docs.docker.com/compose/) installation with [homebrew](https://brew.sh/index_de.html) `brew install docker-compose`
- [Docker Swarm](https://docs.docker.com/engine/swarm/swarm-tutorial): Its important to configure your Docker instance to use swarm first.

### Commands

#### Building

- setup the registry: `npm run registry`
- build all images: `npm run build`
- build express only: `npm run build-express`
- build nginx only: `npm run build-nginx`
- build redis only: `npm run build-redis`

#### Deploying

- deploy the application stack: `npm run stack-deploy`
- remove the application stack: `npm run stack-rm`
- reload the application stack: `npm run reload`

#### Other useful commands

- Look at the express logs: `docker service logs bloop_stack_express-server`
- Look at the nginx logs: `docker service logs bloop_stack_nginx-server`
- (_These currently aren't in the package scripts, but I might add them_)

#### Typical build / deploy development cycle

```
# edit and deploy
vi express/server.js
npm run build-express && npm run reload

# check status and logs
npm run sls
docker service logs bloop_stack_express-server
```

### Drupal Configuration

Some example Drupal confguration files reside in the `./drupal` directory. 
 These are configurations that can be used to create example OAuth configs which work with the default configs here.
 
 
 See `drupal/README.md`.   

## Maintainer

**Yuji Shinozaki**

* Email: <yuji.shinozaki@gmail.com>

## Complaints

```cat complaints.txt > /dev/null```

