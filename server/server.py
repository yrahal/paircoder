import asyncio
import logging
import os
import subprocess
import sys
import glob

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI()

model = ""
models_path = "/models"

@app.on_event("startup")
async def startup_event():
    global model

    model = os.getenv("MODEL")
    
    if model != None:
        log.info(f"Using model '{model}'")
    else:
        log.info(f"Reading from '{models_path}'...")
        files = [f for f in glob.glob(os.path.join(models_path , "*.bin"))]
        if len(files) == 0:
            raise Exception("No models found")
        else:
            log.info(f"Found {len(files)} models. Using '{files[0]}'")
            model = files[0]
    
    model = os.path.join(models_path, model)
    if not os.path.exists(model):
        raise Exception(f"Could not find file '{model}'")

async def predict_streamer(input_json):
    prompt = input_json["prompt"]
    n_predict = str(input_json.get("n_predict", 128))
    clip_prompt = input_json.get("clip_prompt", False)

    mod_prompt = None
    cumulative = None

    if clip_prompt:
        log.info("Clipping prompt...")
    
    process = await asyncio.create_subprocess_exec("./llama.cpp", "-m", model, "-n", n_predict, "-p", prompt, stdout=asyncio.subprocess.PIPE)

    try:
        while True:
            if process.stdout.at_eof():
                break
            
            c = await process.stdout.read(1)
            if clip_prompt:
                cumulative = cumulative if cumulative != None else ""
                mod_prompt = mod_prompt if mod_prompt != None else " " + prompt
                
                cumulative += c.decode()
                if mod_prompt.startswith(cumulative):
                    continue
                else:
                    clip_prompt = False
            
            yield c
            
        log.info("Prediction completed.")
    finally:
        if process.returncode is None:
            log.info("Terminating running process...")
            process.terminate()
        log.info("Streaming completed.")

@app.post("/predict")
async def predict(request: Request):
    try:
        input_json = await request.json()
    except Exception as e:
        log.error(e)
        raise HTTPException(status_code=400)

    return StreamingResponse(predict_streamer(input_json))
