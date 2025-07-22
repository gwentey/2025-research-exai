# 🚀 Guide de Déploiement IBIS-X - Script Production

Ce guide explique comment utiliser le script de déploiement pour la **production** et la gestion d'infrastructure. Pour le développement local, utilisez `make dev`.

## 🎯 Utilisation

### 🖥️ DÉVELOPPEMENT LOCAL
**Utilisez `make dev` - PAS ce script !**

```bash
# Développement local
make dev

# Développement local avec données
make dev-with-data
```

### 🏭 PRODUCTION
Deux options pour le déploiement production :

#### Option 1: GitHub Actions (Recommandé)
- **Infrastructure** : Existante 
- **Secrets** : Injectés automatiquement depuis GitHub Secrets
- **Images** : Tags versionnés avec SHA du commit
- **Frontend** : Build en mode `production`

#### Option 2: Script Manuel
- **Infrastructure** : Créée automatiquement si inexistante
- **Secrets** : Configuration manuelle requise
- **Images** : Tags `latest`
- **Frontend** : Build en mode `production`

## 🚀 Utilisation Détaillée

### 🏭 Option 1: GitHub Actions (Automatique)

**Push automatique :**
```bash
git checkout production
git merge main
git push origin production  # 🚀 Déploiement auto !
```

**Déclenchement manuel :**
- GitHub → Actions → "Deploy Production IBIS-X v2" → "Run workflow"

### 🛠️ Option 2: Script Manuel

**Déploiement simple :**
```bash
# Le script gère automatiquement l'infrastructure si nécessaire
./scripts/deploy-to-azure.sh
```

**Création d'infrastructure seulement :**
```bash
# Pour créer juste l'infrastructure sans déployer l'app
INFRASTRUCTURE_ONLY=true ./scripts/deploy-to-azure.sh
```

**Avec données d'exemple :**
```bash
# Déploiement + initialisation des datasets
WITH_DATA=true ./scripts/deploy-to-azure.sh
```

**Variables d'environnement personnalisées :**
```bash
# Utiliser votre propre ACR/AKS
AZURE_CONTAINER_REGISTRY=mon-acr \
AZURE_RESOURCE_GROUP=mon-rg \
AKS_CLUSTER_NAME=mon-aks \
./scripts/deploy-to-azure.sh
```

## ⚙️ Configuration

### 🔧 Variables d'Environnement

| Variable | GitHub Actions | Script Manuel | Description |
|----------|----------------|---------------|-------------|
| `GITHUB_ACTIONS` | `true` | `false` | Détection automatique |
| `WITH_DATA` | `true` | `false` | Initialisation des données |
| `IMAGE_TAG` | `SHA du commit` | `latest` | Tag des images Docker |
| `ANGULAR_ENV` | `production` | `production` | Mode build Angular |
| `AZURE_CONTAINER_REGISTRY` | `ibisprodacr` | `ibisprodacr` | Nom du registry |
| `AZURE_RESOURCE_GROUP` | `ibis-x-perso-rg` | `ibis-x-perso-rg` | Groupe de ressources |
| `AKS_CLUSTER_NAME` | `ibis-x-prod-aks` | `ibis-x-prod-aks` | Cluster Kubernetes |

### 🏗️ Infrastructure Azure

**Ressources par défaut :**
- **Resource Group** : `ibis-x-perso-rg`
- **ACR** : `ibisprodacr`
- **AKS** : `ibis-x-prod-aks`
- **Storage Account** : Généré automatiquement
- **PostgreSQL** : Déployé dans Kubernetes

## 🔐 Gestion des Secrets

### 🖥️ Mode Local
```bash
# Secrets créés automatiquement avec placeholders
gateway-secrets:
  - secret-key: dev-secret-key-12345
  - database-url: postgresql://postgres:postgres@postgresql-service:5432/ibis_x_dev
  - google-client-*: placeholder-*
  - oauth-redirect-url: http://localhost:4200/auth/callback

kaggle-secrets:
  - username: placeholder
  - key: placeholder

storage-secrets: (depuis Terraform/Azure)
  - azure-storage-account-name: [terraform]
  - azure-storage-account-key: [terraform]
```

### 🏭 Mode Production
```bash
# Secrets injectés par GitHub Actions depuis GitHub Secrets
gateway-secrets:
  - secret-key: ${{ secrets.JWT_SECRET_KEY }}
  - database-url: ${{ secrets.DATABASE_URL }}
  - google-client-id: ${{ secrets.GOOGLE_CLIENT_ID }}
  - google-client-secret: ${{ secrets.GOOGLE_CLIENT_SECRET }}
  - oauth-redirect-url: ${{ secrets.OAUTH_REDIRECT_URL }}

kaggle-secrets:
  - username: ${{ secrets.KAGGLE_USERNAME }}
  - key: ${{ secrets.KAGGLE_KEY }}

storage-secrets: (depuis Azure CLI)
  - Récupérés dynamiquement depuis le resource group
```

