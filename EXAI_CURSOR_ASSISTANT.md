# EXAI - Assistant IA pour développement PoC XAI

Ce fichier Markdown sert de **document de référence centralisé** pour le développement du Proof of Concept (PoC) **EXAI**. Il est conçu pour être utilisé avec des assistants IA comme Cursor, afin de maintenir une compréhension partagée et à jour du projet.

Il décrit :
- Les **objectifs scientifiques et pédagogiques**.
- L'**architecture technique détaillée** (microservices, technologies).
- Les **fonctionnalités attendues** pour chaque module.
- Les **étapes de développement et déploiement** sur Kubernetes (Minikube).
- L'**état d'avancement** (✅ Fait / ⬜ À faire / 🚧 En cours).
- Les **conseils et conventions** pour le développement assisté par IA.

---

## 🎯 Objectif général du projet (Rappel)
Développer une **plateforme pédagogique intelligente et modulaire** pour accompagner les utilisateurs (étudiants, enseignants, analystes) dans :
1.  ✅ La **sélection technique et éthique de jeux de données** adaptés à leurs besoins.
2.  ✅ La **création et l'exécution guidées de pipelines ML interactifs** (classification, régression, clustering).
3.  ✅ La **compréhension et l'explicabilité (XAI)** des modèles et de leurs résultats via des techniques adaptées (ex : SHAP, LIME).

Ce projet est un **PoC académique**, visant la validation scientifique, mais avec un potentiel d'application dans divers domaines (santé, finance, etc.).

---

## 🧱 Architecture Générale (Microservices Kubernetes)

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

**Flux simplifié :**
1.  L'utilisateur interagit avec le **Frontend**.
2.  Le Frontend envoie des requêtes à l'**API Gateway**.
3.  L'API Gateway (point d'entrée unique) route les requêtes vers les microservices appropriés :
    *   **Service Sélection** pour gérer les datasets.
    *   **Service Pipeline ML** pour l'entraînement des modèles.
    *   **Service XAI** pour générer les explications.
4.  Les services communiquent si nécessaire (ex: Pipeline ML récupère les infos dataset via Service Sélection ou directement via la BDD partagée).
5.  **PostgreSQL** stocke les métadonnées (datasets, utilisateurs, runs ML, résultats XAI).
6.  **Redis** sert de broker pour **Celery** qui exécute les tâches longues (entraînement ML, calculs XAI) de manière asynchrone via des Workers dédiés.

### Technologies principales par composant
| Composant             | Technologie Principale                     | Rôle / Détails                                       | Statut Initial |
|-----------------------|--------------------------------------------|------------------------------------------------------|----------------|
| **Frontend**          | Angular, Tailwind CSS                      | Interface utilisateur interactive et pédagogique       | ⬜             |
| **API Gateway**       | FastAPI                                    | Point d'entrée, routage, sécurité (JWT?), CORS      | 🚧 En cours    |
| **Sélection Service** | FastAPI, SQLAlchemy, Pydantic             | CRUD Datasets, recherche/filtrage, métriques qualité | ✅ (Base)      |
| **ML Pipeline Service**| FastAPI, Celery, Scikit-learn, Pydantic   | Orchestration entraînement ML asynchrone            | ⬜             |
| **XAI Service**       | FastAPI, Celery, SHAP, LIME, PDPbox       | Génération d'explications ML asynchrones             | ⬜             |
| **Base de données**   | PostgreSQL                                 | Stockage persistant des métadonnées                 | ⬜             |
| **Message Broker**    | Redis                                      | File d'attente pour tâches asynchrones Celery        | ⬜             |
| **Task Queue Workers**| Celery                                     | Workers pour exécuter les tâches ML et XAI         | ⬜             |
| **Orchestration**     | Kubernetes (Minikube localement), Docker   | Déploiement, scaling, gestion des conteneurs         | ✅ (Base)      |
| **Ingress (Optionnel)**| NGINX Ingress Controller                  | Routage avancé K8s, potentiellement HTTPS          | ⬜             |

---

## 📦 Microservices : Détails et Étapes

