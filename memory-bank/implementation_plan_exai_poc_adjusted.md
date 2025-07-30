# IBIS-X : Plan d'Implémentation Révisé (Basé sur Avancement Actuel)

**Objectif :** Fournir une séquence d'étapes de développement **ajustée à l'état d'avancement actuel** du projet IBIS-X (tel que décrit dans le document "IBIS-X - Assistant IA pour développement PoC XAI"), destinée à être suivie par Cursor AI.

**Basé sur :** PRD Détaillé v2 (`prd_ibis_x_poc_v2`), Tech Stack (`tech_stack_ibis_x_v2`), État d'avancement fourni.

**Environnement Cible :** Développement local avec Docker & Minikube.

**Principes :** Petites étapes, instructions précises, test de validation, focus sur les tâches restantes (⬜ / 🚧).

---

## Phase 0 : Finalisation Infrastructure de Base et Prérequis

* **[✅ Étape 0.1 : Structure des Dossiers]** (Supposée faite, vérifier si conforme)
    * **Test :** Vérifier la présence de `frontend/`, `gateway/`, `service-selection/`, `ml-pipeline/`, `xai-engine/`, `k8s/base/`, `k8s/overlays/minikube/`, `memory-bank/` (avec PRD, TechStack, architecture.md vide, progress.md vide), `.cursor/`.
* **[✅ Étape 0.2 : Initialisation Services Backend]** (Supposée faite)
    * **Test :** Vérifier `main.py` minimal, `Dockerfile`, fichier dépendances dans chaque service backend.
* **[✅ Étape 0.3 : Initialisation Frontend Angular]**
    * **Instruction :** Dans `frontend/`, initialise un nouveau projet Angular (`ng new frontend --directory . --routing --style=css`). Ajoute Angular Material (`ng add @angular/material`). Choisis un thème.
    * **Test :** Vérifier création projet, ajout dépendances (`package.json`, `angular.json`), démarrage (`ng serve`).
* **[✅ Étape 0.4 : Configuration Base K8s (Base)]** (Supposée prête)
    * **Test :** Vérifier présence des `Deployment`/`Service` YAML de base pour chaque microservice dans `k8s/base/`.
* **[✅ Étape 0.5 : Configuration Kustomize (Minikube)]**
    * **Instruction :** Dans `k8s/overlays/minikube/`, crée `kustomization.yaml` référençant `k8s/base/`. Ajoute les patches nécessaires pour Minikube (images locales, config via Secrets/ConfigMaps montés).
    * **Test :** `kubectl kustomize k8s/overlays/minikube/` doit générer les manifestes sans erreur.
* **[✅ Étape 0.6 : Configuration Skaffold]**
    * **Instruction :** Crée `skaffold.yaml`. Configure `artifacts` (build Docker pour chaque service) et `deploy` (via Kustomize `k8s/overlays/minikube/`).
    * **Test :** `skaffold build` doit réussir. `skaffold run` doit tenter le déploiement.
* **[✅ Étape 0.7 : Déploiement PostgreSQL sur Minikube]** (Supposée faite)
    * **Test :** Pods 'Running', PVC 'Bound', Service existe. Connexion via `kubectl exec ... psql` réussit. BDD `ibis_x_db` et user `ibis_x_user` existent.
* **[✅ Étape 0.8 : Initialisation Tables BDD (datasets, users)]** (Supposée faite via Alembic ou script)
    * **Test :** Vérifier existence des tables `datasets` et `user` (et `alembic_version`) dans la BDD.
* **[✅ Étape 0.9 : Stabilisation Environnement Local & Accès]**
    * **Description :** Résolution des problèmes de déploiement Minikube (PVC, ClusterIssuer, Ingress). Configuration de l'accès local via `skaffold dev --profile=local` et port-forwarding intégré (Frontend: `localhost:8080`, API Gateway: `localhost:9000`).
    * **Statut :** Complété et Documenté.
* **[⬜ Étape 0.10 : Déploiement Redis sur Minikube]**
    * **Instruction :** Crée `k8s/base/redis-deployment.yaml`. Utilise image `redis:alpine`. Crée `Service` (`redis-service`) ClusterIP port 6379. Applique.
    * **Test :** Pod Redis 'Running'. Connexion via `kubectl exec ... redis-cli PING` retourne `PONG`.

## Phase 1 : Module `service-selection` - Finalisation Fonctionnalités

* **[✅ Étape 1.1 : Modèle `Dataset` SQLAlchemy & Schemas Pydantic Base]** (Supposé fait)
    * **Test :** Vérifier `app/models.py` (classe `Dataset` conforme PRD) et `app/schemas.py` (schemas `DatasetBase`, `DatasetCreate`, `DatasetUpdate`, `DatasetRead` conformes PRD).
