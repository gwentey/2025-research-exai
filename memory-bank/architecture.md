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
*   **`Jobs Kubernetes` :** Gestion automatisée des migrations de base de données avec images multi-environnements.
*   **`Makefile` :** Automatisation complète du cycle de développement local (installation, migrations, déploiement).
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
        *   [✅] **Routage Reverse Proxy complet (2025-01-21)** : Routes `/datasets` et `/projects` vers service-selection.
        *   [✅] **Routes Projets intégrées** : `/projects`, `/projects/{id}`, `/projects/{id}/recommendations`.
        *   [✅] **Configuration multi-environnements** : URLs services adaptées local/Kubernetes.
        *   [✅] **Endpoints Gestion Profil Utilisateur (2025-01-24)** : API complète pour la modification du profil utilisateur.
        *   [⬜] Déploiement K8s à finaliser (configuration probes, secrets).

*   **`service-selection/` :**
    *   **Rôle :** Gestion des métadonnées des datasets et des projets utilisateur.
    *   **Technos :** FastAPI, Uvicorn, SQLAlchemy, Pydantic, Alembic, `psycopg2-binary`/`asyncpg`.
    *   **Statut :**
        *   [✅] Configuration FastAPI de base.
        *   [✅] **Structure BDD normalisée (2025-07-06)** : 5 tables liées (`datasets`, `dataset_files`, `file_columns`, `dataset_relationships`, `dataset_relationship_column_links`) avec UUID comme clés primaires.
        *   [✅] **Table Projects (2025-01-21)** : Gestion projets utilisateur avec critères personnalisés et poids de scoring.
        *   [✅] **Modèles SQLAlchemy complets** pour toutes les tables avec relations ORM.
        *   [✅] **Schémas Pydantic exhaustifs** : Base/Create/Update/Read pour chaque modèle + schémas composés et filtrage.
        *   [✅] **Migration Alembic** : Refonte complète de la structure BDD (migration `6eb0a0e360e3`) + ajout projets (`a7b8c9d0e1f2`).
        *   [✅] **Scripts d'initialisation** : Dossier `scripts/` avec script d'initialisation dataset EdNet.
        *   [✅] **Endpoints CRUD complets** : API REST avec filtrage avancé, pagination, tri et recherche.
        *   [✅] **Endpoints spécialisés** : `/datasets/domains` et `/datasets/tasks` pour les filtres frontend.
        *   [✅] **Endpoints Projets** : CRUD complet `/projects` avec recommandations personnalisées `/projects/{id}/recommendations`.
        *   [✅] **Système de scoring sophistiqué** : Algorithmes multi-critères (éthique, technique, popularité) avec endpoint `/datasets/score`.
        *   [✅] **Documentation scoring complète (2025-07-09)** : Formules mathématiques détaillées (`docs/dev-guide/datasets-scoring-algorithm.adoc`) + guide utilisateur simple (`docs/user-guide/scoring-system.adoc`) + tooltips explicatifs dans l'interface.
        *   [✅] **Filtrage backend-first optimisé** : Élimination du double filtrage client/serveur pour performance maximale.
        *   [🚧] Déploiement K8s à finaliser (configuration probes, secrets).
    
    *   **Endpoints Gestion Profil Utilisateur (2025-01-24) :**
        *   **PATCH `/users/me`** : Mise à jour des informations du profil (pseudo, prénom, nom, langue)
            *   **Schéma** : `UserProfileUpdate` (pseudo, given_name, family_name, locale)
            *   **Authentification** : JWT token requis via `current_active_user`
            *   **Validation** : Mise à jour des champs fournis uniquement (exclude_unset=True)
        *   **PATCH `/users/me/password`** : Changement sécurisé du mot de passe
            *   **Schéma** : `PasswordUpdate` (current_password, new_password)
            *   **Sécurité** : Vérification de l'ancien mot de passe via `password_helper.verify_and_update`
            *   **Validation** : Politique de mot de passe via `user_manager.validate_password`
        *   **PATCH `/users/me/picture`** : Upload d'image de profil
            *   **Schéma** : `ProfilePictureUpdate` (picture en base64 ou URL)
            *   **Validation** : Limite de taille (10MB max) et format supporté
            *   **Stockage** : Image stockée directement en base de données PostgreSQL
        *   **Gestion d'erreurs** : Codes HTTP appropriés (400 pour validation, 500 pour erreurs serveur)
        *   **Logging** : Traçabilité complète des opérations de mise à jour de profil

    *   **Structure Base de Données Normalisée (2025-07-06) :**
        *   **`datasets`** (Table principale) : Métadonnées complètes organisées en sections (identification, caractéristiques techniques, critères éthiques)
        *   **`dataset_files`** : Fichiers associés à un dataset (train.csv, test.csv, metadata.json, etc.)
        *   **`file_columns`** : Colonnes/features de chaque fichier avec métadonnées détaillées (types, statistiques, PII)
        *   **`dataset_relationships`** : Relations logiques entre fichiers (foreign key, join, reference)
        *   **`dataset_relationship_column_links`** : Liens précis entre colonnes dans les relations
        *   **Avantages :** Normalisation complète, métadonnées éthiques étendues, support multi-fichiers, traçabilité des relations

    *   **Scripts d'Initialisation (2025-07-06) :**
        *   **`scripts/`** : Dossier dédié aux scripts de maintenance du service
        *   **`scripts/init_datasets.py`** : Script d'initialisation pour datasets multiples avec gestion sélective
        *   **Datasets supportés** : EdNet (5 fichiers, 29 colonnes), OULAD (14 fichiers, 93 colonnes), Students Performance (1 fichier, 8 colonnes)
        *   **Structure organisée** : Imports relatifs, gestion d'erreurs, documentation intégrée
        *   **Usage** : `cd service-selection && python scripts/init_datasets.py [ednet|oulad|students|all]`

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
        *   [✅] Structure de base présente (`services`, `pages`, `layouts`...).
        *   [✅] Service `AuthService` et module/pages d'authentification fonctionnels.
        *   [✅] **Interface Datasets complète** : Service, composants, models et routing intégrés.
        *   [✅] **Interface Projets complète (2025-01-21)** : Gestion complète des projets avec création/édition/visualisation.
        *   [✅] **Composants Angular Material** : Cards, filtres, pagination, recherche, tri.
        *   [✅] **Fonctionnalités avancées** : Filtrage multi-critères, recherche textuelle, interface responsive.
        *   [✅] **Visualisation Heatmap (2025-01-21)** : Analyse visuelle des scores de recommandation par critère.
        *   [✅] **Recommandations Temps Réel** : Preview automatique des datasets recommandés lors de la configuration.
        *   [✅] **Menu de navigation optimisé (2025-01-07)** : Menu de gauche nettoyé pour ne conserver que les fonctionnalités EXAI essentielles (Tableau de bord, Datasets, Pipeline ML, Explications XAI). Suppression des éléments de démonstration du thème Spike.
        *   [✅] **Header optimisé pour EXAI (2025-01-07)** : Suppression du menu Apps inutile, des liens Chat/Calendar/Email. Recherche élargie pour datasets/modèles. Notifications et raccourcis adaptés au contexte EXAI. Profil utilisateur conservé avec traduction française.
        *   [✅] **Interface Sidebar Collapsible Moderne (2025-07-07)** : Architecture révolutionnaire pour la sélection des datasets.
        *   [✅] **Gestion Profil Utilisateur Complète (2025-01-24)** : Interface Angular Material pour modification du profil avec upload d'image.
        *   [⬜] Services API dédiés (`PipelineService`, `XAIService`) **non implémentés**.
        *   [⬜] Modules/Composants pour Pipeline ML et XAI **non implémentés**.
        *   [⬜] Déploiement K8s non configuré.

    *   **Architecture Interface Modal Moderne (2025-07-07) :**
        *   **Layout Principal Simple** : Header + Recherche rapide + Zone datasets (100% espace)
        *   **Modal de Filtrage** : Interface spacieuse et claire dédiée au filtrage avancé
        *   **Preview Temps Réel** : Compteur de résultats pendant modification des filtres
        *   **Gestion d'État Propre** : `currentFilters` (actuel) + `tempFilters` (modification)
        *   **Actions Explicites** : Boutons "Annuler", "Effacer tout", "Appliquer" bien visibles
        *   **UX Intuitive** : Interface non encombrée, focus total sur filtrage quand nécessaire
        *   **Responsive Excellente** : Modal adaptative desktop/tablet/mobile avec gestures
        *   **Performance Optimisée** : Debounce recherche, preview asynchrone, animations fluides
        *   **Fichiers impactés** :
            *   `frontend/src/app/pages/datasets/dataset-listing.component.html` : Template modal complet
            *   `frontend/src/app/pages/datasets/dataset-listing.component.scss` : CSS modal moderne
            *   `frontend/src/app/pages/datasets/dataset-listing.component.ts` : Logique modal + preview

    *   **Architecture Gestion de Projets (2025-01-21) :**
        *   **Modèles TypeScript** : Interfaces complètes dans `project.models.ts` (Project, ProjectCreate, ProjectRecommendationResponse, etc.)
        *   **Service Angular** : `ProjectService` avec méthodes CRUD complètes et recommandations
        *   **Composants Principaux** :
            *   `ProjectListComponent` : Liste paginée avec recherche et actions CRUD
            *   `ProjectFormComponent` : Formulaire de création/édition avec preview temps réel
            *   `ProjectDetailComponent` : Visualisation complète avec heatmap et recommandations
            *   `ProjectCardComponent` : Carte de projet réutilisable
        *   **Navigation Intégrée** : Routes `/projects` configurées dans `app.routes.ts` + menu sidebar
        *   **Fonctionnalités Avancées** :
            *   Configuration de critères personnalisés via composant de filtres réutilisé
            *   Ajustement de poids de scoring avec sliders interactifs
            *   Preview automatique des recommandations pendant la configuration
            *   Visualisation heatmap des scores par critère pour analyse comparative
            *   Interface responsive desktop/tablet/mobile

    *   **Architecture Gestion Profil Utilisateur (2025-01-24) :**
        *   **Modèles TypeScript** : Interfaces étendues dans `auth.models.ts` (UserUpdate, PasswordUpdate, ProfilePictureUpdate)
        *   **Service Angular** : `AuthService` étendu avec méthodes `updateProfile()`, `updatePassword()`, `updateProfilePicture()`
        *   **Composants Principaux** :
            *   `ProfileComponent` : Interface complète de gestion du profil utilisateur
            *   Formulaires réactifs séparés pour informations personnelles et sécurité
            *   Gestion upload d'image avec preview et validation (format, taille)
        *   **Navigation Intégrée** : Route `/profile` accessible via menu "Mon Profil" dans le header
        *   **Fonctionnalités Avancées** :
            *   Formulaires réactifs Angular avec validation temps réel
            *   Upload d'image avec preview et conversion base64
            *   Validation côté client (formats image, taille max 5MB)
            *   Feedback utilisateur via MatSnackBar pour succès/erreurs
            *   Interface responsive avec Angular Material (MatCard, MatFormField, MatInput)
            *   Sécurité : changement de mot de passe avec validation de l'ancien
        *   **Documentation Complète** :
            *   Guide utilisateur : `docs/user-guide/user-profile-management.adoc`
            *   Documentation technique : `docs/dev-guide/user-profile-components.adoc`
        *   **Bug Fix Critique (2025-01-25)** : Résolution du bug "Maximum call stack size exceeded" dans le formulaire de création de projet
            *   **Problème** : Boucle infinie causée par `defaultWeights` défini comme getter retournant un nouveau tableau à chaque appel
            *   **Solution** : Transformation en propriété normale initialisée dans le constructor avec méthode `initializeDefaultWeights()`
            *   **Améliorations** : Validation robuste dans `onWeightChange()`, gestion d'événements `valueChange` au lieu de `change`, debounce des updates
            *   **Impact** : Formulaire de création de projet maintenant stable et fonctionnel
        *   **Sécurisation Critique des Projets Utilisateur (2025-01-25)** : Correction d'un trou de sécurité majeur
            *   **Problème** : Tous les projets étaient accessibles à tous les utilisateurs connectés, `user_id` généré aléatoirement
            *   **Solution** : Transmission `user_id` via headers `X-User-ID` de l'API Gateway vers service-selection
            *   **Sécurisation** : Tous les endpoints de projets filtrent maintenant obligatoirement par `user_id` de l'utilisateur connecté
            *   **Endpoints sécurisés** : `/projects` (GET/POST), `/projects/{id}` (GET/PUT/DELETE), `/projects/{id}/recommendations`, `/datasets/score`
            *   **Impact** : Isolation complète des projets par utilisateur, conformité RGPD, logs de sécurité détaillés

