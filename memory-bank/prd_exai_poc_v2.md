# IBIS-X : Document de Spécifications Détaillé (Preuve de Concept - PoC v2)

**Version :** 0.2
**Date :** 26 avril 2025
**Auteur :** Gemini (basé sur les informations fournies par Anthony Rodrigues)
**Objectif :** Fournir des spécifications techniques et fonctionnelles précises et non ambiguës pour le développement de la Preuve de Concept (PoC) d'IBIS-X, exploitables par un outil de développement assisté par IA (ex: Cursor AI).

## 1. Introduction et Objectifs (Rappel)

* **Vue d'ensemble :** IBIS-X est un pipeline intégré (Sélection Données -> Analyse ML Guidée -> Explication XAI) pour utilisateurs non-experts.
* **Objectif PoC :** Démontrer la **faisabilité technique** de ce pipeline intégré via un prototype fonctionnel déployable localement (Minikube).
* **Public Cible :** Utilisateurs non-spécialistes en science des données.

## 2. Architecture Générale (PoC - Rappel Technique)

* **Style :** Microservices.
* **Orchestration :** Docker & Kubernetes (cible: Minikube).
* **Services Backend :** `gateway` (FastAPI), `service-selection` (FastAPI, SQLAlchemy), `ml-pipeline` (FastAPI, Celery), `xai-engine` (FastAPI, Celery).
* **Frontend :** `frontend` (Angular, Angular Material).
* **Infrastructure :** PostgreSQL (BDD), Redis (Broker Celery).
* **Communication :** API REST (JSON), Tâches asynchrones (Celery).
* **Stockage Fichiers (PoC) :** Volume Persistant K8s (PV/PVC) monté sur les pods concernés (ex: `/data`).

## 3. Spécifications Fonctionnelles et Techniques Détaillées par Module

### 3.1. Module `service-selection` (FastAPI, SQLAlchemy, PostgreSQL)

**Responsabilité :** Gestion des métadonnées des datasets, filtrage, scoring et fourniture des informations au reste de l'application.

**3.1.1. Modèle de Données (PostgreSQL - Table `datasets`)**

* Utiliser **strictement** le schéma SQL détaillé fourni précédemment (dans `reponses_techniques_ibis_x`), incluant tous les champs (identification, techniques, éthiques, internes), les types précis (`TEXT`, `VARCHAR` avec `CHECK`, `BOOLEAN`, `INTEGER`, `TEXT[]`, `TIMESTAMPTZ`), les contraintes (`NOT NULL`, `UNIQUE`), les valeurs par défaut, les index et le trigger `update_updated_at`.
* **Migration :** Intégrer et utiliser **Alembic** pour toute création ou modification de ce schéma.

**3.1.2. Modèles Pydantic (pour validation API et sérialisation)**

* **`DatasetBase` :** Contient les champs communs partagés par `DatasetCreate` et `DatasetRead`.
* **`DatasetCreate` :** Modèle pour `POST /datasets/upload`. Valide les métadonnées fournies par l'utilisateur. Inclut un champ optionnel `file_reference` (string, URL/chemin).
* **`DatasetRead` :** Modèle pour les réponses `GET`. Inclut tous les champs de la table `datasets` pertinents pour l'affichage (y compris `id`, `created_at`, `updated_at`).
* **`DatasetFilterCriteria` :** Modèle pour les paramètres de query de `GET /datasets`. Doit permettre de spécifier des filtres pour chaque champ pertinent (ex: `name__ilike: Optional[str] = None`, `subject_area: Optional[str] = None`, `anonymization: Optional[bool] = None`, `num_citations__gt: Optional[int] = None`).
* **`CriterionWeight` :** Sous-modèle pour `DatasetScoreRequest`, représentant un critère et son poids (ex: `{ "criterion_name": "anonymization", "weight": 1.0 }`).
* **`DatasetScoreRequest` :** Modèle pour `POST /datasets/score`. Contient :
    * `filters: DatasetFilterCriteria` (ou un dictionnaire simple pour la PoC).
    * `weights: List[CriterionWeight]` (ou un dictionnaire `{criterion_name: weight}`).
