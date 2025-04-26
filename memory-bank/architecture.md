# Architecture du Projet EXAI (PoC)

**Version :** (Basée sur l'analyse du code au 2024-MM-JJ - *remplacez MM-JJ*)
**Basé sur :** `prd_exai_poc_v2.md`, `tech_stack_exai_v2.md`, `implementation_plan_exai_poc_adjusted.md`, analyse du code existant.

## 1. Vue d'ensemble

Le projet EXAI suit une architecture microservices conçue pour être déployée sur Kubernetes (Minikube pour la PoC). L'objectif est de créer un pipeline intégré : Sélection de Données -> Pipeline ML Guidé -> Explication XAI.

```mermaid
graph LR
    A[Utilisateur] --> B(Frontend Angular);
    B --> C{API Gateway FastAPI};
    C --> D[Service Sélection FastAPI];
    C --> E[Service Pipeline ML FastAPI];
    C --> F[Service XAI FastAPI];
    D --> G[(PostgreSQL)];
    E --> G;
    E --> H[(Redis)];
    E --> I(Celery Worker ML);
    F --> J(Celery Worker XAI);
    F --> H;
    I --> G;
    J --> G;
    subgraph Kubernetes Cluster (Namespace: exai)
        B; C; D; E; F; G; H; I; J;
    end
```

**Composants Principaux :**

*   **`frontend/` :** Interface utilisateur développée avec Angular et Angular Material.
*   **`api-gateway/` :** Point d'entrée unique (FastAPI) gérant l'authentification (JWT via `fastapi-users`) et le routage vers les services backend.
*   **`service-selection/` :** Service FastAPI gérant les métadonnées des datasets (stockées dans PostgreSQL), incluant le CRUD, le filtrage/recherche et le scoring.
*   **`ml-pipeline/` :** Service FastAPI orchestrant l'exécution asynchrone (via Celery/Redis) des tâches d'entraînement et d'évaluation de modèles ML (avec Scikit-learn).
*   **`xai-engine/` :** Service FastAPI orchestrant l'exécution asynchrone (via Celery/Redis) des tâches de génération d'explications XAI (avec SHAP/LIME).
*   **`PostgreSQL` :** Base de données relationnelle pour stocker toutes les métadonnées persistantes (datasets, utilisateurs, runs ML, requêtes XAI). Schéma géré via Alembic.
*   **`Redis` :** Broker de messages pour la communication asynchrone via Celery.
*   **`Celery Workers` :** Processus exécutant les tâches longues (ML et XAI) en arrière-plan.
*   **`Kubernetes (Minikube)` :** Plateforme d'orchestration pour le déploiement et la gestion des conteneurs Docker.
*   **`Skaffold & Kustomize` :** Outils utilisés pour le développement local (build/deploy) et la gestion des configurations K8s par environnement.
*   **`docs/` :** Documentation utilisateur et technique au format Antora/Asciidoc (aspect critique du projet).

## 2. État Actuel des Composants (Basé sur l'analyse du code)

*   **`api-gateway/` :**
    *   **Rôle :** Point d'entrée, Authentification/Autorisation.
    *   **Technos :** FastAPI, Uvicorn, `fastapi-users[sqlalchemy]`, `asyncpg`, Alembic.
    *   **Statut :**
        *   [✅] Configuration FastAPI de base.
        *   [✅] Authentification JWT via `fastapi-users` fonctionnelle (login, register, etc.).
        *   [✅] Table `user` gérée par Alembic.
        *   [✅] Endpoint `/health` présent.
        *   [✅] CORS configuré (permissif).
        *   [⬜] Routage Reverse Proxy vers les autres services **non implémenté**.
        *   [🚧] Déploiement K8s à finaliser (configuration probes, secrets).

*   **`service-selection/` :**
    *   **Rôle :** Gestion des métadonnées des datasets.
    *   **Technos :** FastAPI, Uvicorn, SQLAlchemy, Pydantic, Alembic, `psycopg2-binary`/`asyncpg`.
    *   **Statut :**
        *   [✅] Configuration FastAPI de base.
        *   [✅] Modèle SQLAlchemy `Dataset` défini et complet.
        *   [✅] Schémas Pydantic de base (`DatasetBase`, `Create`, `Update`, `Read`) définis.
        *   [✅] Endpoints CRUD de base (`POST`, `GET /`, `GET /id`, `PUT`, `DELETE`) implémentés.
        *   [✅] Table `datasets` gérée par Alembic.
        *   [🚧] Endpoint `GET /datasets` a une pagination simple, mais **pas de filtrage avancé**.
        *   [⬜] Schémas Pydantic avancés (`FilterCriteria`, `ScoreRequest`, etc.) **non implémentés**.
        *   [⬜] Logique de scoring **non implémentée**.
        *   [⬜] Endpoints `/score`, `/preview`, `/stats` **non implémentés**.
        *   [🚧] Déploiement K8s à finaliser (configuration probes, secrets).

*   **`ml-pipeline/` :**
    *   **Rôle :** Orchestration entraînement ML.
    *   **Technos Prévues :** FastAPI, Celery, Scikit-learn.
    *   **Statut :** [⬜] **Non démarré** (basé sur l'absence de code fourni).

*   **`xai-engine/` :**
    *   **Rôle :** Génération explications XAI.
    *   **Technos Prévues :** FastAPI, Celery, SHAP/LIME.
    *   **Statut :** [⬜] **Non démarré** (basé sur l'absence de code fourni).

*   **`frontend/` :**
    *   **Rôle :** Interface Utilisateur.
    *   **Technos :** Angular, Angular Material, TypeScript.
    *   **Statut :**
        *   [✅] Projet Angular initialisé.
        *   [✅] Angular Material ajouté comme dépendance.
        *   [🚧] Structure de base présente (`services`, `pages`, `layouts`...).
        *   [🚧] Service `AuthService` et module/pages d'authentification en cours de développement.
        *   [⬜] Services API dédiés (`DatasetService`, `PipelineService`...) **non implémentés**.
        *   [⬜] Modules/Composants fonctionnels principaux (Sélection Dataset, Pipeline ML, XAI) **non implémentés** ou structurés différemment du plan.
        *   [⬜] Déploiement K8s non configuré.

*   **Infrastructure :**
    *   [✅] PostgreSQL déployé sur K8s et accessible.
    *   [⬜] Redis non déployé.
    *   [⬜] Workers Celery non déployés.
    *   [⬜] Ingress Controller non configuré.

## 3. Interactions Clés

*   Le **Frontend** communique exclusivement avec l'**API Gateway**.
*   L'**API Gateway** valide l'authentification (JWT) et relaie les requêtes aux services backend appropriés (fonctionnalité de proxy **à implémenter**).
*   **`service-selection`**, **`ml-pipeline`**, **`xai-engine`** interagissent avec la base de données **PostgreSQL** (via SQLAlchemy et Alembic pour les migrations).
*   **`ml-pipeline`** et **`xai-engine`** utilisent **Redis** comme broker pour envoyer/recevoir des tâches via **Celery Workers**.
*   Les **Celery Workers** interagissent avec **PostgreSQL** pour lire/écrire les statuts et résultats, et potentiellement avec un stockage de fichiers partagé (PV K8s / Blob Storage) pour lire/écrire des datasets/modèles/résultats.

## 4. Documentation

*   La documentation utilisateur et technique doit être générée dans `docs/` en utilisant **Antora/Asciidoc**. C'est une exigence forte du projet. (Statut actuel : Probablement [⬜]) 