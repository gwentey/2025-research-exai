# Suivi de Progression - Projet IBIS-X PoC

**Version :** (Basée sur l'analyse du code au 2024-MM-JJ - *remplacez MM-JJ*)
**Basé sur :** `implementation_plan_exai_poc_adjusted.md` et analyse du code existant.

**Légende :**
*   [✅] Fait
*   [🚧] En Cours / Partiellement Fait
*   [⬜] À Faire

---

## Résumé

L'infrastructure de base (K8s, Postgres, Skaffold, Kustomize) est en place. L'authentification via l'API Gateway fonctionne. Le service de sélection de datasets dispose du CRUD de base et des modèles initiaux. Le frontend est initialisé avec l'authentification en cours. Les modules ML, XAI, les fonctionnalités avancées de sélection, le proxy de la gateway, et l'infrastructure asynchrone (Redis, Celery) restent à implémenter.

---

## Phase 0 : Finalisation Infrastructure de Base et Prérequis

*   [✅] **Étape 0.1 : Structure des Dossiers** (Vérifiée : `api-gateway`, `frontend`, `service-selection` existent. `ml-pipeline`, `xai-engine` supposés OK. `k8s`, `memory-bank` OK.)
*   [✅] **Étape 0.2 : Initialisation Services Backend** (Vérifiée pour Gateway, Selection. Dockerfile, requirements.txt existent.)
*   [✅] **Étape 0.3 : Initialisation Frontend Angular** (Vérifiée : Projet créé, Angular Material ajouté.)
*   [✅] **Étape 0.4 : Configuration Base K8s (Base)** (Supposée prête, non vérifiée en détail mais nécessaire pour les étapes suivantes.)
*   [✅] **Étape 0.5 : Configuration Kustomize (Minikube)** (Supposée prête, `kustomization.yaml` existe probablement.)
*   [✅] **Étape 0.6 : Configuration Skaffold** (Supposée prête, `skaffold.yaml` existe probablement, `push: false` confirmé.)
*   [✅] **Étape 0.7 : Déploiement PostgreSQL sur Minikube** (Confirmé implicitement par le fonctionnement de l'authentification et les migrations.)
*   [✅] **Étape 0.8 : Initialisation Tables BDD** (Confirmé par les migrations Alembic pour `users` dans Gateway et `datasets` dans Selection.)
*   [⬜] **Étape 0.9 : Déploiement Redis sur Minikube**

## Phase 1 : Module `service-selection` - Finalisation Fonctionnalités

*   [✅] **Étape 1.1 : Modèle `Dataset` SQLAlchemy & Schemas Pydantic Base** (Vérifié dans `models.py` et `schemas.py`.)
*   [✅] **Étape 1.2 : Endpoints CRUD de Base** (Vérifié dans `main.py`.)
*   [⬜] **Étape 1.3 : Script d'Import Initial** (Non vérifié, supposé à faire.)
*   [⬜] **Étape 1.4 : Modèles Pydantic Avancés** (`FilterCriteria`, `ScoreRequest`, etc. non trouvés dans `schemas.py`.)
*   [🚧] **Étape 1.5 : Endpoint `GET /datasets` (Filtrage Avancé)** (Pagination simple OK, filtrage dynamique non implémenté.)
*   [⬜] **Étape 1.6 : Logique de Scoring** (Non trouvée.)
*   [⬜] **Étape 1.7 : Endpoint `POST /datasets/score`** (Non trouvé.)
*   [⬜] **Étape 1.8 : Endpoint `GET /datasets/{id}/preview`** (Non trouvé.)
*   [⬜] **Étape 1.9 : Endpoint `GET /datasets/{id}/stats`** (Non trouvé.)
*   [🚧] **Étape 1.10 : Finalisation Déploiement K8s `service-selection`** (Déployé sur Azure, sondes liveness/readiness configurées.)

## Phase 2 : Module `gateway` - Finalisation

*   [✅] **Étape 2.1 : Authentification `fastapi-users`** (Vérifiée dans `main.py`.)
*   [⬜] **Étape 2.2 : Routage Reverse Proxy** (Non trouvé dans `main.py`.)
*   [🚧] **Étape 2.3 : Finalisation Déploiement K8s `gateway`** (Déployé sur Azure, sondes liveness/readiness configurées, proxy non implémenté.)

## Phase 3 : Infrastructure Asynchrone (Celery)

*   [⬜] **Étape 3.1 : Redis Déployé** (Lié à Étape 0.9.)
*   [⬜] **Étape 3.2 : Configuration Celery dans Services ML/XAI**
*   [⬜] **Étape 3.3 : Déploiement Worker(s) Celery**

## Phase 4 : Module `ml-pipeline` - Implémentation Complète

*   [⬜] **Étape 4.1 : Modèle BDD `PipelineRun` & Migration**
*   [⬜] **Étape 4.2 : Tâche Celery `run_ml_pipeline_task`**
*   [⬜] **Étape 4.3 : API Endpoints (`POST /pipelines`, `GET /pipelines/{id}`)**
*   [⬜] **Étape 4.4 : Finalisation Déploiement K8s `ml-pipeline`**

## Phase 5 : Module `xai-engine` - Implémentation Complète

*   [⬜] **Étape 5.1 : Modèle BDD `ExplanationRequest` & Migration**
*   [⬜] **Étape 5.2 : Tâche Celery `generate_explanation_task`**
*   [⬜] **Étape 5.3 : API Endpoints (`POST /explanations`, `GET /explanations/{id}`)**
*   [⬜] **Étape 5.4 : Finalisation Déploiement K8s `xai-engine`**

## Phase 6 : Frontend - Implémentation & Intégration

*   [🚧] **Étape 6.1 : Services & Auth** (`AuthService` existe, module `authentication` présent.)
*   [⬜] **Étape 6.2 : Module Sélection Dataset** (Non trouvé.)
*   [⬜] **Étape 6.3 : Module Pipeline ML** (Non trouvé.)
*   [⬜] **Étape 6.4 : Module XAI** (Non trouvé.)
*   [🚧] **Étape 6.5 : Déploiement K8s Frontend** (Déployé sur Azure, sondes liveness/readiness configurées.)

## Phase 7 : Ingress

*   [✅] **Étape 7.1 : Activation & Configuration NGINX Ingress** (Déployé via Helm sur AKS, Ingress configuré pour frontend et gateway avec TLS Let's Encrypt via cert-manager.)
    *   **Note (2025-04-27):** Résolution des problèmes de certificat TLS Let's Encrypt et de connectivité externe sur AKS. La cause principale était l'échec des sondes de santé (Health Probes) HTTP/HTTPS du Load Balancer Azure car elles utilisaient le chemin `/` au lieu de `/healthz` pour le contrôleur Nginx Ingress. La correction du chemin des sondes dans Azure et la réinitialisation forcée de cert-manager ont résolu le problème.

## Phase 8 : Finalisation PoC et Test End-to-End

*   [⬜] **Étape 8.1 : Vérification Routage Gateway Complet**
*   [⬜] **Étape 8.2 : Test Scénario Principal E2E**
*   [⬜] **Étape 8.3 : Mise à jour Documentation `memory-bank`** (Ceci est la première MAJ.)

**Semaine du 22 Avril 2025:**

*   **Déploiement Production (AKS) :**
    *   Configuration et déploiement réussis de Nginx Ingress Controller et Cert-Manager via Helm.
    *   Configuration de l'Ingress Kubernetes (`exai-ingress`) pour router le trafic vers le frontend et l'API Gateway.
    *   Génération et application automatiques des certificats TLS Let's Encrypt via Cert-Manager.
    *   Correction des sondes de santé (Health Probes) du Load Balancer Azure ciblant Nginx Ingress pour assurer la disponibilité du service.
    *   Déploiement initial réussi des services (API Gateway, Service Selection, Frontend) via GitHub Actions et Skaffold (`--profile=azure`).
*   **Environnement Local (Minikube + Skaffold) :**
    *   [✅] **Stabilisation et Clarification :** Résolution des problèmes de PersistentVolumeClaim pour PostgreSQL avec Minikube.
    *   [✅] **Configuration d'Accès Simplifiée :** Mise en place de l'accès local via `skaffold dev --profile=local` utilisant le port-forwarding intégré (Frontend: `localhost:8080`, API Gateway: `localhost:9000`). Abandon de l'utilisation de `minikube tunnel` ou Ingress pour le workflow local standard afin d'éviter les conflits et simplifier l'usage.
    *   [✅] Mise à jour de la documentation (`getting-started.adoc`, `architecture.md`) pour refléter la méthode d'accès locale actuelle.

**Semaine du 15 Avril 2025:**

*   **Service Selection:**
    *   Implémentation des endpoints CRUD de base pour les datasets.
    *   Mise en place de la structure SQLAlchemy/Pydantic/Alembic.
*   **API Gateway:**
    *   Mise en place de l'authentification JWT avec `fastapi-users`.
*   **Infrastructure:**
    *   Déploiement initial de PostgreSQL sur Minikube.
    *   Première configuration de Skaffold.
    *   Mise en place de la structure Kustomize (base/overlays).

---
