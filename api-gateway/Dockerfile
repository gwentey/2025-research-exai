FROM python:3.11-slim

WORKDIR /app

# Copier d'abord le fichier des dépendances
COPY requirements.txt .

# Installer les dépendances
RUN pip install --no-cache-dir -r requirements.txt

# Créer la structure de répertoires initiale
RUN mkdir -p /app/api_gateway

# Copier le code de l'application dans le répertoire api_gateway
COPY ./app /app/api_gateway

# Copier les fichiers Alembic nécessaires aux migrations
COPY ./alembic /app/alembic
COPY alembic.ini /app/

# Créer un fichier principal qui importe correctement l'application
RUN echo 'import sys\nsys.path.insert(0, "/app")\nfrom api_gateway.main import app' > /app/start.py

# Exposer le port pour l'API
EXPOSE 8088

# Commande de démarrage
CMD ["uvicorn", "start:app", "--host", "0.0.0.0", "--port", "8088"]
