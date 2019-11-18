FROM node:alpine

RUN apk update && apk upgrade
RUN apk add --no-cache bash git openssh
RUN apk add ruby ruby-irb ruby-rake ruby-io-console ruby-bigdecimal ruby-json ruby-bundler libstdc++ tzdata bash ca-certificates build-base libffi-dev ruby-dev
RUN echo 'gem: --no-document' > /etc/gemrc

RUN gem install bundler:1.16.4
RUN npm i yarn -g

COPY package.json yarn.lock ./
RUN yarn --no-progress

COPY builder.js ./
CMD node builder.js