* **`DatasetScoredRead` :** Modèle pour la réponse de `POST /datasets/score`. Contient les champs de `DatasetRead` plus un champ `score: float`.

**3.1.3. Endpoints API (FastAPI)**

* **`GET /datasets`**
    * **Input :** Paramètres de query correspondant aux champs de `DatasetFilterCriteria`.
    * **Logique :**
        1.  Valider les paramètres de query via `DatasetFilterCriteria`.
        2.  Construire une requête SQLAlchemy dynamiquement basée sur les filtres fournis (gérer les `None`, utiliser `ilike` pour le texte, `=` pour bool/catégories, `>`, `<`, etc. pour numériques).
        3.  Exécuter la requête sur la table `datasets`.
        4.  Sérialiser les résultats en utilisant `DatasetRead`.
    * **Output :** `List[DatasetRead]`.
* **`POST /datasets/score`**
    * **Input :** Corps JSON validé par `DatasetScoreRequest`.
    * **Logique :**
        1.  Valider le corps de la requête.
        2.  Construire et exécuter la requête SQL de filtrage initial basée sur `request.filters`.
        3.  Récupérer la liste des datasets correspondants (objets SQLAlchemy).
        4.  Calculer `max_possible_score` à partir de `request.weights`.
        5.  Pour chaque dataset récupéré :
            * Appeler la fonction `calculate_relevance_score(dataset, request.weights)` (détaillée dans `reponses_techniques_ibis_x`).
            * Calculer le score normalisé si `max_possible_score > 0`.
        6.  Trier les datasets par score décroissant.
        7.  Sérialiser les résultats en utilisant `DatasetScoredRead`.
    * **Output :** `List[DatasetScoredRead]`.
* **`GET /datasets/{dataset_id}`**
    * **Input :** `dataset_id: int` (Path parameter).
    * **Logique :**
        1.  Requête SQLAlchemy pour trouver le dataset par `id`.
        2.  Si trouvé, sérialiser avec `DatasetRead`.
        3.  Si non trouvé, lever une `HTTPException` (404).
    * **Output :** `DatasetRead`.
* **`POST /datasets/upload`**
    * **Input :** Corps JSON validé par `DatasetCreate`. Le `file_reference` doit pointer vers un emplacement accessible par les workers (ex: chemin sur PV K8s pour la PoC).
    * **Logique :**
        1.  Valider les données reçues.
        2.  (Optionnel : Vérifier si un dataset avec le même `name` existe déjà).
        3.  Créer une nouvelle instance du modèle SQLAlchemy `DatasetModel` avec les données reçues, `upload_source='User'`, `validation_status='Pending'`, et l'ID de l'utilisateur authentifié (à récupérer depuis la requête/token).
        4.  Ajouter et commiter la nouvelle instance à la session SQLAlchemy.
        5.  Rafraîchir l'instance pour obtenir l'ID généré.
        6.  Sérialiser la nouvelle instance avec `DatasetRead`.
    * **Output :** `DatasetRead`.
