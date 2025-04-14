# EXAI - Plateforme d'expérimentation Explainable AI (XAI) avec pipeline ML

Ce projet est une plateforme de démonstration (PoC) pour l'expérimentation d'une architecture microservices incluant :
- Une API Gateway
- Plusieurs microservices : sélection de jeux de données, pipeline ML, moteur XAI
- Une architecture conteneurisée déployable sous Kubernetes avec Minikube
- Une interface frontend Angular (en cours de développement)

## Sommaire
1. [Pré-requis](#pré-requis)
2. [Installation de Minikube et Kubectl](#installation-de-minikube-et-kubectl)
3. [🚀 Getting Started (Déploiement complet avec Minikube)](#-getting-started-déploiement-complet-avec-minikube)
4. [Structure du projet](#structure-du-projet)
5. [Construction et déploiement de l'API Gateway](#api-gateway)
6. [Construction et déploiement du Service Sélection](#microservice-sélection)
7. [Problèmes rencontrés sur Windows 11](#astuce-windows)
8. [Accéder aux services via Minikube](#accéder-aux-services-via-minikube)
9. [Alternative : Lancer le Service Sélection avec Docker Compose](#-alternative--lancer-le-service-sélection-avec-docker-compose)

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

## 🚀 Getting Started (Déploiement complet avec Minikube)

Cette section décrit les étapes pour déployer l'ensemble de l'application EXAI sur votre cluster Minikube local. C'est la méthode recommandée pour tester l'architecture microservices complète.

### 1. Prérequis

- Assurez-vous d'avoir installé et configuré : Docker Desktop, `kubectl` et Minikube (voir sections précédentes).
- Assurez-vous que Docker Desktop est en cours d'exécution.

### 2. Démarrer Minikube

Ouvrez un terminal et lancez :
```bash
minikube start
# Si vous rencontrez des problèmes, essayez de spécifier le driver:
# minikube start --driver=docker
```
Vérifiez l'état du cluster :
```bash
minikube status
kubectl get nodes
```

### 3. Créer le Namespace `exai`

Nous allons isoler toutes les ressources Kubernetes de ce projet dans un namespace dédié.
```bash
kubectl create namespace exai
```
*(Si le namespace existe déjà, cette commande affichera une erreur, ce qui n'est pas grave)*

### 4. Déployer PostgreSQL

La base de données est la première dépendance à déployer.
```bash
# Appliquer les fichiers de configuration pour le déploiement, le service et le volume
kubectl apply -f k8s/postgres/ -n exai
```
Vérifiez que le pod PostgreSQL démarre correctement (le statut doit passer à `Running 1/1`) :
```bash
kubectl get pods -n exai
# Attendez quelques instants si le statut est "ContainerCreating" ou "Pending"
```

### 5. Initialiser la Base de Données PostgreSQL

Une fois le pod PostgreSQL lancé, nous devons créer la table `datasets` en exécutant le script SQL.

1.  **Trouver le nom exact du pod PostgreSQL :**
    ```bash
    kubectl get pods -n exai | grep postgresql
    # Copiez le nom complet du pod (ex: postgresql-deployment-xxxxx-yyyyy)
    ```
2.  **Exécuter le script d'initialisation :**
    Remplacez `<NOM_DU_POD_POSTGRES>` par le nom que vous venez de copier.
    ```bash
    kubectl exec -n exai <NOM_DU_POD_POSTGRES> -- psql -U exai_user -d exai_db -f /docker-entrypoint-initdb.d/init-db.sql
    # Note : Nous allons d'abord copier le script dans le pod.
    # Commande pour copier le script :
    kubectl cp k8s/postgres/init-db.sql <NOM_DU_POD_POSTGRES>:/tmp/init-db.sql -n exai
    # Commande pour exécuter le script copié :
    kubectl exec -n exai <NOM_DU_POD_POSTGRES> -- psql -U exai_user -d exai_db -f /tmp/init-db.sql
    ```
    *(Nous utiliserons la méthode par copie `kubectl cp` car le script n'est pas automatiquement monté dans `/docker-entrypoint-initdb.d` avec cette configuration YAML)*

### 6. Déployer les autres Microservices (API Gateway, Service Sélection, ...)

Pour chaque microservice (par exemple, `api-gateway`, `service-selection`) :

1.  **Naviguer vers le répertoire du service :**
    ```bash
    cd <nom-du-service> # ex: cd api-gateway
    ```
2.  **Construire l'image Docker et la charger dans Minikube :**
    *(Méthode recommandée pour éviter les problèmes de registre sous Windows)*
    ```bash
    # Assurez-vous que votre terminal est configuré pour utiliser le Docker de Minikube
    eval $(minikube -p minikube docker-env) # Pour Linux/macOS (Bash/Zsh)
    # minikube -p minikube docker-env | Invoke-Expression # Pour Windows PowerShell

    # Construire l'image
    docker build -t <nom-image>:<tag> . # ex: docker build -t exai-api-gateway:latest .

    # (Facultatif) Revenir à l'environnement Docker de votre machine
    # eval $(minikube docker-env -u) # Pour Linux/macOS (Bash/Zsh)
    # minikube -p minikube docker-env -u | Invoke-Expression # Pour Windows PowerShell
    ```
    *Alternative (si `eval $(minikube docker-env)` ne fonctionne pas ou si vous préférez) : Utiliser un registre local (voir section Astuce Windows).* Construisez et poussez l'image (`docker build -t localhost:5000/...`, `docker push localhost:5000/...`) et assurez-vous que `image:` dans `deployment.yaml` pointe vers `localhost:5000/...`.
3.  **Appliquer les manifestes Kubernetes :**
    ```bash
    # Assurez-vous que le champ 'image:' dans deployment.yaml correspond à l'image construite (ex: exai-api-gateway:latest)
    # Assurez-vous que 'imagePullPolicy: IfNotPresent' ou 'Never' est défini si l'image est uniquement locale à Minikube
    kubectl apply -f deployment.yaml -n exai
    kubectl apply -f service.yaml -n exai
    ```
4.  **Vérifier le déploiement :**
    ```bash
    kubectl get pods -n exai
    kubectl get services -n exai
    ```
5.  **Revenir au répertoire racine :**
    ```bash
    cd ..
    ```
Répétez ces étapes pour tous les microservices nécessaires (`api-gateway`, `service-selection`, etc.).

### 7. Accéder aux Services

Voir la section [Accéder aux services via Minikube](#accéder-aux-services-via-minikube).

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

6. Obtenir l'URL du service :
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

## 🚀 Alternative : Lancer le Service Sélection avec Docker Compose

Cette section explique comment lancer le microservice `service-selection` et sa base de données PostgreSQL associée en utilisant Docker Compose. Cette méthode est **recommandée** car elle simplifie la configuration locale.

### Prérequis

- Docker et Docker Compose installés et fonctionnels.

### Étapes

1.  **Cloner le dépôt (si ce n'est pas déjà fait) :**
    ```bash
    git clone <URL_DU_REPO>
    cd <NOM_DU_REPO>/service-selection
    ```

2.  **Lancer les services avec Docker Compose :**
    ```bash
    docker-compose up --build
    ```
    - La commande `--build` assure que l'image Docker de l'API est reconstruite si le code ou le `Dockerfile` a changé.
    - Docker Compose va :
        - Télécharger l'image PostgreSQL.
        - Créer un conteneur pour la base de données (`selection_db`) avec les identifiants par défaut (`user`/`password`) et la base `exaidb`.
        - Créer un volume nommé `postgres_data` pour persister les données de la base.
        - Mapper le port `5433` de votre machine au port `5432` du conteneur PostgreSQL (pour éviter les conflits avec une instance PostgreSQL locale potentielle).
        - Construire l'image Docker pour l'API `service-selection`.
        - Créer un conteneur pour l'API (`selection_api`) et le lier au conteneur de la base de données.
        - Lancer l'API FastAPI avec `uvicorn` en mode `reload` sur le port `8081`.
        - Monter le répertoire courant (`.`) dans `/app` du conteneur API pour que les modifications du code soient prises en compte sans reconstruire l'image (utile pour le développement).

3.  **(Première fois uniquement) Initialiser la base de données :**
    - Ouvrez un **nouveau terminal**.
    - Exécutez la commande suivante pour créer les tables dans le conteneur de la base de données en exécutant le script `init_db.py` (ou un outil de migration comme Alembic) à l'intérieur du conteneur de l'API :
      ```bash
      docker-compose exec api python init_db.py 
      # Assurez-vous que init_db.py existe et contient le code pour créer les tables
      # Exemple de contenu pour init_db.py:
      # from database import engine, Base
      # Base.metadata.create_all(bind=engine)
      # print("Tables créées.")
      ```
      *Note : Si vous n'avez pas `init_db.py`, vous devrez le créer ou configurer Alembic.* 

4.  **Accéder à la documentation de l'API :**
    - L'API est maintenant accessible sur votre machine à l'adresse `http://localhost:8081`.
    - **Swagger UI :** [http://localhost:8081/docs](http://localhost:8081/docs)
    - **ReDoc :** [http://localhost:8081/redoc](http://localhost:8081/redoc)

5.  **Arrêter les services :**
    - Dans le terminal où `docker-compose up` est en cours d'exécution, appuyez sur `Ctrl+C`.
    - Pour supprimer les conteneurs et le réseau (mais pas le volume de données) :
      ```bash
      docker-compose down
      ```
    - Pour supprimer également le volume de données (attention, supprime toutes les données de la base !) :
      ```bash
      docker-compose down -v
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
