# EXAI - Assistant IA pour développement PoC XAI

Ce fichier Markdown est conçu pour être utilisé avec **Cursor AI** ou tout autre assistant intelligent de développement.
Il décrit **l'ensemble du projet EXAI**, ses objectifs, son architecture technique, les microservices à développer, l’infrastructure cible (Kubernetes), et **toutes les étapes nécessaires** à la mise en œuvre du PoC, avec une indication claire de l’état d’avancement ✅/⬜.

---

## 🎯 Objectif général du projet
Développer une **plateforme pédagogique intelligente et modulaire** pour accompagner les utilisateurs (étudiants, enseignants, analystes) dans :
- ✅ La **sélection technique et éthique de jeux de données**.
- ✅ La **création et l’exécution de pipelines ML interactifs** (classification, régression, clustering).
- ✅ La **compréhension et l’explicabilité des résultats** via des techniques XAI (ex : SHAP, LIME).

Ce projet est conçu comme un **Proof of Concept académique**, orienté éducation mais généralisable à la santé, cybersécurité, finance, etc.

---

## 🧱 Architecture générale (microservices Kubernetes)

```
+------------------+       +------------------+       +------------------+       +------------------+
|    Frontend      | <---> |   API Gateway    | <---> | Microservices ML | <---> | Base PostgreSQL  |
|   (Angular)      |       |    (FastAPI)     |       |  selection/XAI   |       |   (datasets...)  |
+------------------+       +------------------+       +------------------+       +------------------+
```

- Tous les services communiquent via HTTP (API REST).
- L’API Gateway est le point d’entrée unique vers les microservices.
- Le déploiement se fait via **Minikube** en local (ou K8s standard).

### Technologies principales par composant
| Composant             | Technologie                                  |
|----------------------|-----------------------------------------------|
| Frontend             | Angular                                       |
| API Gateway          | FastAPI                                       |
| Selection Service    | FastAPI + SQLAlchemy + PostgreSQL             |
| ML Pipeline Service  | FastAPI + Celery + Redis + scikit-learn       |
| XAI Service          | FastAPI + SHAP, LIME, PDP etc.                |
| Base de données      | PostgreSQL                                    |
| Orchestration        | Kubernetes (Minikube en local)                |

---

## 📦 Microservices à développer

### ✅ API Gateway (port : 8088)
- [x] FastAPI avec route `/ping`
- [x] Déployé avec Kubernetes
- [x] Exposé via NodePort Minikube
- [ ] Ajout des reverse proxies vers les autres services

### ✅ Microservice : Dataset Selection (port : 8081)
- [x] FastAPI + SQLAlchemy + Docker
- [x] Modèle Dataset (nom, description...)
- [x] Déployé sur Minikube
- [ ] Connexion réelle à PostgreSQL
- [ ] Endpoints REST :
  - [ ] `GET /datasets`
  - [ ] `POST /datasets`
  - [ ] `GET /datasets/{id}`
  - [ ] `DELETE /datasets/{id}`

### ⬜ Microservice : ML Pipeline (port : 8082)
- [ ] FastAPI exposant des tâches async
- [ ] Backend ML avec scikit-learn
- [ ] Async execution via Celery + Redis
- [ ] Entraînement auto en fonction des données envoyées
- [ ] Visualisation résultats : courbes apprentissage, confusion

### ⬜ Microservice : XAI Engine (port : 8083)
- [ ] FastAPI + librairies explicabilité (SHAP, LIME, PDP)
- [ ] Génération d’explications locales / globales
- [ ] Input : modèle ML + données ➜ Output : json d’explication

### ⬜ PostgreSQL (via K8s ou Docker)
- [ ] Déploiement PostgreSQL via Helm chart / YAML
- [ ] Volume persistant
- [ ] Initialisation via script SQL (datasets, users)
- [ ] Exposition en interne pour les services

### ⬜ Frontend Angular (UX pédagogique)
- [ ] Page accueil + navigation
- [ ] Formulaire de sélection (critères techniques + éthiques)
- [ ] Envoi des configs vers API Gateway
- [ ] Visualisation des résultats (graphiques, XAI, erreurs...)

### ⬜ Ingress Controller (optionnel)
- [ ] Déploiement NGINX Ingress
- [ ] Routage propre : `/api/gateway`, `/api/ml`, `/api/xai`
- [ ] Certificats SSL (en production seulement)

---

## 🔁 Checklist de déploiement (étapes techniques)

| Étape                                                      | Statut |
|------------------------------------------------------------|--------|
| ✅ Installer Minikube + kubectl                           |   ✅   |
| ✅ Créer le namespace `exai`                              |   ✅   |
| ✅ Déployer API Gateway (build + apply)                   |   ✅   |
| ✅ Déployer Dataset Service                               |   ✅   |
| ⬜ Déployer base PostgreSQL + init table `datasets`        |        |
| ⬜ Créer routes REST sur `service-selection`               |        |
| ⬜ Créer ML pipeline (model training async + save results) |        |
| ⬜ Déployer Redis et Celery Worker                         |        |
| ⬜ Déployer service XAI                                    |        |
| ⬜ Créer API Gateway Proxy Routes                          |        |
| ⬜ Déployer frontend Angular + appeler Gateway             |        |
| ⬜ Ajouter Ingress Controller                              |        |

---

## 🧠 Conseils pour IA Cursor / copilote

- Génère les **modèles SQLAlchemy** manquants pour `Dataset`, `PipelineRun`, etc.
- Génère les **fichiers `Dockerfile`, `deployment.yaml`, `service.yaml`** si absent
- Vérifie les connexions base de données (env var `DATABASE_URL`)
- Assure l’**interopérabilité API Gateway → services internes**
- Propose les scripts init PostgreSQL (dataset de test)
- Propose les scripts Angular pour les appels API (httpClient + service)
- Peut suggérer l’utilisation de Helm Charts pour production simplifiée

---

## 📚 Notes fonctionnelles et pédagogiques
- Le projet doit être **utilisable par des non-experts en IA**.
- L’interface doit guider l’utilisateur dans les étapes :
  1. Sélection des données (filtrage, aperçu, métadonnées)
  2. Choix du type de tâche ML (classification, régression…)
  3. Entraînement automatique d’un modèle proposé
  4. Résultat + interprétation XAI selon son profil utilisateur (expert / non expert)
- Le système doit proposer une **explication claire des résultats** et des modèles utilisés.

---

## 👨‍🎓 Auteur : Master 2 MIAGE — Projet EXAI 2024/2025
