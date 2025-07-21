from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv

# On charge les variables d'environnement depuis un fichier .env
# C'est pratique pour la configuration locale sans hardcoder les secrets.
load_dotenv()

# On récupère l'URL de la base de données depuis les variables d'environnement.
# Si DATABASE_URL n'est pas définie, on utilise une valeur par défaut
# qui est généralement adaptée pour une configuration Docker Compose.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@db:5432/ibisxdb"
)

# On crée le "moteur" SQLAlchemy.
# C'est le point d'entrée principal pour interagir avec la base de données.
# Il gère les connexions et l'exécution des requêtes SQL.
engine = create_engine(DATABASE_URL)

# On configure une "fabrique" de sessions (SessionLocal).
# Chaque instance créée par SessionLocal sera une session de base de données indépendante.
# `autocommit=False` et `autoflush=False` sont des paramètres courants pour les API web,
# nous donnant plus de contrôle sur les transactions.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# On récupère la classe de base déclarative définie dans nos modèles.
# C'est nécessaire pour que SQLAlchemy connaisse nos tables.
# Dans une application plus grande, on pourrait importer Base depuis models.py
Base = declarative_base() # Assurez-vous que c'est bien la même Base que dans models.py

def get_db():
    """
    Fonction de dépendance FastAPI pour obtenir une session de base de données.

    Cette fonction est conçue pour être utilisée avec `Depends()` dans les routes FastAPI.
    Elle crée une nouvelle session SQLAlchemy pour chaque requête entrante,
    la fournit à la fonction de route, puis s'assure qu'elle est fermée
    une fois la requête terminée (même en cas d'erreur).

    Yields:
        Session: Une instance de session SQLAlchemy.
    """
    db = SessionLocal()
    try:
        # Le `yield` fournit la session à la route qui l'a demandée.
        # L'exécution de la route se produit ici.
        yield db
    finally:
        # Quoi qu'il arrive (succès ou erreur dans la route),
        # on s'assure de fermer la session pour libérer les ressources.
        db.close()