*   **Infrastructure :**
    *   [✅] PostgreSQL déployé sur K8s et accessible.
        *   **Note importante (2024-04-27) :** La gestion de PostgreSQL a été migrée d'un Deployment vers un **StatefulSet** pour une meilleure gestion de l'état, une identité stable des pods, et pour résoudre les problèmes d'attachement de volume ReadWriteOnce (RWO) lors des mises à jour.
    *   [⬜] Redis non déployé.
    *   [⬜] Workers Celery non déployés.
    *   [✅] Ingress Controller (NGINX via Helm) déployé sur AKS.
    *   [✅] Cert-Manager déployé via Helm sur AKS pour gestion TLS Let's Encrypt.
    *   [✅] Ingress K8s (`exai-ingress`) configuré pour router `exai-pipeline.fr` vers `frontend` et `api.exai-pipeline.fr` vers `api-gateway`, avec TLS activé via cert-manager.
    *   **Note Infrastructure Azure (AKS) :
        *   Le service Nginx Ingress (type LoadBalancer) crée un Load Balancer public Azure.
        *   Des règles NSG sont configurées pour autoriser le trafic sur les ports 80 et 443 vers l'IP publique du Load Balancer.
        *   **Point critique (résolu le 2025-04-27):** Les sondes de santé (Health Probes) HTTP et HTTPS du Load Balancer Azure *doivent* cibler le chemin `/healthz` sur les NodePorts correspondants du service Nginx Ingress (par défaut `/` qui provoque des échecs) pour que le Load Balancer considère les nœuds comme sains et route le trafic correctement.