### ✅ API Gateway (`service-api-gateway`, port K8s: 8088)
*   **Objectif :** Point d'entrée unique, sécurisé et routage vers les services backend.
*   **Technos :** FastAPI, Uvicorn, **fastapi-users (pour JWT/Auth)**.
*   **État actuel :** [🚧] Base FastAPI + route `/ping` déployée. CORS configuré (permissif). **Configuration initiale `fastapi-users` en cours.**
*   **Étapes restantes :**
    *   [✅] Configurer CORS pour autoriser le Frontend Angular. (Fait, configuration permissive)
    *   [🚧] Mettre en place la sécurité (JWT via **fastapi-users**) :
        *   [✅] Ajout dépendances (`fastapi-users[sqlalchemy]`, `asyncpg`).
        *   [✅] Création fichiers config (`core/config.py`), db (`db.py`), modèles (`models/user.py`), schemas (`schemas/user.py`).
        *   [⬜] Initialiser `fastapi-users` (gestionnaire d'utilisateurs, backend d'authentification JWT).
        *   [⬜] Intégrer les routeurs `fastapi-users` (auth, register, users) dans `main.py`.
        *   [⬜] Assurer la connexion à la base de données PostgreSQL (nécessite BDD déployée).
        *   [⬜] Gérer la `SECRET_KEY` et `DATABASE_URL` via Secrets K8s.
    *   [⬜] Ajouter les routes de reverse proxy vers :
        *   [⬜] `/datasets/**` → `service-selection:8081`
        *   [⬜] `/pipelines/**` → `service-ml-pipeline:8082`
        *   [⬜] `/xai/**` → `service-xai:8083`
    *   [⬜] Mettre en place logging et monitoring centralisé (optionnel pour PoC).
    *   [⬜] Mettre à jour `deployment.yaml` et `service.yaml` si nécessaire.

### ✅ Microservice : Dataset Selection (`service-selection`, port K8s: 8081)
*   **Objectif :** Gérer les métadonnées des datasets, permettre la recherche et la sélection.
*   **Technos :** FastAPI, SQLAlchemy, Pydantic, PostgreSQL (via `DATABASE_URL`).
*   **État actuel :** [✅] Base FastAPI + SQLAlchemy + Dockerfile + déploiement K8s basique. Modèle `Dataset` initial défini.
*   **Étapes restantes :**
    *   [⬜] **Connexion BDD :**
        *   [⬜] Assurer la connexion effective à PostgreSQL une fois déployé (via K8s Service name et Secret/ConfigMap pour `DATABASE_URL`).
        *   [⬜] Initialiser la table `datasets` (voir section PostgreSQL).
    *   [⬜] **Modèle de données (`models.py`) :**
        *   [⬜] Affiner le modèle SQLAlchemy `Dataset` (ajouter : `file_path`, `source`, `size`, `task_type` (classification/régression), `ethical_tags`, `quality_score`, `preview_data` (json?), `metadata` (json?)).
        *   [⬜] Créer les modèles Pydantic (`schemas.py`) pour la validation des requêtes/réponses API (`DatasetCreate`, `DatasetRead`, etc.).
    *   [⬜] **Endpoints REST (`main.py`/`routers/`) :**
        *   [⬜] `POST /datasets`: Créer un nouveau dataset (upload de fichier? ou référence?).
        *   [⬜] `GET /datasets`: Lister les datasets avec filtres (nom, tags, type de tâche...).
        *   [⬜] `GET /datasets/{dataset_id}`: Obtenir les détails d'un dataset.
        *   [⬜] `PUT /datasets/{dataset_id}`: Mettre à jour un dataset.
        *   [⬜] `DELETE /datasets/{dataset_id}`: Supprimer un dataset.
        *   [⬜] `GET /datasets/search`: Endpoint pour recherche avancée (critères multiples).
        *   [⬜] `GET /datasets/{dataset_id}/preview`: Obtenir un aperçu des données.
        *   [⬜] `GET /datasets/{dataset_id}/stats`: Calculer et retourner des statistiques de base.
    *   [⬜] **Logique métier (`services.py` / `crud.py`) :**
        *   [⬜] Implémenter la logique de calcul du score de qualité/pertinence.
        *   [⬜] Implémenter la logique de filtrage/recherche.
    *   [⬜] **Déploiement K8s (`deployment.yaml`, `service.yaml`) :**
        *   [⬜] Configurer les variables d'environnement (ex: `DATABASE_URL` via Secret).
        *   [⬜] Assurer les probes liveness/readiness.

