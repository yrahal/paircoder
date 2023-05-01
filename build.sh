#!/bin/sh

VERSION=0.0.4

cd server/

docker build --platform linux/amd64 -t yrahal/paircoder-server:${VERSION}-amd64 .
docker build --platform linux/arm64 -t yrahal/paircoder-server:${VERSION}-arm64 .

docker push yrahal/paircoder-server:${VERSION}-amd64
docker push yrahal/paircoder-server:${VERSION}-arm64

docker manifest create yrahal/paircoder-server:${VERSION} --amend yrahal/paircoder-server:${VERSION}-amd64 --amend yrahal/paircoder-server:${VERSION}-arm64
docker manifest push yrahal/paircoder-server:${VERSION}

docker manifest create yrahal/paircoder-server:latest --amend yrahal/paircoder-server:${VERSION}-amd64 --amend yrahal/paircoder-server:${VERSION}-arm64
docker manifest push yrahal/paircoder-server:latest
