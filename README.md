# EXAI - Plateforme d'expérimentation Explainable AI (XAI) avec pipeline ML

Ce projet est une plateforme de démonstration (PoC) pour l'expérimentation d'une architecture microservices incluant :
- Une API Gateway
- Plusieurs microservices : sélection de jeux de données, pipeline ML, moteur XAI
- Une architecture conteneurisée déployable sous Kubernetes avec Minikube
- Une interface frontend Angular (en cours de développement)

## Sommaire
1. [Pré-requis](#pré-requis)
2. [Installation de Minikube et Kubectl](#installation-de-minikube-et-kubectl)
3. [Structure du projet](#structure-du-projet)
4. [Construction et déploiement de l'API Gateway](#api-gateway)
5. [Problèmes rencontrés sur Windows 11](#astuce-windows)
6. [Accéder à l'application](#accès-api)

---

## Pré-requis
- Docker installé (et fonctionnel)
- Terminal Bash (Git Bash sous Windows ou natif sous macOS/Linux)
- Minikube (dernière version)
- kubectl

---

## Installation de Minikube et kubectl

### Sous **Windows** avec Chocolatey :
```powershell
choco install minikube
choco install kubernetes-cli
```

### Sous **macOS** avec Homebrew :
```bash
brew install minikube
brew install kubectl
```

### Sous **Linux (Debian/Ubuntu)** :
```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

### Lancer Minikube :
```bash
minikube start
```

### Vérifier que le cluster est OK :
```bash
kubectl get nodes
```

---

## Structure du projet

```bash
2025-research-exai/
├── api-gateway/
│   ├── main.py               # Code FastAPI
│   ├── requirements.txt      # Dépendances
│   ├── Dockerfile            # Image Docker
│   ├── deployment.yaml       # Déploiement Kubernetes
│   └── service.yaml          # Service Kubernetes
└── (autres microservices à venir...)
```

---

## API Gateway

### 1. Se placer dans le dossier :
```bash
cd api-gateway
```

### 2. Créer le namespace Kubernetes :
```bash
kubectl create namespace exai
```

### 3. (Option 1) Build et push via registre local
#### Créer un registre local :
```bash
docker run -d -p 5000:5000 --name registry registry:2
```

#### Builder et pousser l'image :
```bash
docker build -t localhost:5000/exai-api-gateway:latest .
docker push localhost:5000/exai-api-gateway:latest
```

#### Modifier `deployment.yaml` pour utiliser cette image :
```yaml
image: localhost:5000/exai-api-gateway:latest
```

### 4. Appliquer les manifestes :
```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### 5. Supprimer les pods pour forcer le redéploiement :
```bash
kubectl delete pod -n exai -l app=api-gateway
```

---

## Astuce Windows (erreurs `ErrImagePull`, `ImagePullBackOff`, `wmic` manquant)
- Sur Windows 11, `minikube image load` ne fonctionne plus car `wmic` a été supprimé.
- Pour contourner le problème, un registre Docker local (localhost:5000) est la solution recommandée.

### Sous macOS/Linux :
- Vous pouvez aussi utiliser `minikube docker-env` + `docker build` (fonctionne bien sans wmic)
```bash
eval $(minikube docker-env)
docker build -t exai-api-gateway .
```

---

## Accès API

Récupérer l'URL du service avec Minikube :
```bash
minikube service api-gateway-service -n exai --url
```

Tester :
```bash
curl http://<url>/ping
# ou depuis un navigateur
```

## Microservice sélection

1. Se placer dans le dossier :
```bash
cd service-selection
```

2. Build et push dans le registre local :
```bash
docker build -t localhost:5000/service-selection:latest .
docker push localhost:5000/service-selection:latest
```

3. Modifier `deployment.yaml` :
```yaml
image: localhost:5000/service-selection:latest
```

4. Appliquer les fichiers :
```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

5. Supprimer les pods si nécessaire :
```bash
kubectl delete pod -n exai -l app=service-selection
```

6. Obtenir l’URL du service :
```bash
minikube service service-selection-service -n exai --url
```

---

## Astuce Windows

- Sur Windows 11, `minikube image load` ne fonctionne plus car `wmic` a été supprimé.
- Utilisez un registre Docker local (`localhost:5000`) pour éviter ces erreurs (`ErrImagePull`, `ImagePullBackOff`).

### Sous macOS/Linux :
```bash
eval $(minikube docker-env)
docker build -t exai-api-gateway .
```

---

## Accès API

```bash
minikube service api-gateway-service -n exai --url
curl http://<url>/ping
```

---

## Prochaine étape
- Créer et déployer le microservice pipeline ML
- Intégrer les services XAI (SHAP, LIME)
- Ajouter un Ingress Controller pour unifier les URL

---

## Auteurs
- Projet EXAI - Master 2 MIAGE
- Déploiement guidé pas à pas