*   **Automatisation & Migrations (Nouveau - 2024-04-27) :**
    *   [✅] **Makefile intelligent** : Automatisation complète du cycle de développement local
        *   `make dev` : Installation complète (prérequis, Minikube, déploiement, migrations)
        *   `make quick-dev` : Redémarrage rapide
        *   `make migrate` : Gestion automatique des migrations
        *   `make clean/reset` : Nettoyage et réinitialisation
    *   [✅] **Jobs Kubernetes de migration** : Gestion automatisée des migrations Alembic
        *   `k8s/base/jobs/api-gateway-migration-job.yaml`
        *   `k8s/base/jobs/service-selection-migration-job.yaml`
        *   **Images multi-environnements** : Images locales par défaut, transformées automatiquement en production
    *   [✅] **Overlays Kustomize améliorés** :
        *   Configuration base pour développement local
        *   Transformation automatique des images pour production Azure
        *   Patches pour `imagePullPolicy` selon l'environnement
    *   [✅] **Documentation techniques** : Guide complet des migrations dans `docs/modules/ROOT/pages/dev-guide/database-migrations.adoc`

## 3. Interactions Clés

*   Le **Frontend** communique exclusivement avec l'**API Gateway**.
*   L'**API Gateway** valide l'authentification (JWT) et relaie les requêtes aux services backend appropriés (fonctionnalité de proxy **à implémenter**).
*   **`service-selection`**, **`ml-pipeline`**, **`xai-engine`** interagissent avec la base de données **PostgreSQL** (via SQLAlchemy et Alembic pour les migrations).
*   **`ml-pipeline`** et **`xai-engine`** utilisent **Redis** comme broker pour envoyer/recevoir des tâches via **Celery Workers**.
*   Les **Celery Workers** interagissent avec **PostgreSQL** pour lire/écrire les statuts et résultats, et potentiellement avec un stockage de fichiers partagé (PV K8s / Blob Storage) pour lire/écrire des datasets/modèles/résultats.

