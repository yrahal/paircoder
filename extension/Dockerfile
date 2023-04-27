FROM node:18.7.0-bullseye-slim

RUN apt-get update --fix-missing && \
    apt-get install -y curl git && \
    apt-get clean && \
    apt-get autoremove -y && \
    rm -r /var/lib/apt/lists/*

RUN curl https://get.docker.com | sh && \
    apt-get clean && \
    apt-get autoremove -y && \
    rm -r /var/lib/apt/lists/*

RUN npm install -g @vscode/vsce