### ⬜ Microservice : ML Pipeline (`service-ml-pipeline`, port K8s: 8082)
*   **Objectif :** Exécuter des pipelines ML (prétraitement, entraînement, évaluation) de manière asynchrone.
*   **Technos :** FastAPI, Celery, Redis, Scikit-learn, Pandas, Pydantic.
*   **Étapes :**
    *   [⬜] **Infrastructure Asynchrone :**
        *   [⬜] Configurer Celery (worker + beat pour tâches planifiées si besoin).
        *   [⬜] Intégrer avec Redis (broker et backend de résultats).
        *   [⬜] Créer le `Dockerfile` pour le service FastAPI et un autre pour le(s) Worker(s) Celery.
        *   [⬜] Déployer Redis sur K8s (voir section Redis).
        *   [⬜] Déployer le service FastAPI et le(s) worker(s) Celery sur K8s (`deployment.yaml`, `service.yaml`).
    *   [⬜] **Modèles de données (`models.py`, `schemas.py`) :**
        *   [⬜] Modèle SQLAlchemy `PipelineRun` (status, config, dataset_id, model_path, metrics, start_time, end_time).
        *   [⬜] Modèles Pydantic pour les requêtes API (`PipelineConfig`, `PipelineRunStatus`).
    *   [⬜] **Endpoints REST (`main.py`/`routers/`) :**
        *   [⬜] `POST /pipelines`: Lancer un nouveau pipeline ML (reçoit la config, ID dataset). Retourne un `task_id`.
        *   [⬜] `GET /pipelines/{task_id}/status`: Obtenir le statut d'un run.
        *   [⬜] `GET /pipelines/{run_id}/results`: Obtenir les résultats (métriques, graphiques si stockés).
        *   [⬜] `GET /pipelines`: Lister les runs passés.
    *   [⬜] **Tâches Celery (`tasks.py`) :**
        *   [⬜] `run_ml_pipeline(config, dataset_ref)`: Tâche principale.
            *   [⬜] Charger les données (depuis path/BDD basé sur `dataset_ref`).
            *   [⬜] Appliquer étapes de prétraitement (imputation, scaling, encodage) selon `config`.
            *   [⬜] Entraîner le modèle Scikit-learn choisi (`config`).
            *   [⬜] Évaluer le modèle (accuracy, F1, ROC, MSE...).
            *   [⬜] Sauvegarder le modèle entraîné (ex: MLflow, ou simple fichier + référence en BDD).
            *   [⬜] Sauvegarder les métriques et résultats en BDD (table `PipelineRun`).
            *   [⬜] Mettre à jour le statut de la tâche.
    *   [⬜] **Logique métier (`services.py`) :**
        *   [⬜] Logique de suggestion d'algorithmes basée sur le type de tâche et les données.
        *   [⬜] Gestion du cycle de vie des runs.
    *   [⬜] **Déploiement K8s :** Configurer variables d'env (Redis URL, DB URL).

### ⬜ Microservice : XAI Engine (`service-xai`, port K8s: 8083)
*   **Objectif :** Générer des explications pour les modèles ML entraînés, de manière asynchrone.
*   **Technos :** FastAPI, Celery, Redis, SHAP, LIME, PDPbox, Matplotlib/Seaborn (pour images).
*   **Étapes :**
    *   [⬜] **Infrastructure Asynchrone :** (Partagée avec ML Pipeline ou worker dédié ?)
        *   [⬜] Configurer Celery Worker(s) spécifique(s) XAI si nécessaire.
        *   [⬜] `Dockerfile` pour le service et le worker.
        *   [⬜] Déploiement K8s.
    *   [⬜] **Modèles de données (`models.py`, `schemas.py`) :**
        *   [⬜] Modèle SQLAlchemy `ExplanationResult` (type, run_id, parameters, result_data (json/path), generation_time).
        *   [⬜] Modèles Pydantic pour API (`ExplanationRequest`, `ExplanationStatus`).
    *   [⬜] **Endpoints REST (`main.py`/`routers/`) :**
        *   [⬜] `POST /explanations`: Demander une nouvelle explication (type: SHAP/LIME/PDP, run_id/model_ref, data_sample, target_audience). Retourne `task_id`.
        *   [⬜] `GET /explanations/{task_id}/status`: Statut de la génération.
        *   [⬜] `GET /explanations/{explanation_id}`: Obtenir le résultat de l'explication (JSON, URL image?).
        *   [⬜] `GET /explanations/recommendations`: Suggérer des méthodes XAI (basé sur modèle/données/audience).
    *   [⬜] **Tâches Celery (`tasks.py`) :**
        *   [⬜] `generate_shap_explanation(model_ref, data_sample, **kwargs)`
        *   [⬜] `generate_lime_explanation(model_ref, data_instance, **kwargs)`
        *   [⬜] `generate_pdp(model_ref, data, features, **kwargs)`
        *   Ces tâches chargent le modèle, les données, calculent l'explication, sauvegardent le résultat (JSON, image) et mettent à jour la BDD (`ExplanationResult`).
    *   [⬜] **Logique métier (`services.py`) :**
        *   [⬜] Logique de recommandation des méthodes XAI.
        *   [⬜] Adaptation du format de sortie selon l'audience cible.
    *   [⬜] **Déploiement K8s :** Configurer variables d'env (Redis URL, DB URL).