## 4. Documentation

*   La documentation utilisateur et technique doit être générée dans `docs/` en utilisant **Antora/Asciidoc**. C'est une exigence forte du projet. (Statut actuel : Probablement [⬜])

## 5. Améliorations Récentes (2024-04-27)

### Résolution du Problème des Migrations

**Contexte :** L'installation d'EXAI nécessitait de nombreuses commandes manuelles complexes et les migrations échouaient en développement local à cause d'un problème d'images Docker.

**Problèmes résolus :**
1. **Complexité d'installation** : 15+ commandes manuelles pour démarrer l'application
2. **Images Docker incompatibles** : Jobs de migration utilisaient des images ACR même en local
3. **Expérience développeur** : Processus d'onboarding difficile pour nouveaux développeurs
4. **Gestion des migrations** : Commandes `kubectl exec` manuelles et error-prone

**Solutions implémentées :**

#### Makefile Intelligent
- **Installation en 1 commande** : `make dev` gère tout automatiquement
- **Feedback visuel** : Couleurs, emojis, messages de progression clairs
- **Gestion d'erreurs** : Vérification des prérequis, timeouts, logs d'erreur
- **Commandes quotidiennes** : `make quick-dev`, `make stop`, `make reset`

#### Jobs Kubernetes Multi-Environnements
- **Base locale** : Images `api-gateway:latest`, `service-selection:latest`
- **Transformation Azure** : Kustomize change automatiquement vers ACR
- **Pull Policy adaptatif** : `IfNotPresent` (local) → `Always` (production)
- **Idempotence** : Alembic gère automatiquement l'état des migrations