* **`GET /datasets/{dataset_id}/preview` (Implémentation Robuste Recommandée)**
    * **Input :** `dataset_id: int`.
    * **Logique :**
        1.  Récupérer le dataset par `id`.
        2.  Vérifier si un `preview_reference` existe (champ à ajouter au schéma si cette approche est choisie).
        3.  Si oui, lire le contenu de la prévisualisation depuis cet emplacement (fichier sur PV/Blob ou colonne BDD).
        4.  Si non (ou si l'approche dynamique est choisie pour la PoC), tenter de lire les N premières lignes depuis `file_reference` (voir `reponses_techniques_ibis_x` pour les détails et limites).
        5.  Retourner les données lues (ex: en JSON).
    * **Output :** Structure JSON représentant les premières lignes/colonnes.

**3.1.4. Script d'Import Initial (`import_initial_data.py`)**

* **Dépendances :** `pandas`, `openpyxl` (si lecture `.xlsx`), `sqlalchemy`.
* **Logique :**
    1.  Configurer la connexion à la base de données (via variables d'environnement).
    2.  Lire le fichier source (`.xlsx` ou `.csv`) avec Pandas.
    3.  Itérer sur les lignes du DataFrame Pandas.
    4.  Pour chaque ligne :
        * Mapper les noms de colonnes du fichier aux noms de colonnes de la table `datasets`.
        * Effectuer les **conversions de type explicites et robustes** :
            * 'ü'/'Yes' -> `True`, 'û'/'No' -> `False`, autres/vides -> `None` (ou `False` par défaut si pertinent) pour les booléens.
            * Nettoyer/Convertir `num_instances`, `num_features`, `num_citations` en `INTEGER` (gérer les erreurs de conversion, les formats comme 'X records').
            * Nettoyer les chaînes de caractères (trim whitespace).
            * Convertir les listes séparées par virgules (ex: `learning_indicators`, `ml_task`) en listes Python pour les champs `TEXT[]`.
        * Gérer les valeurs manquantes (`NaN` Pandas -> `None` Python/NULL SQL).
        * Créer une instance du modèle SQLAlchemy `DatasetModel`.
    5.  Utiliser une session SQLAlchemy pour ajouter toutes les instances créées à la base de données (`session.add_all([...])`, `session.commit()`).
    6.  Inclure une gestion d'erreurs et du logging.

### 3.2. Module `ml-pipeline` (FastAPI, Celery, Scikit-learn)

**Responsabilité :** Orchestrer l'exécution asynchrone des tâches de pipeline ML.

**3.2.1. Modèles de Données (Potentiellement dans une BDD partagée ou dédiée)**

* **`PipelineRun` :** Table pour suivre les exécutions. Champs : `id`, `dataset_reference`, `task_type`, `algorithm`, `preprocessing_steps` (JSONB), `status` ('PENDING', 'RUNNING', 'SUCCESS', 'FAILURE'), `start_time`, `end_time`, `results` (JSONB, pour métriques), `model_reference` (TEXT, chemin/URL).
* **`MLModel` :** (Optionnel, si gestion plus fine des modèles) Table pour les modèles : `id`, `run_id` (FK vers `PipelineRun`), `model_type`, `hyperparameters` (JSONB), `model_file_reference`.

**3.2.2. Tâches Celery (`tasks.py`)**

* **`run_ml_pipeline_task(run_id: int, dataset_reference: str, task_type: str, algorithm: str, preprocessing_steps: list, ...)` :**
    1.  Mettre à jour le statut du `PipelineRun` (ID=`run_id`) à 'RUNNING'.
    2.  **Charger les données :** Lire le dataset depuis `dataset_reference` (via PV/Blob).
    3.  **Prétraitement :** Appliquer les étapes de `preprocessing_steps` (ex: `impute_mean` -> utiliser `SimpleImputer(strategy='mean')` de scikit-learn). *Logique très simple pour la PoC.*
    4.  **Sélection/Instanciation Modèle :** Basé sur `algorithm` (ex: 'LogisticRegression' -> `LogisticRegression()`). *Pas de tuning pour la PoC.*
    5.  **Entraînement :** Entraîner le modèle (`model.fit(X_train, y_train)`). *Split train/test simple.*
    6.  **Évaluation :** Calculer les métriques de base (ex: accuracy pour classification, MSE pour régression) sur le set de test.
    7.  **Sauvegarde Modèle :** Sauvegarder le modèle entraîné sur le stockage partagé (PV/Blob) avec un nom unique (ex: `/data/models/run_{run_id}/model.joblib`).
    8.  **Mise à jour BDD :** Mettre à jour le `PipelineRun` avec `status='SUCCESS'`, les `results` (métriques) et le `model_reference`.
    9.  **Gestion Erreurs :** En cas d'échec, mettre à jour le statut à 'FAILURE' et logger l'erreur.

**3.2.3. Endpoints API (FastAPI)**

* **`POST /pipelines`**
    * **Input :** JSON `{ "dataset_reference": str, "task_type": str, "algorithm": str, "preprocessing_steps": list }`.
    * **Logique :**
        1.  Valider l'input.
        2.  Créer un enregistrement `PipelineRun` en BDD avec `status='PENDING'`.
        3.  Lancer la tâche Celery `run_ml_pipeline_task.delay(...)` avec les paramètres nécessaires et l'ID du run.
        4.  Retourner l'ID du run et le statut 'PENDING'.
    * **Output :** `{ "pipeline_run_id": int, "status": "PENDING" }`.
* **`GET /pipelines/{pipeline_run_id}`**
    * **Input :** `pipeline_run_id: int`.
    * **Logique :** Récupérer l'enregistrement `PipelineRun` depuis la BDD.
    * **Output :** JSON contenant le statut, les résultats (si SUCCESS), la référence au modèle, etc.

### 3.3. Module `xai-engine` (FastAPI, Celery, SHAP/LIME)

**Responsabilité :** Orchestrer l'exécution asynchrone des tâches d'explication XAI.

**3.3.1. Modèles de Données**

* **`ExplanationRequest` :** Table pour suivre les demandes. Champs : `id`, `pipeline_run_id` (ou `model_reference`), `dataset_reference`, `explanation_type` ('local', 'global'), `instance_ref` (si local, peut être un ID ou les données elles-mêmes en JSONB), `method_requested` (optionnel), `method_used` (SHAP, LIME), `audience`, `status`, `start_time`, `end_time`, `results_reference` (JSONB ou TEXT[]).

**3.3.2. Tâches Celery (`tasks.py`)**

* **`generate_explanation_task(request_id: int, model_reference: str, dataset_reference: str, explanation_type: str, audience: str, ...)` :**
    1.  Mettre à jour le statut de `ExplanationRequest` (ID=`request_id`) à 'RUNNING'.
    2.  **Charger Modèle :** Charger le modèle depuis `model_reference`.
    3.  **Charger Données :** Charger le dataset (ou un échantillon si pertinent pour XAI) depuis `dataset_reference`.
    4.  **Sélection Méthode XAI :** Logique simple : si modèle arbre/linéaire -> SHAP Tree/Linear, sinon SHAP Kernel ou LIME. *Pas de recommandation complexe pour la PoC.* Mettre à jour `method_used`.
    5.  **Exécution XAI :** Appliquer la méthode XAI (ex: `shap.KernelExplainer`, `lime.LimeTabularExplainer`).
    6.  **Formatage Résultat :** Générer les résultats bruts (valeurs SHAP, importances LIME). Appeler une fonction de formatage spécifique à l'`audience` (ex: `format_explanation_novice`) pour générer JSON/texte/image.
    7.  **Sauvegarde Résultat :** Sauvegarder les fichiers formatés sur le stockage partagé (PV/Blob) avec des noms uniques (ex: `/data/xai_results/req_{request_id}/explanation.json`).
    8.  **Mise à jour BDD :** Mettre à jour `ExplanationRequest` avec `status='SUCCESS'` et `results_reference` (liste des chemins/URLs des fichiers générés).
    9.  **Gestion Erreurs :** Mettre à jour statut à 'FAILURE' et logger.

**3.3.3. Endpoints API (FastAPI)**

* **`POST /explanations`**
    * **Input :** JSON `{ "model_reference": str, "dataset_reference": str, "explanation_type": str, "instance_ref": Optional[Any], "audience": str }`.
    * **Logique :**
        1.  Valider l'input.
        2.  Créer un enregistrement `ExplanationRequest` en BDD avec `status='PENDING'`.
        3.  Lancer la tâche Celery `generate_explanation_task.delay(...)` avec les paramètres et l'ID de la requête.
        4.  Retourner l'ID de la requête et le statut 'PENDING'.
    * **Output :** `{ "explanation_id": int, "status": "PENDING" }`.
* **`GET /explanations/{explanation_id}`**
    * **Input :** `explanation_id: int`.
    * **Logique :** Récupérer l'enregistrement `ExplanationRequest` depuis la BDD.
    * **Output :** JSON contenant le statut, les références aux résultats (si SUCCESS), etc. (Le frontend devra ensuite potentiellement récupérer les fichiers référencés).

### 3.4. Module `gateway` (FastAPI, fastapi-users)

* **Configuration `fastapi-users` :** Mettre en place l'authentification JWT (secret key, modèles User, BDD backend - peut utiliser la même instance PostgreSQL avec un schéma séparé ou la même table `users` si enrichie).
* **Dépendances Sécurisées :** Utiliser les dépendances fournies par `fastapi-users` (`current_active_user`) pour protéger les endpoints des services backend.
* **Routage (Reverse Proxy) :** Configurer les routes pour rediriger `/api/v1/datasets/*` vers `service-selection`, `/api/v1/pipelines/*` vers `ml-pipeline`, etc. S'assurer que les headers d'authentification sont correctement gérés ou que le token est validé *avant* le proxying.

### 3.5. Module `frontend` (Angular, Angular Material)

* **Structure :** Organisation en modules Angular (ex: `AuthModule`, `DatasetSelectionModule`, `MLPipelineModule`, `XAIModule`).
* **Services Angular :** Créer des services (ex: `DatasetService`, `PipelineService`, `ExplanationService`) pour encapsuler les appels API vers la gateway (en utilisant `HttpClient`). Gérer l'ajout du token JWT aux requêtes sortantes.
* **Composants :** Développer les composants nécessaires pour chaque fonctionnalité en utilisant **Angular Material** :
    * Tableau de datasets (`MatTable`, `MatPaginator`, `MatSort`) avec filtres (`MatFormField`, `MatInput`, `MatSelect`, `MatCheckbox`) et scoring (`MatSlider`).
    * Fiche détaillée du dataset (`MatCard`).
    * Formulaire d'upload (simple pour métadonnées).
    * Lanceur de pipeline (`MatSelect` pour dataset/tâche/algo, `MatButton`).
    * Affichage statut/résultats ML (`MatCard`, `MatChip`, affichage métriques).
    * Demandeur d'explication (`MatSelect` pour run/audience, `MatButton`).
    * Affichage résultats XAI (`MatCard`, affichage simple des features).
* **Librairie UI :** Utiliser **Angular Material** pour les composants.

## 4. Exigences Non Fonctionnelles (PoC)

* **Faisabilité :** Le système doit permettre d'exécuter au moins un scénario complet (Sélection -> ML -> XAI).
* **Modularité :** La structure du code doit suivre l'architecture microservices. Chaque service doit être déployable indépendamment (via Docker/K8s).
* **Déployabilité Locale :** L'ensemble de l'application (services, BDD, Redis) doit pouvoir être déployé et exécuté sur Minikube à l'aide de manifestes K8s (gérés via Kustomize/Skaffold idéalement).
* **Utilisabilité (Basique) :** L'interface doit être suffisamment claire pour qu'un utilisateur guidé puisse réaliser le scénario de test principal.
* **Gestion des Migrations BDD :** Utilisation d'Alembic pour gérer le schéma PostgreSQL.

## 5. Exigences de Données

* **Source Initiale :** Le fichier `datasets final table .xlsx - Sheet1.csv` sera parsé pour le peuplement initial de la table `datasets`.
* **Schéma BDD :** Le schéma PostgreSQL défini dans le document `reponses_techniques_ibis_x` (incluant la table `datasets` et potentiellement `ml_models`, `explanation_results`, `users`) sera implémenté et géré via Alembic.
* **Stockage Fichiers :** Un Volume Persistant K8s sera utilisé pour stocker les fichiers référencés (modèles, résultats XAI, datasets uploadés si l'approche locale est choisie pour la prévisualisation/accès worker).

## 6. Critères de Succès de la PoC

La PoC sera considérée comme réussie si :
1.  Un utilisateur peut rechercher/filtrer des datasets, obtenir un score de pertinence, et visualiser les détails d'un dataset sélectionné.
2.  Un utilisateur peut initier un pipeline ML sur un dataset sélectionné, et obtenir des métriques de performance de base pour un modèle entraîné.
3.  Un utilisateur peut demander et visualiser une explication XAI simple (ex: importance des features) pour le modèle entraîné.
4.  L'architecture microservices est fonctionnelle sur Minikube, avec communication inter-services (via API Gateway et/ou Celery).
5.  Des retours qualitatifs initiaux (même limités) suggèrent que l'approche intégrée et guidée est pertinente pour le public cible.

