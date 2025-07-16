# --- Phase 1: Construction de l'image --- #

# On part d'une image Python officielle, version 3.11, en version "slim".
# "slim" est une version légère qui contient le minimum nécessaire pour exécuter Python.
FROM python:3.11-slim

# On définit le répertoire de travail par défaut à l'intérieur du conteneur.
# Toutes les commandes suivantes (COPY, RUN, CMD) seront exécutées depuis ce répertoire.
WORKDIR /app

# Installation des dépendances système nécessaires.
# - `postgresql-client` est nécessaire si notre application doit interagir directement
#   avec la base de données via des commandes `psql` (par exemple, pour des migrations).
# - `build-essential` fournit les outils de compilation (gcc, g++, make) requis pour pyarrow.
# - `apt-get update` met à jour la liste des packages disponibles.
# - `apt-get install -y` installe les packages sans demander de confirmation.
# - `&& rm -rf /var/lib/apt/lists/*` nettoie le cache apt pour réduire la taille de l'image.
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copie du fichier des dépendances Python dans le conteneur.
# On copie `requirements.txt` d'abord pour profiter du cache Docker :
# Si ce fichier ne change pas, les couches suivantes n'auront pas besoin d'être reconstruites souvent.
COPY service-selection/requirements.txt .

# Installation des dépendances Python listées dans requirements.txt.
# `--no-cache-dir` désactive le cache pip pour réduire la taille de l'image.
# `-r requirements.txt` indique à pip d'installer les packages de ce fichier.
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source de l'application (depuis le sous-dossier ./app)
# dans le répertoire de travail `/app` du conteneur.
COPY service-selection/app /app

# Copie des scripts d'initialisation et de maintenance
COPY service-selection/scripts /app/scripts

# Copie du module commun de stockage d'objets (depuis la racine)
COPY common /app/common

# Copie des vrais datasets CSV
COPY service-selection/datasets /app/datasets

# Copie des fichiers Alembic nécessaires aux migrations de base de données
COPY service-selection/alembic /app/alembic
COPY service-selection/alembic.ini /app/

# --- Phase 2: Configuration de l'environnement d'exécution --- #

# Création d'un utilisateur dédié non-root (`appuser`) pour exécuter l'application.
# C'est une bonne pratique de sécurité de ne pas exécuter les processus en tant que root.
# `useradd -m` crée l'utilisateur et son répertoire home.
# `chown -R appuser:appuser /app` donne la propriété du répertoire de l'application à cet utilisateur.
RUN useradd -m appuser && chown -R appuser:appuser /app

# On définit l'utilisateur `appuser` comme celui qui exécutera les commandes suivantes (CMD).
USER appuser

# Définition des variables d'environnement pour l'exécution.
# `PYTHONUNBUFFERED=1` : Force Python à écrire les logs directement sans bufferisation,
# ce qui est utile pour voir les logs en temps réel (notamment avec Docker).
ENV PYTHONUNBUFFERED=1
# `DATABASE_URL` : Définit l'URL de connexion par défaut à la base de données.
# Cette valeur sera utilisée si elle n'est pas surchargée (par exemple par Docker Compose ou Kubernetes).
ENV DATABASE_URL=postgresql://user:password@db:5432/exaidb

# --- Phase 3: Commande de démarrage --- #

# Commande par défaut qui sera exécutée lorsque le conteneur démarre.
# On utilise `uvicorn` pour lancer notre application FastAPI (`main:app`).
# `--host 0.0.0.0` : Permet au serveur d'écouter sur toutes les interfaces réseau du conteneur,
# le rendant accessible depuis l'extérieur (via le mapping de ports Docker).
# `--port 8081` : Le port sur lequel Uvicorn écoutera à l'intérieur du conteneur.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