## 🏗️ Workflow de Build

### 📦 Images Docker

#### Mode Local
```bash
# Tags simples
ibisxprodacr1234.azurecr.io/ibis-x-api-gateway:latest
ibisxprodacr1234.azurecr.io/service-selection:latest
ibisxprodacr1234.azurecr.io/frontend:latest  # --build-arg ANGULAR_ENV=development
```

#### Mode Production
```bash
# Tags versionnés + latest
ibisprodacr.azurecr.io/ibis-x-api-gateway:abc1234
ibisprodacr.azurecr.io/ibis-x-api-gateway:latest
ibisprodacr.azurecr.io/service-selection:abc1234
ibisprodacr.azurecr.io/service-selection:latest
ibisprodacr.azurecr.io/frontend:abc1234       # --build-arg ANGULAR_ENV=production
ibisprodacr.azurecr.io/frontend:latest
```

## 🔄 Workflow Détaillé

### 🖥️ Workflow Local
1. ✅ Vérification des prérequis
2. ✅ Connexion Azure
3. ✅ Vérification versions Kubernetes
4. 🏗️ **Initialisation Terraform**
5. 🏗️ **Déploiement infrastructure**
6. 📊 Récupération outputs Terraform
7. ⚙️ Configuration kubectl
8. 🔐 Mise à jour secrets K8s
9. 🐳 Build & push images
10. 🔑 Création secrets
11. 🚀 Déploiement application
12. 🔧 Correction pods défaillants
13. 🗄️ Exécution migrations
14. ⏳ Attente migrations
15. 📊 Initialisation données (si activée)
16. 🔍 Vérifications finales

### 🏭 Workflow Production
1. ✅ Vérification des prérequis
2. ✅ Connexion Azure  
3. 📊 **Chargement variables d'environnement**
4. ⚙️ Configuration kubectl
5. 🐳 **Build & push images (tags versionnés)**
6. 🔑 **Application secrets depuis fichiers YAML**
7. 🚀 **Déploiement application (mode robuste)**
8. ⏳ **Attente migrations automatique**
9. 📊 **Initialisation données automatique**
10. 🔍 **Vérifications finales**
11. 🧹 **Nettoyage jobs migration**

## 🐛 Dépannage

### ❌ Erreurs Courantes

#### "ACR non trouvé"
```bash
# Mode local : vérifier Terraform
cd terraform/azure-infrastructure
terraform plan

# Mode production : vérifier variables GitHub Actions
echo $AZURE_CONTAINER_REGISTRY
```

#### "Secrets manquants"
```bash
# Vérifier les secrets K8s
kubectl get secrets -n ibis-x

# Mode production : vérifier GitHub Secrets
# GitHub → Settings → Secrets and variables → Actions
```

#### "Images non trouvées"
```bash
# Vérifier les images dans ACR
az acr repository list --name $ACR_NAME

# Vérifier les tags
az acr repository show-tags --name $ACR_NAME --repository ibis-x-api-gateway
```

### 🔍 Diagnostics

```bash
# Vérifier l'environnement détecté
echo "GitHub Actions: $GITHUB_ACTIONS"
echo "Mode: $DEPLOYMENT_MODE"

# Logs détaillés
kubectl logs -n ibis-x deployment/api-gateway
kubectl logs -n ibis-x deployment/service-selection

# État des ressources
kubectl get all -n ibis-x
kubectl describe pod [POD_NAME] -n ibis-x
```

## 📚 Références

- **Script principal** : `scripts/deploy-to-azure.sh`
- **Workflow GitHub Actions** : `.github/workflows/deploy-production-v2.yml`
- **Configuration Terraform** : `terraform/azure-infrastructure/`
- **Manifestes K8s** : `k8s/`

## 🎯 Commandes Utiles

```bash
# Déploiement local rapide
make dev

# Déploiement local avec données
WITH_DATA=true ./scripts/deploy-to-azure.sh

# Nettoyage complet
./scripts/destroy-azure-infrastructure.sh

# Vérification de l'application
kubectl get pods -n ibis-x
kubectl get ingress -n ibis-x

# Accès aux logs
kubectl logs -f deployment/api-gateway -n ibis-x
``` 