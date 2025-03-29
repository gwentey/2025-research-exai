from fastapi import FastAPI
from database import get_db
from models import Dataset

app = FastAPI()

@app.get("/datasets")
def list_datasets():
    db = get_db()
    return db.query(Dataset).all()