### ⬜ Base de données : PostgreSQL
*   **Objectif :** Stockage persistant des données métier.
*   **Technos :** PostgreSQL.
*   **Étapes :**
    *   [⬜] **Déploiement K8s :**
        *   [⬜] Choisir méthode : Helm chart officiel (recommandé) ou YAML custom.
        *   [⬜] Configurer `PersistentVolume` (PV) et `PersistentVolumeClaim` (PVC) pour le stockage des données.
        *   [⬜] Configurer l'accès : `Service` K8s (`service-postgres`).
        *   [⬜] Gérer les secrets pour le mot de passe superutilisateur (`postgres-secret`).
        *   [⬜] Déployer dans le namespace `exai`.
    *   [⬜] **Initialisation :**
        *   [⬜] Créer la base de données `exai_db`.
        *   [⬜] Créer un utilisateur `exai_user` avec les droits nécessaires.
        *   [⬜] Utiliser un `Job` K8s ou un script `init.sql` (via ConfigMap et volume) pour créer les tables initiales :
            *   [⬜] `datasets` (cf. Service Sélection)
            *   [⬜] `pipeline_runs` (cf. Service Pipeline ML)
            *   [⬜] `explanation_results` (cf. Service XAI)
            *   [⬜] `users` (pour authentification future?)
        *   [⬜] Insérer des données de test (ex: 1 ou 2 datasets de référence).

### ⬜ Message Broker : Redis
*   **Objectif :** File d'attente pour les tâches asynchrones Celery.
*   **Technos :** Redis.
*   **Étapes :**
    *   [⬜] **Déploiement K8s :**
        *   [⬜] Utiliser Helm chart officiel (recommandé) ou YAML simple.
        *   [⬜] Configurer l'accès via `Service` K8s (`service-redis`).
        *   [⬜] Pas besoin de persistance pour un simple broker Celery (peut être ajouté si Redis est utilisé pour autre chose).
        *   [⬜] Déployer dans le namespace `exai`.

### ⬜ Frontend Angular
*   **Objectif :** Interface utilisateur web pour interagir avec la plateforme EXAI.
*   **Technos :** Angular, TypeScript, HTML, Tailwind CSS (ou autre librairie UI), RxJS.
*   **Étapes :**
    *   [⬜] **Initialisation Projet :**
        *   [⬜] `ng new exai-frontend`
        *   [⬜] Ajouter les dépendances (Tailwind, HTTPClient, librairies graphiques...).
    *   [⬜] **Structure / Modules :**
        *   [⬜] `CoreModule` (services transverses, guards...).
        *   [⬜] `SharedModule` (composants réutilisables, pipes...).
        *   [⬜] `AuthModule` (login/logout si implémenté).
        *   [⬜] `DatasetModule` (sélection, visualisation).
        *   [⬜] `PipelineModule` (configuration, suivi).
        *   [⬜] `XaiModule` (visualisation des explications).
    *   [⬜] **Composants Clés :**
        *   [⬜] Navigation principale.
        *   [⬜] Page d'accueil / Dashboard.
        *   [⬜] Composant de sélection de datasets (tableau, filtres, détails).
        *   [⬜] Composant de configuration de pipeline (formulaire guidé).
        *   [⬜] Composant de visualisation des résultats ML (courbes, matrices).
        *   [⬜] Composant de visualisation XAI (graphiques SHAP, LIME, PDP).
    *   [⬜] **Services Angular :**
        *   [⬜] `DatasetService` (appels vers `/api/gateway/datasets`).
        *   [⬜] `PipelineService` (appels vers `/api/gateway/pipelines`).
        *   [⬜] `XaiService` (appels vers `/api/gateway/xai`).
        *   [⬜] `AuthService` (gestion JWT si implémenté).
    *   [⬜] **Déploiement :**
        *   [⬜] Créer `Dockerfile` pour builder l'app Angular et servir avec Nginx.
        *   [⬜] Créer `deployment.yaml` et `service.yaml` K8s.
        *   [⬜] Configurer l'appel vers l'API Gateway (via `Service` K8s ou Ingress).

