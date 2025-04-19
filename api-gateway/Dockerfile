FROM python:3.11-slim

WORKDIR /app

# Copier d'abord le fichier des dépendances
COPY requirements.txt .

# Installer les dépendances
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code de l'application depuis le sous-dossier local app/
COPY ./app /app

# Exposer le port (optionnel mais bonne pratique)
EXPOSE 8088

# Commande de démarrage
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088"]
