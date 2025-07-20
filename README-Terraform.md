# 🚀 Infrastructure Azure EXAI avec Terraform

Ce dossier contient l'Infrastructure as Code (IaC) pour déployer automatiquement la plateforme EXAI sur Azure en utilisant Terraform.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Prérequis](#prérequis)
- [Installation rapide](#installation-rapide)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [Gestion](#gestion)
- [Suppression](#suppression)
- [Dépannage](#dépannage)

## 🎯 Vue d'ensemble

Cette solution Terraform automatise complètement la création de :

### Infrastructure créée
- **🏗️ Groupe de ressources** Azure pour organiser toutes les ressources
- **☁️ Cluster AKS** (Azure Kubernetes Service) pour orchestrer les conteneurs
- **📦 Azure Container Registry** pour stocker les images Docker
- **💾 Compte de stockage Azure** avec containers pour les datasets, modèles et rapports
- **🌐 Réseau virtuel** avec sous-réseaux sécurisés
- **📊 Log Analytics & Application Insights** pour le monitoring
- **🔒 Rôles et permissions** configurés automatiquement

### Avantages

✅ **Zero configuration manuelle** - Tout est automatisé  
✅ **Reproductible** - Recréez l'infrastructure à l'identique  
✅ **Scalable** - Configuration adaptable selon vos besoins  
✅ **Sécurisé** - Bonnes pratiques Azure intégrées  
✅ **Économique** - Options d'optimisation des coûts  
✅ **Monitoré** - Monitoring et logs configurés  

## 🔧 Prérequis

### Outils requis

```bash
# 1. Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# 2. Terraform (version 1.0+)
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# 3. kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# 4. Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 5. jq (pour le traitement JSON)
sudo apt-get install jq
```

### Compte Azure

- Subscription Azure active
- Permissions **Contributor** ou **Owner** sur la subscription
- Quota suffisant pour créer les ressources (2 vCPUs minimum)

## ⚡ Installation rapide

### Option 1 : Script automatisé (Recommandé)

```bash
# Cloner le projet
git clone <votre-repo-exai>
cd exai

# Rendre le script exécutable
chmod +x scripts/deploy-to-azure.sh

# Lancer le déploiement automatique
./scripts/deploy-to-azure.sh
```

Le script va :
1. Vérifier tous les prérequis
2. Vous connecter à Azure
3. Créer le fichier de configuration
4. Déployer l'infrastructure
5. Construire et déployer l'application
6. Afficher l'URL finale

### Option 2 : Étape par étape

```bash
# 1. Se connecter à Azure
az login

# 2. Configurer Terraform
cd terraform/azure-infrastructure
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Modifier selon vos besoins

# 3. Initialiser et déployer
terraform init
terraform plan
terraform apply

# 4. Récupérer les informations
terraform output
```

## ⚙️ Configuration

### Fichier de configuration principal

Le fichier `terraform.tfvars` permet de personnaliser le déploiement :

```hcl
# Configuration de base
project_name = "exai"
environment  = "prod"
location     = "East US"

# Stockage
storage_replication_type = "LRS"  # LRS, GRS, RAGRS
enable_versioning       = true
soft_delete_retention_days = 7

# Kubernetes
kubernetes_version = "1.28"
aks_node_count    = 2
aks_node_vm_size  = "Standard_D2s_v3"

# Économies (pour environnements de test)
spot_instances_enabled = false
aks_node_vm_size      = "Standard_B2s"  # Plus économique
```

### Configurations prédéfinies

#### 🧪 Environnement de développement
```hcl
environment = "dev"
aks_node_count = 1
aks_node_vm_size = "Standard_B2s"
acr_sku = "Basic"
soft_delete_retention_days = 1
```

#### 🚀 Production haute disponibilité
```hcl
environment = "prod"
storage_replication_type = "GRS"
aks_node_count = 3
enable_auto_scaling = true
max_node_count = 10
acr_sku = "Premium"
enable_backup = true
```

#### 💰 Configuration économique
```hcl
environment = "staging"
aks_node_vm_size = "Standard_B2s"
spot_instances_enabled = true
log_analytics_retention_days = 30
```

## 🚀 Déploiement

### Déploiement complet automatisé

```bash
# Une seule commande pour tout déployer
./scripts/deploy-to-azure.sh
```

### Déploiement manuel étape par étape

```bash
# 1. Préparation
cd terraform/azure-infrastructure
terraform init

# 2. Planification (voir ce qui va être créé)
terraform plan

# 3. Application (créer l'infrastructure)
terraform apply

# 4. Récupérer les outputs
terraform output

# 5. Configurer kubectl
az aks get-credentials --resource-group $(terraform output -raw resource_group_name) --name $(terraform output -raw aks_cluster_name)

# 6. Déployer l'application EXAI
kubectl apply -k ../../k8s/overlays/azure/
```

### Informations de sortie

Après le déploiement, Terraform affiche toutes les informations importantes :

```bash
# Voir toutes les informations
terraform output

# Informations spécifiques
terraform output storage_account_name
terraform output public_ip_address
terraform output acr_login_server
```

## 🛠️ Gestion

### Commandes utiles

```bash
# État de l'infrastructure
terraform show

# Lister les ressources
terraform state list

# Mise à jour de l'infrastructure
terraform plan
terraform apply

# Import d'une ressource existante
terraform import azurerm_resource_group.main /subscriptions/.../resourceGroups/exai-prod-rg
```

### Monitoring et logs

```bash
# Logs des applications
kubectl logs -f deployment/api-gateway -n exai
kubectl logs -f deployment/service-selection -n exai

# État des pods
kubectl get pods -n exai

# Métriques Azure
az monitor metrics list --resource $(terraform output -raw aks_cluster_name)
```

### Mise à jour de l'application

```bash
# Reconstruire et redéployer
docker build -t $(terraform output -raw acr_login_server)/exai-api-gateway:latest api-gateway/
docker push $(terraform output -raw acr_login_server)/exai-api-gateway:latest

# Redémarrer les pods
kubectl rollout restart deployment/api-gateway -n exai
```

## 🗑️ Suppression

### ⚠️ ATTENTION : Suppression complète

```bash
# Script automatisé de suppression COMPLÈTE
./scripts/destroy-azure-infrastructure.sh
```

Le script de suppression :
1. Demande 3 confirmations pour éviter les erreurs
2. Nettoie les applications Kubernetes
3. Vide les comptes de stockage
4. Supprime les images Docker
5. Détruit toute l'infrastructure Azure
6. Nettoie les fichiers locaux

### Suppression manuelle

```bash
# Supprimer seulement l'application
kubectl delete -k k8s/overlays/azure/

# Supprimer l'infrastructure
cd terraform/azure-infrastructure
terraform destroy

# Supprimer un groupe de ressources spécifique
az group delete --name exai-prod-rg --yes --no-wait
```

## 🔧 Dépannage

### Problèmes courants

#### ❌ Erreur de quota Azure
```bash
# Vérifier les quotas disponibles
az vm list-usage --location "East US" --query "[?currentValue>=limit]"

# Solution : Changer la région ou demander une augmentation de quota
```

#### ❌ Erreur d'authentification
```bash
# Re-connexion à Azure
az logout
az login

# Vérifier les permissions
az role assignment list --assignee $(az account show --query user.name -o tsv)
```

#### ❌ Terraform state verrouillé
```bash
# Forcer le déverrouillage (DANGER)
terraform force-unlock <LOCK_ID>
```

#### ❌ Nom de ressource déjà pris
```bash
# Modifier le nom dans terraform.tfvars
project_name = "exai-uniquename"
```

### Logs de débogage

```bash
# Logs détaillés Terraform
export TF_LOG=DEBUG
terraform apply

# Logs Azure CLI
az config set core.only_show_errors=false
az config set logging.enable_log_file=true
```

### Nettoyage d'urgence

```bash
# Si Terraform ne répond plus, suppression manuelle
az group list --query "[?starts_with(name, 'exai-')]" --output table
az group delete --name <resource-group-name> --yes --no-wait
```

## 📊 Coûts estimés

### Configuration de base (2 nœuds)
- **AKS** : ~150€/mois
- **Stockage** : ~10€/mois
- **ACR** : ~5€/mois
- **Monitoring** : ~20€/mois
- **Total** : ~185€/mois

### Optimisation des coûts
- Utiliser `spot_instances_enabled = true` (-60%)
- Choisir `Standard_B2s` pour les VMs (-50%)
- Réduire `log_analytics_retention_days = 7` (-30%)

## 🆘 Support

### Ressources utiles
- [Documentation Terraform Azure](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Documentation AKS](https://docs.microsoft.com/en-us/azure/aks/)
- [Calculateur de coûts Azure](https://azure.microsoft.com/en-us/pricing/calculator/)

### Commandes de diagnostic
```bash
# Diagnostic complet de l'infrastructure
./scripts/diagnose-infrastructure.sh

# État détaillé des ressources
terraform show | grep -A 20 "resource_group"
kubectl get all -n exai
az resource list --resource-group $(terraform output -raw resource_group_name) --output table
```

---

## 🎉 Félicitations !

Votre infrastructure Azure EXAI est maintenant déployée automatiquement ! 

**Prochaines étapes :**
1. Accédez à votre application via l'IP publique
2. Surveillez les coûts dans le portail Azure  
3. Configurez des alertes de monitoring
4. Planifiez des sauvegardes régulières

**Plus jamais de configuration manuelle ! 🚀** 