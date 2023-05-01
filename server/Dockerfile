FROM gcc:10.4.0-buster AS builder

COPY llama.cpp /llama.cpp

RUN cd /llama.cpp && make -j

FROM python:3.10.1-slim-bullseye

RUN pip install fastapi uvicorn

RUN adduser paircoder

USER paircoder:paircoder

WORKDIR /app

COPY --from=builder /llama.cpp/main /app/llama.cpp

COPY server.py .

CMD uvicorn server:app --host 0.0.0.0 --port 80
