from fastapi import FastAPI

app = FastAPI(title="Argus Backend")

@app.get("/")
def root():
    return {"message": "Argus backend is running"}
