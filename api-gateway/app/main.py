from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Configuration CORS
origins = [
    "*",  # Autorise toutes les origines (à restreindre en production)
    # Exemple si le frontend Angular tourne sur localhost:4200 :
    # "http://localhost:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # Autorise les cookies (si nécessaire pour JWT)
    allow_methods=["*"],  # Autorise toutes les méthodes (GET, POST, etc.)
    allow_headers=["*"],  # Autorise tous les en-têtes
)

@app.get("/ping")
def ping():
    return {"message": "pong from API Gateway"}
