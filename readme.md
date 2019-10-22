# DevExtreme Reactive - Continues Deployment

## Installation

Add the `.env` file in the project's root directory. Add the following variables according to Github.

```
USER=username
GITHUB_TOKEN=yourgithubtoken
```

*About Github token you can reed in the [following guide](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line).*


## Start

Install the Docker and run the following commands:

*build project*

```
docker-compose build
```
*run project*

```
docker-compose up
```

The service will start on the *port* (You can see the port number in the `docker-compose/yml` file).

## Issues

This service have used [@octokit/rest](https://octokit.github.io/rest.js) library to connect to Github. Auth problems can be. To resolve it's update code inside `builder/builder.js` file.