**Impact :**
- ✅ **Développeurs** : Onboarding en 3 minutes au lieu de 30+
- ✅ **Maintenance** : Un seul endroit pour définir les jobs
- ✅ **Production** : Même mécanisme robuste en local et Azure
- ✅ **Documentation** : Guide complet des différences local/production

## 6. Déploiement et CI/CD

*   **Développement Local :** `skaffold dev` est utilisé pour builder les images Docker localement et déployer sur Minikube en utilisant Kustomize (`k8s/overlays/minikube`).
    *   La configuration, y compris l'URL de redirection OAuth locale (`OAUTH_REDIRECT_URL`), est chargée par les services (ex: API Gateway) depuis des variables d'environnement ou un fichier `.env`, avec des valeurs par défaut définies dans le code (ex: `api-gateway/app/core/config.py`).

## Développement Local

L'environnement de développement local utilise Minikube pour simuler le cluster Kubernetes et Skaffold pour automatiser le cycle de build/déploiement.

### Installation Simplifiée (Makefile)

**Version :** 2024-04-27 - Amélioration majeure de l'expérience utilisateur

Un **Makefile intelligent** a été implémenté pour automatiser entièrement l'installation et la gestion des migrations :

*   **`make dev`** : Installation complète automatisée (première fois)
*   **`make quick-dev`** : Redémarrage rapide (si Minikube déjà lancé)
*   **`make migrate`** : Gestion automatique des migrations via Jobs Kubernetes
*   **`make stop`** / **`make clean`** / **`make reset`** : Gestion du cycle de vie

### Gestion Automatique des Migrations

**Version :** 2024-04-27 - Résolution du problème des images Docker multi-environnements

Les migrations de base de données sont maintenant gérées via des **Jobs Kubernetes** avec **gestion automatique des images** selon l'environnement :

*   **`k8s/base/jobs/api-gateway-migration-job.yaml`**
*   **`k8s/base/jobs/service-selection-migration-job.yaml`**

#### Problème Résolu : Images Docker Multi-Environnements

**Problème initial :**
- Les jobs utilisaient des images ACR (`exaiprodacr.azurecr.io/...`) même en local
- Skaffold construit les images localement avec des noms différents (`api-gateway:latest`)
- Échec des migrations en développement local

**Solution implémentée :**
1. **Jobs de base** : Utilisent des images locales par défaut (`api-gateway:latest`, `service-selection:latest`)
2. **Kustomize overlays** : Transforment automatiquement les images selon l'environnement
3. **Patches Azure** : Ajustent `imagePullPolicy` pour la production

#### Configuration Multi-Environnements

**Base (k8s/base/jobs/) :**
```yaml
# Configuration par défaut (développement local)
image: api-gateway:latest
imagePullPolicy: IfNotPresent
```

**Overlay Azure (k8s/overlays/azure/) :**
```yaml
# Transformation automatique des images
images:
  - name: api-gateway
    newName: exaiprodacr.azurecr.io/exai-api-gateway
  - name: service-selection
    newName: exaiprodacr.azurecr.io/service-selection

# Patch pour forcer le pull en production
patches:
  - path: migration-jobs-pullpolicy-patch.yaml  # imagePullPolicy: Always
```

#### Avantages de cette approche :
*   **Idempotence** : Alembic gère automatiquement les migrations déjà appliquées
*   **Multi-environnements** : Images automatiquement adaptées (local/production)
*   **Sécurité** : Gestion des erreurs et timeouts
*   **Simplicité** : Plus besoin de commandes manuelles `kubectl exec`
*   **Production-Ready** : Même mécanisme en local et en production
*   **Maintenance** : Un seul endroit pour définir les jobs

### Accès aux Services (Profil Local)

Lorsque l'on utilise la commande `skaffold dev --profile=local`, l'accès aux principaux services se fait via des redirections de port gérées automatiquement par Skaffold :