* **[✅ Étape 1.2 : Endpoints CRUD de Base]** (Supposé fait)
    * **Test :** Vérifier fonctionnement `POST /datasets`, `GET /datasets` (simple), `GET /datasets/{id}`, `PUT /datasets/{id}`, `DELETE /datasets/{id}` via client API (Postman/curl).
* **[⬜ Étape 1.3 : Script d'Import Initial]** (Si non fait ou à refaire)
    * **Instruction :** Crée/Finalise `scripts/import_initial_data.py` (lit `.xlsx`, conversions robustes, insertion via SQLAlchemy).
    * **Test :** Exécuter script. Vérifier peuplement table `datasets` et correction des conversions.
* **[⬜ Étape 1.4 : Modèles Pydantic Avancés]**
    * **Instruction :** Dans `app/schemas.py`, définis/finalise `DatasetFilterCriteria`, `CriterionWeight`, `DatasetScoreRequest`, `DatasetScoredRead` (cf. PRD v2).
    * **Test :** Vérifier syntaxe et structure des modèles Pydantic.
* **[⬜ Étape 1.5 : Endpoint `GET /datasets` (Filtrage Avancé)]**
    * **Instruction :** Modifie/Implémente la fonction CRUD `get_datasets` pour accepter `filters: schemas.DatasetFilterCriteria` et construire la requête SQLAlchemy dynamiquement (texte `ilike`, booléens, numériques).
    * **Test :** Tester via API divers filtres et combinaisons.
* **[⬜ Étape 1.6 : Logique de Scoring]**
    * **Instruction :** Crée/Implémente `app/scoring.py` avec `calculate_relevance_score(dataset, weights_dict, normalization_stats)` (somme pondérée, focus PoC: booléens + `num_citations` normalisé).
    * **Test :** Tests unitaires (`pytest`) pour la fonction de scoring.
* **[⬜ Étape 1.7 : Endpoint `POST /datasets/score` ]**
    * **Instruction :** Implémente `POST /datasets/score` (valide input, filtre BDD, calcule stats normalisation, appelle `calculate_relevance_score` pour chaque, trie, retourne `List[DatasetScoredRead]`).
    * **Test :** Envoyer requête POST via API avec filtres/poids. Vérifier réponse triée et scores.
* **[⬜ Étape 1.8 : Endpoint `GET /datasets/{id}/preview` ]** (Approche robuste recommandée)
    * **Instruction :** Implémenter (ou prévoir) la génération asynchrone (via Celery dans `ml-pipeline`?) d'un extrait lors de l'upload/validation, stocké sur PV/Blob. Implémenter l'endpoint `/preview` qui lit cet extrait. *Alternative PoC : lecture dynamique si fichier sur PV.*
    * **Test :** Appeler l'endpoint pour un dataset avec preview disponible. Vérifier le retour de l'extrait.
* **[⬜ Étape 1.9 : Endpoint `GET /datasets/{id}/stats` ]**
    * **Instruction :** Implémenter l'endpoint `/stats`. Charger les données (ou un échantillon) depuis `file_reference`. Utiliser Pandas pour calculer des statistiques descriptives de base (ex: `df.describe()`, comptage valeurs manquantes par colonne). Retourner en JSON.
    * **Test :** Appeler l'endpoint. Vérifier le retour des statistiques calculées.
* **[🚧 Étape 1.10 : Finalisation Déploiement K8s `service-selection`]**
    * **Instruction :** Finaliser `k8s/base/service-selection-deployment.yaml`. Configurer `DATABASE_URL` via Secret. Ajouter les probes liveness/readiness (`/healthcheck`?). Mettre à jour l'overlay Minikube. Appliquer.
    * **Test :** `kubectl apply -k k8s/overlays/minikube/`. Vérifier que le pod est 'Running' et passe les probes. Vérifier que les endpoints API fonctionnent via la Gateway (une fois routage configuré).

## Phase 2 : Module `gateway` - Finalisation

* **[✅ Étape 2.1 : Authentification `fastapi-users`]** (Supposée fonctionnelle)
    * **Test :** Re-vérifier enregistrement, login JWT, accès endpoint protégé `/users/me`.
* **[⬜ Étape 2.2 : Routage Reverse Proxy]**
    * **Instruction :** Implémente le routage dans `gateway/main.py` (ou routeur dédié) pour :
        * `/api/v1/datasets/*` -> `service-selection:8081`
        * `/api/v1/pipelines/*` -> `service-ml-pipeline:8082`
        * `/api/v1/explanations/*` -> `service-xai:8083`
        * Utilise `httpx.AsyncClient`. Vérifie l'authentification (`Depends(current_active_user)`) AVANT de relayer.
    * **Test :** Une fois `service-selection` finalisé, tester l'accès à ses endpoints via la gateway (`/api/v1/datasets/...`) après authentification. Tester l'accès sans token (doit échouer).
* **[⬜ Étape 2.3 : Finalisation Déploiement K8s `gateway`]**
    * **Instruction :** Finaliser `k8s/base/gateway-deployment.yaml`. Configurer `DATABASE_URL` et `SECRET_KEY` via Secret. Ajouter probes. Mettre à jour overlay. Appliquer.
    * **Test :** `kubectl apply -k ...`. Vérifier pod 'Running' et probes OK. Vérifier fonctionnement Auth et routage vers `service-selection`.

## Phase 3 : Infrastructure Asynchrone (Celery)

* **[✅ Étape 3.1 : Redis Déployé]** (Fait à l'étape 0.9)
    * **Test :** Re-vérifier que le service `redis-service` est accessible dans le cluster.
* **[⬜ Étape 3.2 : Configuration Celery dans Services ML/XAI]**
    * **Instruction :** Dans `ml-pipeline/app/` et `xai-engine/app/`, ajoute `celery`, `redis` aux dépendances. Crée `celery_app.py` (cf. Plan précédent, Étape 4.2). Crée `Dockerfile.worker` pour chaque.
    * **Test :** Vérifier import `celery_app` OK. Vérifier syntaxe Dockerfiles worker.
* **[⬜ Étape 3.3 : Déploiement Worker(s) Celery]** (Pool Partagé PoC)
    * **Instruction :** Crée `k8s/base/celery-worker-deployment.yaml`. Utilise une image contenant code+deps des deux services (ou monte les volumes). CMD: `celery -A app.celery_app worker -l INFO -Q celery,ml_queue,xai_queue ...`. Configure `CELERY_BROKER_URL` via env var pointant vers `redis-service`. Applique.
    * **Test :** Pod worker 'Running'. Logs indiquent connexion à Redis et écoute des queues.

## Phase 4 : Module `ml-pipeline` - Implémentation Complète

* **[✅ Étape 4.1 : Modèle BDD `PipelineRun` & Migration]** (Complété 2025-07-29)
    * **Instruction :** Dans `ml-pipeline/app/models.py`, définis `PipelineRun` (cf. PRD). Configure Alembic. Génère/applique migration.
    * **Test :** Table `experiments` créée avec tous les champs nécessaires.
* **[✅ Étape 4.2 : Tâche Celery `run_ml_pipeline_task`]** (Complété 2025-07-29)
    * **Instruction :** Dans `ml-pipeline/app/tasks.py`, implémente la tâche complète (cf. Plan précédent, Étape 5.5) : MAJ statut RUNNING -> charge données (PV) -> prétraitement simple -> split -> instancie/entraîne modèle (ex: LogReg) -> évalue (accuracy) -> sauvegarde modèle (PV) -> MAJ statut SUCCESS/FAILURE + results + model_reference. Utilise la session BDD correctement.
    * **Test :** Tâche `train_model` complète avec workflow complet implémenté.
* **[✅ Étape 4.3 : API Endpoints (`POST /pipelines`, `GET /pipelines/{id}`) ]** (Complété 2025-07-29)
    * **Instruction :** Implémente les endpoints dans `ml-pipeline/main.py` (cf. Plan précédent, Étapes 5.3, 5.4). Protéger avec dépendance Auth (via gateway).
    * **Test :** Endpoints créés : POST /experiments, GET /experiments/{id}, GET /experiments/{id}/results, GET /algorithms.
* **[✅ Étape 4.4 : Finalisation Déploiement K8s `ml-pipeline`]** (Complété 2025-07-29)
    * **Instruction :** Finaliser `k8s/base/ml-pipeline-deployment.yaml` (App FastAPI) et `celery-worker-deployment.yaml` (si worker séparé envisagé plus tard, sinon le pool partagé est déjà là). Configurer DB/Redis URLs via Secrets. Ajouter probes. MAJ overlay. Appliquer.
    * **Test :** Deployment API et Workers Celery configurés avec probes et secrets.

## Phase 5 : Module `xai-engine` - Implémentation Complète

* **[⬜ Étape 5.1 : Modèle BDD `ExplanationRequest` & Migration]**
    * **Instruction :** Dans `xai-engine/app/models.py`, définis `ExplanationRequest` (cf. PRD). Alembic. Migration.
    * **Test :** Table `explanation_requests` créée.
* **[⬜ Étape 5.2 : Tâche Celery `generate_explanation_task`]**
    * **Instruction :** Dans `xai-engine/app/tasks.py`, implémente la tâche complète (cf. Plan précédent, Étape 6.5) : MAJ statut RUNNING -> charge modèle (PV) -> charge données (PV) -> sélectionne/exécute XAI (SHAP/LIME) -> formate pour audience 'novice' -> sauvegarde résultat (JSON sur PV) -> MAJ statut SUCCESS/FAILURE + results_reference.
    * **Test :** Tests unitaires. Test déclenchement manuel.
* **[⬜ Étape 5.3 : API Endpoints (`POST /explanations`, `GET /explanations/{id}`) ]**
    * **Instruction :** Implémente les endpoints dans `xai-engine/main.py` (cf. Plan précédent, Étapes 6.3, 6.4). Protéger.
    * **Test :** Tests d'intégration API via gateway. Vérifier création `ExplanationRequest`, déclenchement tâche, récupération statut/référence résultat.
* **[⬜ Étape 5.4 : Finalisation Déploiement K8s `xai-engine`]**
    * **Instruction :** Finaliser `k8s/base/xai-engine-deployment.yaml`. Configurer DB/Redis URLs via Secrets. Probes. MAJ overlay. Appliquer.
    * **Test :** Pod 'Running'. API répond via gateway. Tâches s'exécutent via worker.

## Phase 6 : Frontend - Implémentation & Intégration

* **[⬜ Étape 6.1 : Services & Auth]**
    * **Instruction :** Implémente `AuthService`, `AuthInterceptor`. Crée `AuthModule` avec composants Login/Register (utilisant `MatCard`, `MatFormField`, `MatInput`, `MatButton`).
    * **Test :** Flux connexion/déconnexion OK, token géré, intercepteur actif.
* **[⬜ Étape 6.2 : Module Sélection Dataset]**
    * **Instruction :** Crée `DatasetSelectionModule`, `dataset.service.ts`, `dataset-list.component` (formulaire filtres/poids réactif, bouton score, `MatTable` avec `MatPaginator`/`MatSort` pour résultats).
    * **Test :** Affichage liste, filtres, scoring, tri/pagination table OK.
* **[✅ Étape 6.3 : Module Pipeline ML]** (Complété 2025-07-29)
    * **Instruction :** Crée `MLPipelineModule`, `pipeline.service.ts`, `pipeline-launcher.component` (sélection dataset, choix tâche/algo via `MatSelect`, bouton lancement, affichage statut/résultats via polling et `MatCard`/`MatChip`).
    * **Test :** Wizard 5 étapes complet avec Angular Material, intégration depuis projets, suivi temps réel, affichage résultats.
* **[⬜ Étape 6.4 : Module XAI]**
    * **Instruction :** Crée `XAIModule`, `explanation.service.ts`, `explanation-requester.component` (sélection run ML, choix audience `MatSelect`, bouton demande, affichage statut/résultat simple).
    * **Test :** Demande explication OK, suivi statut OK, affichage résultat (top features) OK.
* **[⬜ Étape 6.5 : Déploiement K8s Frontend]**
    * **Instruction :** Crée `Dockerfile` (build + Nginx). Finalise `k8s/base/frontend-deployment.yaml` et `service.yaml`. MAJ overlay. Applique.
    * **Test :** Pod 'Running'. Application accessible (via `minikube service` ou Ingress).

## Phase 7 : Ingress (Recommandé)

* **[✅ Étape 7.1 : Activation & Configuration NGINX Ingress]**
    * **Instruction :** Active addon Ingress Minikube. Crée `k8s/base/ingress.yaml`. Définit règles : `/` -> frontend-service, `/api/v1/` -> gateway-service (ou directement les services si gateway simplifiée). Applique. *(Note: Réalisé sur AKS avec Helm pour Nginx et Cert-Manager)*
    * **Test :** Accéder à l'IP de Minikube (`minikube ip`). Vérifier que le frontend charge. Accéder à `/api/v1/datasets` (via IP Minikube), vérifier réponse (après login). *(Note: Testé avec succès sur les domaines publics `https://ibisx.fr/` et `https://api.ibisx.fr/`)*

## Phase 8 : Finalisation PoC et Test End-to-End

* **[⬜ Étape 8.1 : Vérification Routage Gateway Complet]**
    * **Test :** Tester via Ingress/Gateway l'accès aux endpoints principaux de *tous* les services backend après authentification.
* **[⬜ Étape 8.2 : Test Scénario Principal E2E]**
    * **Instruction :** Exécuter le scénario complet depuis l'interface Angular (Login -> Sélection -> ML -> XAI -> Logout).
    * **Test :** Le flux doit fonctionner sans erreur bloquante et les résultats intermédiaires/finaux doivent être cohérents.
* **[⬜ Étape 8.3 : Mise à jour Documentation `memory-bank`]**
    * **Instruction :** Mettre à jour `architecture.md` (description rôles/interactions services) et `progress.md` (lister étapes complétées).
    * **Test :** Vérifier que les fichiers sont à jour et corrects.

---