### ⬜ Ingress Controller (Optionnel mais recommandé)
*   **Objectif :** Gérer l'accès externe aux services K8s de manière centralisée et flexible (routage basé sur le chemin).
*   **Technos :** NGINX Ingress Controller (commun).
*   **Étapes :**
    *   [⬜] Déployer le contrôleur Ingress dans le cluster Minikube (`minikube addons enable ingress`).
    *   [⬜] Créer une ressource `Ingress` (`ingress.yaml`) pour définir les règles de routage :
        *   [⬜] `/` → `service-frontend`
        *   [⬜] `/api/gateway/` → `service-api-gateway` (ou routes directes vers les services si l'API Gateway est simplifiée).
    *   [⬜] Configurer potentiellement TLS/HTTPS (plus tard, via cert-manager).

---

## 🔁 Checklist de déploiement Granulaire (Minikube local)

| Étape                                                                 | Statut | Service(s) Concerné(s) | Notes                                    |
|-----------------------------------------------------------------------|--------|------------------------|------------------------------------------|
| **Prérequis**                                                         |        |                        |                                          |
| ✅ Installer Docker                                                  |   ✅   | Host                   |                                          |
| ✅ Installer Minikube + kubectl                                      |   ✅   | Host                   |                                          |
| ✅ Démarrer Minikube (`minikube start`)                              |   ✅   | Host                   | Assurer assez de CPU/RAM                  |
| ✅ Créer le namespace `exai` (`kubectl create ns exai`)              |   ✅   | K8s                    |                                          |
| ✅ Configurer kubectl pour utiliser le namespace `exai` par défaut    |   ✅   | Host                   | `kubectl config set-context --current --namespace=exai` |
| **Base de Données**                                                    |        |                        |                                          |
| ⬜ Déployer PostgreSQL (Helm ou YAML)                               |   ⬜   | PostgreSQL             | Inclut Service, Secret, PVC/PV           |
| ⬜ Vérifier la connexion au pod PostgreSQL                           |   ⬜   | PostgreSQL             | `kubectl exec -it ...`                  |
| ⬜ Créer BDD `exai_db` et utilisateur `exai_user`                     |   ⬜   | PostgreSQL             | Via psql dans le pod ou script init     |
| ⬜ Exécuter le script d'initialisation des tables (Job K8s)          |   ⬜   | PostgreSQL             | `datasets`, `pipeline_runs`, etc.         |
| ⬜ Insérer des données de test dans la table `datasets`               |   ⬜   | PostgreSQL             |                                          |
| **Broker de Messages**                                                |        |                        |                                          |
| ⬜ Déployer Redis (Helm ou YAML)                                     |   ⬜   | Redis                  | Inclut Service                           |
| ⬜ Vérifier la connexion au pod Redis                                 |   ⬜   | Redis                  | `redis-cli`                              |
| **Service Sélection**                                                 |        |                        |                                          |
| ✅ Déployer Service Sélection (Base)                                 |   ✅   | service-selection      | Déjà fait apparemment                    |
| ⬜ Configurer `DATABASE_URL` via Secret dans `deployment.yaml`        |   ⬜   | service-selection      | Pointer vers `service-postgres.exai.svc.cluster.local` |
| ⬜ Implémenter/Tester les endpoints CRUD REST                         |   ⬜   | service-selection      | Tester via `curl` ou client API          |
| ⬜ Finaliser modèle SQLAlchemy `Dataset` et schémas Pydantic         |   ⬜   | service-selection      |                                          |
| ⬜ Mettre à jour le déploiement K8s (`kubectl apply -f ...`)           |   ⬜   | service-selection      |                                          |
| **Service Pipeline ML**                                               |        |                        |                                          |
| ⬜ Créer Dockerfile pour FastAPI App                                |   ⬜   | service-ml-pipeline    |                                          |
| ⬜ Créer Dockerfile pour Celery Worker                               |   ⬜   | service-ml-pipeline    |                                          |
| ⬜ Implémenter API FastAPI (endpoints + schemas)                     |   ⬜   | service-ml-pipeline    |                                          |
| ⬜ Implémenter Tâches Celery (chargement, préproc, train, eval, save)|   ⬜   | service-ml-pipeline    |                                          |
| ⬜ Configurer Celery pour utiliser Redis et PostgreSQL                |   ⬜   | service-ml-pipeline    |                                          |
| ⬜ Créer `deployment.yaml` / `service.yaml` pour App & Worker        |   ⬜   | service-ml-pipeline    | Configurer DB/Redis URLs via Env/Secrets|
| ⬜ Déployer App FastAPI                                             |   ⬜   | service-ml-pipeline    |                                          |
| ⬜ Déployer Worker(s) Celery                                         |   ⬜   | service-ml-pipeline    |                                          |
| ⬜ Tester le lancement et le suivi d'une tâche ML                    |   ⬜   | service-ml-pipeline    |                                          |
| **Service XAI**                                                      |        |                        |                                          |
| ⬜ Créer Dockerfile pour FastAPI App                                |   ⬜   | service-xai            |                                          |
| ⬜ Créer Dockerfile pour Celery Worker XAI (si séparé)               |   ⬜   | service-xai            |                                          |
| ⬜ Implémenter API FastAPI (endpoints + schemas)                     |   ⬜   | service-xai            |                                          |
| ⬜ Implémenter Tâches Celery (SHAP, LIME, PDP...)                   |   ⬜   | service-xai            |                                          |
| ⬜ Configurer Celery pour utiliser Redis et PostgreSQL                |   ⬜   | service-xai            |                                          |
| ⬜ Créer `deployment.yaml` / `service.yaml` pour App & Worker XAI     |   ⬜   | service-xai            | Configurer DB/Redis URLs via Env/Secrets|
| ⬜ Déployer App FastAPI XAI                                         |   ⬜   | service-xai            |                                          |
| ⬜ Déployer Worker(s) Celery XAI                                     |   ⬜   | service-xai            |                                          |
| ⬜ Tester le lancement et le suivi d'une tâche XAI                   |   ⬜   | service-xai            |                                          |
| **API Gateway**                                                      |        |                        |                                          |
| ✅ Déployer API Gateway (Base)                                     |   ✅   | service-api-gateway    | Déjà fait apparemment                    |
| ⬜ Configurer les reverse proxies vers les services internes         |   ⬜   | service-api-gateway    | `service-selection`, `service-ml-pipeline`, `service-xai` |
| ✅ Configurer CORS                                                  |   ✅   | service-api-gateway    | Autoriser origine du Frontend Angular (fait, permissif) |
| 🚧 Configurer sécurité JWT (via `fastapi-users`)                    |   🚧   | service-api-gateway    | Modèles/Schemas créés, reste initialisation/routes | 
| ⬜ Mettre à jour le déploiement K8s                                   |   ⬜   | service-api-gateway    |                                          |
| **Frontend Angular**                                                 |        |                        |                                          |
| ⬜ Initialiser le projet Angular                                    |   ⬜   | exai-frontend          |                                          |
| ⬜ Créer les modules, composants et services de base                |   ⬜   | exai-frontend          |                                          |
| ⬜ Implémenter la communication avec l'API Gateway                 |   ⬜   | exai-frontend          | Utiliser les services K8s ou Ingress    |
| ⬜ Créer Dockerfile pour build + serve (Nginx)                      |   ⬜   | exai-frontend          |                                          |
| ⬜ Créer `deployment.yaml` / `service.yaml` K8s                     |   ⬜   | exai-frontend          |                                          |
| ⬜ Déployer le Frontend                                              |   ⬜   | exai-frontend          |                                          |
| **Ingress (Optionnel)**                                              |        |                        |                           # 🎯 RULE — Projet Scientifique EXAI : Développement Assisté + Documentation

## 🧠 CONTEXTE GÉNÉRAL

Tu es une IA experte en :
- Développement logiciel (Python, Angular, TypeScript, etc.)
- Architecture microservices (Docker, Kubernetes, FastAPI…)
- MLOps et pipelines Machine Learning
- XAI (eXplainable Artificial Intelligence)
- Documentation technique Antora (docs-as-code)

Tu collabores avec un **développeur junior**, dans le cadre d'un **projet académique structuré** sous forme de **Proof of Concept (PoC)**. L'enjeu est **scientifique**, validé par des reviewers, avec une **documentation impérative pour des utilisateurs non techniques**.

---

## 🧪 OBJECTIF DU PROJET EXAI

Le système doit résoudre **3 problèmes majeurs rencontrés par les non-experts en science des données** :

1. **Sélection de datasets** selon des **critères techniques, éthiques et métier** (ex. RGPD, anonymisation…)
2. **Guidage complet dans un pipeline de Machine Learning**, même sans expertise
3. **Recommandation automatique de techniques XAI**, selon le type de modèle, de données, et le niveau d'expertise utilisateur

---

## 🧱 ARCHITECTURE TECHNIQUE

Le projet suit une **architecture microservices**, orchestrée avec **Kubernetes et Docker**, déployable en **local via Minikube**.  
Voici la cartographie technique :

| Composant              | Technologie                               | Description |
|------------------------|-------------------------------------------|-------------|
| `frontend/`            | Angular + Tailwind                        | Interface utilisateur |
| `gateway/`             | FastAPI + JWT                             | API Gateway sécurisée |
| `data-selection/`      | FastAPI + PostgreSQL + SQLAlchemy         | Service de sélection des datasets |
| `ml-pipeline/`         | FastAPI + Celery + Redis + scikit-learn   | Service d'apprentissage automatique |
| `xai-engine/`          | FastAPI + SHAP/LIME + Celery + Redis      | Service de génération d'explication |
| `docs/`                | Antora (Asciidoc)                         | Documentation utilisateur |

---

## 📘 RÈGLE SPÉCIALE : DOCUMENTATION ANTORA (OBLIGATOIRE)

⚠️ **La documentation est un pilier du projet**. Tu dois **OBLIGATOIREMENT** :

- Documenter **chaque fonctionnalité, API, ou comportement** dans le dossier `docs/`
- Rédiger en **langage simple, accessible aux non-développeurs**
- Ajouter si nécessaire :
  - Des **exemples**
  - Des **captures ou schémas**
  - Des **explications du comportement attendu**
- Utiliser **Antora/Asciidoc** (pas Markdown)
- Structurer dans des modules (`modules/user-guide/pages/…`) avec navigation claire

Aucune fonctionnalité ne doit être livrée **sans sa documentation Antora associée**.

---

## 🔍 FONCTIONNALITÉS PRINCIPALES À DÉVELOPPER

### 1. 🔎 Sélection de datasets
- Formulaire web avec critères techniques/éthiques/métier
- Calcul automatique de score de pertinence
- Visualisation des datasets filtrés : radar, histogrammes, heatmap
- Fonction de comparaison

### 2. 🔧 Pipeline de Machine Learning
- Étapes guidées :
  - Prétraitement (cleaning, encoding…)
  - Choix de la tâche ML (classification, régression, clustering)
  - Sélection automatique d'algorithmes
- Visualisation des résultats :
  - Courbes d'apprentissage
  - Matrices de confusion
  - Dendrogrammes…

### 3. 🧠 Recommandation XAI
- Système de suggestion d'outils XAI selon :
  - Type de modèle (boîte blanche/noire)
  - Type de données (texte/image/tableau)
  - Public cible (expert, novice, décideur)
  - Contraintes de calcul
- Outils XAI intégrés : **LIME, SHAP, PDP**
- Génération automatique de visualisations explicatives
- Documentation Antora pour chaque méthode XAI intégrée

---

## 📚 CONTRAINTES SCIENTIFIQUES

Respect des normes académiques :
- Organisation du livrable final : introduction, état de l'art, méthodologie, résultats, discussion
- Intégration des critères RGPD
- Validation qualitative et quantitative des modules
- Reproductibilité totale (documentation complète exigée)
- Démarche de PoC (Proof of Concept)

---

## ✅ INSTRUCTIONS DE COMPORTEMENT POUR L'IA

- 🔁 **Toujours m'expliquer ce que tu fais** de façon claire et pédagogique
- ✅ **Toujours me demander validation avant d'exécuter du code complexe**
- 📦 **Respect strict de la structure microservice**
- 🔐 **Implémentation sécurisée (auth JWT, chiffrement des données, accès restreint)**
- 🧩 **Code modulaire, testé et commenté**
- 🧾 **Documenter chaque service, chaque fonctionnalité et chaque étape d'intégration dans Antora**
- 🤖 **Si tu détectes qu'une fonctionnalité n'a pas de documentation, tu dois la générer automatiquement**

---

## ⏳ SUIVI DE PROJET

Pour savoir **où nous en sommes dans le développement**, consulte le fichier `@/docs/avancement.adoc`  
Tu devras **le mettre à jour au fil du temps** après chaque étape validée.

---

## ❓AVANT DE COMMENCER

Merci de me confirmer que tu as bien compris :
- Le **contexte scientifique**
- L'**architecture complète** (incluant `docs/` avec Antora)
- Les **3 modules fonctionnels**
- L'importance **stratégique et obligatoire de la documentation utilisateur**

Pose-moi **toutes les questions utiles** avant de commencer le développement.

---

# 📂 @ files
- `@/docs/`
- `@/frontend/`
- `@/ml-pipeline/`
- `@/xai-engine/`
- `@/data-selection/`
- `@/gateway/`
               |
| ⬜ Activer l'addon Ingress Minikube                                 |   ⬜   | K8s                    | `minikube addons enable ingress`         |
| ⬜ Créer la ressource `Ingress` pour router le trafic               |   ⬜   | K8s                    | `/` -> frontend, `/api/gateway/` -> gateway |
| ⬜ Tester l'accès via l'IP de Minikube et les chemins définis        |   ⬜   | Host -> K8s            |                                          |
| **Tests & Validation**                                                |        |                        |                                          |
| ⬜ Écrire des tests unitaires pour les fonctions critiques           |   ⬜   | Tous                   |                                          |
| ⬜ Écrire des tests d'intégration API                                |   ⬜   | Tous (backend)         |                                          |
| ⬜ Effectuer des tests E2E manuels du flux utilisateur complet       |   ⬜   | Tous                   | Sélection -> Pipeline -> XAI             |
| ⬜ Validation scientifique/PoC (selon critères définis)              |   ⬜   | Projet                 |                                          |

---

## 🧠 Conseils pour IA Cursor / copilote (Rappel)

*   **Respecter l'architecture :** Suivre strictement la décomposition en microservices et les technos choisies.
*   **Générer le code requis :** Modèles SQLAlchemy/Pydantic, endpoints FastAPI, tâches Celery, composants Angular, fichiers de configuration Docker & K8s (`Dockerfile`, `deployment.yaml`, `service.yaml`, `ingress.yaml`, `pvc.yaml`, `secrets.yaml`, `configmap.yaml`).
*   **Configuration :** Utiliser les variables d'environnement et les secrets K8s pour les configurations sensibles (URLs BDD/Redis, clés API...). Ne pas hardcoder.
*   **Communication inter-services :** Utiliser les noms de service K8s (ex: `http://service-selection:8081`).
*   **Scripts d'initialisation :** Proposer des scripts SQL pour initialiser la BDD et des datasets de test.
*   **Code propre et documenté :** Générer du code lisible, typé (Python/TypeScript), avec docstrings/commentaires si nécessaire.
*   **Explications claires :** Expliquer les choix techniques et le code généré de manière simple.
*   **Validation :** Attendre la validation avant d'implémenter des logiques complexes.

---

## 📚 Notes fonctionnelles et pédagogiques (Rappel)
- **Simplicité d'usage :** L'interface doit être intuitive pour des non-experts en IA.
- **Guidage utilisateur :** Accompagner pas à pas :
  1. Sélection Données (filtrage, aperçu, métadonnées, score éthique/qualité).
  2. Configuration Pipeline ML (choix tâche, suggestion algo, prétraitement simple).
  3. Entraînement et Visualisation Résultats (automatique, courbes, métriques claires).
  4. Recommandation et Interprétation XAI (adaptée au profil : expert/novice, type modèle/données).
- **Clarté des explications :** Fournir des interprétations textuelles simples en plus des graphiques XAI.

---

## 🔐 Sécurité (Points d'attention)
*   [⬜] Sécuriser l'API Gateway (limitation de débit, validation d'entrée).
*   [⬜] Gérer les secrets K8s correctement pour les mots de passe BDD, clés API, etc.
*   [⬜] Utiliser des images Docker de base sécurisées et à jour.
*   [⬜] Définir des `NetworkPolicy` K8s pour restreindre le trafic entre les pods (si nécessaire).
*   [⬜] Considérer l'authentification/autorisation (JWT?) si des utilisateurs multiples sont prévus.

---

## 🧪 Stratégie de Test (Suggestion)
*   **Tests Unitaires :** Pour la logique métier critique dans chaque service (ex: calcul de score, fonctions de prétraitement, logique de recommandation). Utiliser `pytest` pour le backend, `Karma`/`Jasmine` pour Angular.
*   **Tests d'Intégration :** Tester les endpoints API de chaque service indépendamment (ex: via `pytest` avec `TestClient` FastAPI). Tester l'interaction avec la BDD/Redis (en utilisant des instances de test).
*   **Tests Contrat API :** Vérifier que les services respectent les formats de données attendus par les autres (peut être fait dans les tests d'intégration).
*   **Tests End-to-End (E2E) :** Simuler un parcours utilisateur complet depuis le Frontend jusqu'aux résultats XAI. Peut être manuel pour le PoC, ou automatisé (ex: Cypress, Playwright).

---

## 👨‍🎓 Auteur : Master 2 MIAGE — Projet EXAI 2024/2025