*   **Frontend:** Accessible sur `http://localhost:8080`
*   **API Gateway:** Accessible sur `http://localhost:9000` (y compris `/docs` et `/redoc`)

Cette méthode évite d'avoir besoin de `minikube tunnel` ou `minikube service` pour le workflow de développement standard.

Il est crucial qu'aucun autre service (comme un serveur XAMPP/Apache local) n'utilise les ports `8080` ou `9000` sur la machine hôte.

### Redémarrages Multiples

✅ **Entièrement supporté** : L'application peut être démarrée/arrêtée plusieurs fois par jour sans problème.

*   **PostgreSQL** : Utilise un StatefulSet avec volumes persistants
*   **Migrations** : Idempotentes via Alembic
*   **Configuration** : Persistée via les secrets Kubernetes

## Déploiement

*   **Déploiement Production (Azure) :**
    *   Un workflow GitHub Actions (`.github/workflows/deploy-production.yml`) est configuré.
    *   **Trigger :** Push sur la branche `production`.
    *   **Étapes Principales :
        1.  Checkout du code.
        2.  Login sur Azure Container Registry (ACR).
        3.  Build et Push des images Docker des services (`api-gateway`, `service-selection`, `frontend`, etc.) vers ACR.
        4.  Mise à jour des manifestes de base K8s (`k8s/base/...`) via `sed` pour injecter les valeurs des secrets GitHub Actions (DB URL, JWT Key, Google Credentials, **URL de redirection OAuth de production**). Les valeurs sont encodées en Base64 pendant cette étape.
        5.  Login sur Azure (via Service Principal).
        6.  Configuration du contexte `kubectl` pour le cluster AKS cible.
        7.  (Ajouté) Suppression explicite des Secrets K8s existants (ex: `gateway-secrets`) pour forcer leur recréation par Skaffold.
        8.  Déploiement sur AKS via `skaffold deploy --profile=azure --tag=<commit_sha>` qui utilise l'overlay Kustomize `k8s/overlays/azure`. Cet overlay applique des patches (ex: Ingress) mais **ne modifie plus** l'URL de redirection OAuth (qui est déjà la bonne dans le manifeste de base modifié à l'étape 4).
        9.  Exécution des jobs de migration Alembic (`api-gateway-migration-job`, etc.).
        10. Redémarrage des déploiements si nécessaire.
    *   **Gestion de la Configuration Production :
        *   **Frontend :** Utilisation de `frontend/src/environments/environment.prod.ts` (qui contient l'URL de l'API de production) activé par la configuration de build Angular et le Dockerfile.
        *   **Backend :** Les configurations sont injectées via les Secrets K8s, peuplés par le workflow GitHub Actions (voir étape 4 ci-dessus).
        *   **Kubernetes :** L'overlay `k8s/overlays/azure` contient les manifestes/patches spécifiques à Azure (ex: nom d'images, Ingress) mais **ne gère plus** le patch spécifique pour l'URL de redirection OAuth.
        *   **Migrations :** Les images des jobs sont automatiquement transformées par Kustomize (`api-gateway:latest` → `exaiprodacr.azurecr.io/exai-api-gateway:latest`) avec `imagePullPolicy: Always`.
    *   **Secrets Requis (GitHub Actions) :** `ACR_USERNAME`, `ACR_PASSWORD`, `AZURE_CREDENTIALS`, `JWT_SECRET_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_URL` (contenant l'URL de production **frontend**).
    *   **Certificats TLS :** Gérés automatiquement par `cert-manager` via `ClusterIssuer` Let's Encrypt (requiert configuration Ingress correcte et accessibilité externe sur port 80 pour challenge HTTP-01).
    *   **Note Infrastructure Azure (AKS) :**
        *   Le service Nginx Ingress (type LoadBalancer) crée un Load Balancer public Azure.
        *   Des règles NSG sont configurées pour autoriser le trafic sur les ports 80 et 443 vers l'IP publique du Load Balancer.
        *   **Point critique (résolu le 2025-04-27):** Les sondes de santé (Health Probes) HTTP et HTTPS du Load Balancer Azure *doivent* cibler le chemin `/healthz` sur les NodePorts correspondants du service Nginx Ingress (par défaut `/` qui provoque des échecs) pour que le Load Balancer considère les nœuds comme sains et route le trafic correctement. 