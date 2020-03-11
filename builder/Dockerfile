FROM node:12.16.1-alpine3.10

RUN apk update && apk upgrade
RUN apk add --no-cache bash git openssh

# RUN npm i yarn@1.22.0 -g # The yarn has been added by Docker image - 12.16.1-alpine3.10

COPY package.json yarn.lock ./
RUN yarn --no-progress

COPY builder.js ./
CMD node builder.js