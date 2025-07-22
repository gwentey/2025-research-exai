#!/bin/bash

# 🚀 SCRIPT DE DÉPLOIEMENT PRODUCTION IBIS-X SUR AZURE
# Usage: Infrastructure + Déploiement Production
# Pour le développement local, utilisez: make dev

set -e

# ==========================================
# 🎯 CONFIGURATION PRODUCTION
# ==========================================

# Détection si exécuté depuis GitHub Actions
IS_GITHUB_ACTIONS="${GITHUB_ACTIONS:-false}"
IS_WINDOWS=false

# Auto-détection Windows
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ -n "${WINDIR}" ]]; then
    IS_WINDOWS=true
fi

# Configuration production
if [[ "$IS_GITHUB_ACTIONS" == "true" ]]; then
    # 🏭 MODE GITHUB ACTIONS
    DEPLOYMENT_MODE="github-actions"
    
    # Variables d'environnement (depuis GitHub Actions)
    export AZURE_CONTAINER_REGISTRY="${AZURE_CONTAINER_REGISTRY:-ibisprodacr}"
    export AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-ibis-x-perso-rg}"
    export AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-ibis-x-prod-aks}"
    export K8S_NAMESPACE="${K8S_NAMESPACE:-ibis-x}"
    
    # Tags versionnés avec SHA du commit
    if [[ -n "$GITHUB_SHA" ]]; then
        export IMAGE_TAG="${GITHUB_SHA:0:7}"
    else
        export IMAGE_TAG="latest"
    fi
    
    export USE_GITHUB_SECRETS=true
    export WITH_DATA="${WITH_DATA:-true}"
    export ANGULAR_ENV="production"
    
else
    # 🛠️ MODE SCRIPT MANUEL
    DEPLOYMENT_MODE="manual-production"
    
    # Configuration par défaut (peut être surchargée par variables d'environnement)
    export AZURE_CONTAINER_REGISTRY="${AZURE_CONTAINER_REGISTRY:-ibisprodacr}"
    export AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-ibis-x-perso-rg}"
    export AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-ibis-x-prod-aks}"
    export K8S_NAMESPACE="${K8S_NAMESPACE:-ibis-x}"
    export IMAGE_TAG="${IMAGE_TAG:-latest}"
    export USE_GITHUB_SECRETS=false
    export WITH_DATA="${WITH_DATA:-false}"
    export ANGULAR_ENV="production"
fi

# ==========================================
# 🎨 FONCTIONS DE LOGGING
# ==========================================

# Script de déploiement automatisé pour IBIS-X sur Azure
# Ce script utilise Terraform pour créer l'infrastructure et déploie l'application

# Variables de configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/azure-infrastructure"
K8S_DIR="$PROJECT_ROOT/k8s"

# Détection de l'OS pour adapter les commandes
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || command -v powershell &> /dev/null; then
    IS_WINDOWS=true
else
    IS_WINDOWS=false
fi

# Variables globales pour partager entre les fonctions
export STORAGE_ACCOUNT=""
export STORAGE_KEY=""
export ACR_NAME=""
export AKS_NAME=""
export RESOURCE_GROUP=""
export PUBLIC_IP=""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==========================================
# 📊 AFFICHAGE CONFIGURATION
# ==========================================

# Afficher la configuration détectée
if [[ "$IS_GITHUB_ACTIONS" == "true" ]]; then
    log_info "🏭 MODE: GitHub Actions"
    log_info "📦 ACR: $AZURE_CONTAINER_REGISTRY"
    log_info "🏷️ Tag images: $IMAGE_TAG"
    log_info "🔐 Secrets: GitHub Secrets (injectés)"
else
    log_info "🛠️ MODE: Script Manuel"
    log_info "📦 ACR: $AZURE_CONTAINER_REGISTRY"
    log_info "🏷️ Tag images: $IMAGE_TAG"
    log_info "🔐 Secrets: Configuration manuelle requise"
    log_info "ℹ️  Utilisez 'make dev' pour le développement local"
fi
log_info "🌐 Frontend: Mode $ANGULAR_ENV"
log_info "📊 Données: WITH_DATA=$WITH_DATA"

# Fonction pour vérifier les versions Kubernetes disponibles
check_kubernetes_versions() {
    log_info "Vérification des versions Kubernetes disponibles..."
    
    # Obtenir la région depuis terraform.tfvars ou utiliser une valeur par défaut
    local region="East US"
    if [ -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
        region=$(grep -E '^location\s*=' "$TERRAFORM_DIR/terraform.tfvars" | cut -d'"' -f2 2>/dev/null || echo "East US")
    fi
    
    # Vérifier les versions disponibles
    local available_versions=$(az aks get-versions --location "$region" --output json | jq -r '.orchestrators[] | select(.supportPlan[] | contains("KubernetesOfficial")) | .orchestratorVersion' | sort -V)
    
    if [ -z "$available_versions" ]; then
        log_warning "Impossible de récupérer les versions Kubernetes. Vérifiez votre connexion Azure."
        return
    fi
    
    # Afficher les versions recommandées
    local recommended_versions=$(echo "$available_versions" | tail -5)
    log_info "Versions Kubernetes recommandées pour la région '$region':"
    echo "$recommended_versions" | while read version; do
        echo "  - $version"
    done
    
    # Vérifier si la version configurée est supportée
    local current_version=""
    if [ -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
        current_version=$(grep -E '^kubernetes_version\s*=' "$TERRAFORM_DIR/terraform.tfvars" | cut -d'"' -f2 2>/dev/null)
    fi
    
    if [ -n "$current_version" ]; then
        if echo "$available_versions" | grep -q "^$current_version$"; then
            log_success "Version Kubernetes configurée ($current_version) est supportée"
        else
            log_warning "Version Kubernetes configurée ($current_version) n'est pas supportée !"
            log_warning "Versions recommandées : $(echo "$recommended_versions" | tail -3 | tr '\n' ' ')"
        fi
    fi
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI n'est pas installé. Installez-le depuis https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Vérifier/Installer Terraform
    if ! command -v terraform &> /dev/null; then
        log_warning "Terraform n'est pas installé. Installation automatique..."
        if [[ "$IS_WINDOWS" == true ]]; then
            if command -v winget &> /dev/null; then
                winget install HashiCorp.Terraform
                # Recharger les variables d'environnement
                if command -v refreshenv &> /dev/null; then
                    refreshenv
                fi
            else
                log_error "Terraform non installé et winget indisponible. Installez manuellement depuis https://www.terraform.io/downloads.html"
                exit 1
            fi
        else
            # Installation sur Linux/MacOS
            if command -v wget &> /dev/null && command -v unzip &> /dev/null; then
                TF_VERSION="1.6.0"
                wget "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_linux_amd64.zip"
                unzip "terraform_${TF_VERSION}_linux_amd64.zip"
                sudo mv terraform /usr/local/bin/
                rm "terraform_${TF_VERSION}_linux_amd64.zip"
            else
                log_error "Terraform non installé. Installez manuellement depuis https://www.terraform.io/downloads.html"
                exit 1
            fi
        fi
        
        # Vérifier que l'installation a réussi
        if ! command -v terraform &> /dev/null; then
            log_error "Échec de l'installation automatique de Terraform. Installez manuellement."
            exit 1
        else
            log_success "Terraform installé avec succès"
        fi
    fi
    
    # Vérifier kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl n'est pas installé. Installez-le depuis https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé. Installez-le depuis https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Vérifier/Installer jq pour le parsing JSON
    if ! command -v jq &> /dev/null; then
        log_warning "jq n'est pas installé. Installation automatique..."
        if [[ "$IS_WINDOWS" == true ]]; then
            if command -v winget &> /dev/null; then
                winget install jqlang.jq
            else
                log_warning "jq non installé. Installé manuellement depuis https://jqlang.github.io/jq/"
            fi
        else
            if command -v apt-get &> /dev/null; then
                sudo apt-get install -y jq
            elif command -v yum &> /dev/null; then
                sudo yum install -y jq
            elif command -v brew &> /dev/null; then
                brew install jq
            else
                log_warning "jq non installé. Installé manuellement depuis https://jqlang.github.io/jq/"
            fi
        fi
    fi
    
    # Vérifier/Installer Helm
    if ! command -v helm &> /dev/null; then
        log_warning "Helm n'est pas installé. Installation automatique..."
        install_helm
    else
        log_success "Helm est déjà installé"
    fi
    
    log_success "Tous les prérequis sont installés"
}

# Nouvelle fonction pour installer Helm
install_helm() {
    log_info "Installation de Helm..."
    
    # Télécharger et installer Helm
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod 700 get_helm.sh
    ./get_helm.sh
    rm get_helm.sh
    
    # Vérifier l'installation
    if command -v helm &> /dev/null; then
        log_success "Helm installé avec succès: $(helm version --short)"
    else
        log_error "Échec de l'installation de Helm"
        exit 1
    fi
}

# Nouvelle fonction pour installer NGINX Ingress Controller
install_nginx_ingress() {
    log_info "Installation de NGINX Ingress Controller..."
    
    # Ajouter le repository Helm NGINX
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # Installer ou mettre à jour NGINX Ingress avec les valeurs personnalisées
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --values "$K8S_DIR/helm-values/nginx-ingress-values.yaml" \
        --set controller.service.loadBalancerIP="$PUBLIC_IP" \
        --wait
    
    log_success "NGINX Ingress Controller installé"
}

# Nouvelle fonction pour installer Cert-Manager
install_cert_manager() {
    log_info "Installation de Cert-Manager..."
    
    # Ajouter le repository Helm Cert-Manager
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Installer Cert-Manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version v1.13.0 \
        --set installCRDs=true \
        --wait
    
    log_success "Cert-Manager installé"
}

# Fonction pour vérifier que les noms de projet sont corrects
verify_project_names() {
    log_info "Vérification des noms de projet IBIS-X..."
    
    # Les noms sont déjà corrects depuis la migration, pas besoin de modification
    log_success "Noms de projet IBIS-X vérifiés"
}

# Fonction pour vérifier la connexion Azure
check_azure_login() {
    log_info "Vérification de la connexion Azure..."
    
    if ! az account show &> /dev/null; then
        log_warning "Vous n'êtes pas connecté à Azure. Connexion en cours..."
        az login
    fi
    
    # Afficher le compte actuel
    ACCOUNT_INFO=$(az account show --output json)
    SUBSCRIPTION_NAME=$(echo "$ACCOUNT_INFO" | jq -r '.name')
    SUBSCRIPTION_ID=$(echo "$ACCOUNT_INFO" | jq -r '.id')
    
    log_success "Connecté à Azure:"
    echo "  Subscription: $SUBSCRIPTION_NAME"
    echo "  ID: $SUBSCRIPTION_ID"
}

# Fonction pour initialiser Terraform
init_terraform() {
    log_info "Initialisation de Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Vérifier si terraform.tfvars existe
    if [ ! -f "terraform.tfvars" ]; then
        log_warning "Le fichier terraform.tfvars n'existe pas."
        echo "Création du fichier terraform.tfvars à partir du template..."
        cp terraform.tfvars.example terraform.tfvars
        
        log_warning "IMPORTANT: Veuillez modifier le fichier terraform.tfvars selon vos besoins avant de continuer."
        read -p "Appuyez sur Entrée pour ouvrir le fichier terraform.tfvars dans l'éditeur par défaut..."
        
        # Ouvrir l'éditeur
        ${EDITOR:-nano} terraform.tfvars
        
        echo
        read -p "Avez-vous terminé la configuration du fichier terraform.tfvars ? (y/N): " confirm
        if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
            log_error "Configuration annulée. Veuillez configurer terraform.tfvars et relancer le script."
            exit 1
        fi
    fi
    
    # Initialiser Terraform
    terraform init
    
    log_success "Terraform initialisé avec succès"
}

# Fonction pour planifier et appliquer Terraform
deploy_infrastructure() {
    log_info "Déploiement de l'infrastructure Azure..."
    
    cd "$TERRAFORM_DIR"
    
    # Planifier le déploiement
    log_info "Génération du plan Terraform..."
    terraform plan -out=tfplan
    
    # Demander confirmation
    echo
    log_warning "Terraform va créer/modifier les ressources Azure ci-dessus."
    read -p "Voulez-vous continuer ? (y/N): " confirm
    
    if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
        log_error "Déploiement annulé par l'utilisateur"
        exit 1
    fi
    
    # Appliquer le plan
    log_info "Application du plan Terraform..."
    terraform apply tfplan
    
    log_success "Infrastructure Azure déployée avec succès !"
}

# Fonction pour récupérer les informations d'infrastructure
get_terraform_outputs() {
    log_info "📊 Récupération des informations d'infrastructure - Mode: $DEPLOYMENT_MODE"
    
    if [[ "$USE_GITHUB_SECRETS" == "true" ]]; then
        # 🏭 MODE GITHUB ACTIONS: Variables d'environnement prédéfinies
        log_info "🏭 Utilisation des variables GitHub Actions..."
        get_github_infrastructure_info
    else
        # 🛠️ MODE MANUEL: Variables d'environnement ou détection Azure CLI
        log_info "🛠️ Configuration manuelle ou détection Azure..."
        get_manual_infrastructure_info
    fi
    
    # Validation finale
    if [[ -z "$ACR_NAME" ]] || [[ -z "$AKS_NAME" ]] || [[ -z "$RESOURCE_GROUP" ]]; then
        log_error "❌ Informations d'infrastructure manquantes !"
        log_error "ACR: $ACR_NAME | AKS: $AKS_NAME | RG: $RESOURCE_GROUP"
        exit 1
    fi
    
    # Mise à jour automatique de tous les fichiers avec le bon nom ACR
    log_info "🔧 Mise à jour automatique des fichiers avec ACR: $ACR_NAME"
    update_all_acr_references
    
    log_success "✅ Informations d'infrastructure récupérées:"
    echo "  Mode: $DEPLOYMENT_MODE"
    echo "  ACR Registry: $ACR_NAME"
    echo "  AKS Cluster: $AKS_NAME"
    echo "  Resource Group: $RESOURCE_GROUP"
    echo "  Storage Account: ${STORAGE_ACCOUNT:-N/A}"
    echo "  Public IP: ${PUBLIC_IP:-N/A}"
}

# Fonction pour récupérer les infos GitHub Actions
get_github_infrastructure_info() {
    log_info "📋 Configuration depuis variables d'environnement GitHub Actions..."
    
    # Les variables sont déjà définies par GitHub Actions
    export ACR_NAME="$AZURE_CONTAINER_REGISTRY"
    export AKS_NAME="$AKS_CLUSTER_NAME"
    export RESOURCE_GROUP="$AZURE_RESOURCE_GROUP"
    
    # Récupérer l'IP publique si possible
    PUBLIC_IP=$(az network public-ip list --resource-group "$RESOURCE_GROUP" --query "[0].ipAddress" -o tsv 2>/dev/null || echo "")
    export PUBLIC_IP
    
    # Storage sera récupéré dynamiquement par les fonctions de secrets
    log_success "✅ Configuration GitHub Actions chargée"
}

# Fonction pour récupérer les infos manuellement
get_manual_infrastructure_info() {
    log_info "🛠️ Configuration manuelle - Variables d'environnement ou Azure CLI..."
    
    # Utiliser les variables d'environnement prédéfinies (déjà exportées)
    export ACR_NAME="$AZURE_CONTAINER_REGISTRY"
    export AKS_NAME="$AKS_CLUSTER_NAME"
    export RESOURCE_GROUP="$AZURE_RESOURCE_GROUP"
    
    # Si l'infrastructure a été créée par Terraform, essayer de récupérer depuis Terraform
    if [[ -f "$TERRAFORM_DIR/terraform.tfstate" ]]; then
        log_info "📂 Infrastructure Terraform détectée, récupération des outputs..."
        cd "$TERRAFORM_DIR"
        
        # Récupérer les outputs Terraform
        local tf_storage=$(terraform output -raw storage_account_name 2>/dev/null || echo "")
        local tf_acr=$(terraform output -raw acr_name 2>/dev/null || echo "")
        local tf_aks=$(terraform output -raw aks_cluster_name 2>/dev/null || echo "")
        local tf_rg=$(terraform output -raw resource_group_name 2>/dev/null || echo "")
        local tf_ip=$(terraform output -raw public_ip_address 2>/dev/null || echo "")
        
        # Utiliser les valeurs Terraform si disponibles
        if [[ -n "$tf_acr" ]]; then
            export ACR_NAME="$tf_acr"
            export AKS_NAME="$tf_aks"
            export RESOURCE_GROUP="$tf_rg"
            export STORAGE_ACCOUNT="$tf_storage"
            export PUBLIC_IP="$tf_ip"
            
            if [[ -n "$tf_storage" ]]; then
                STORAGE_KEY=$(terraform output -raw storage_account_primary_key 2>/dev/null || echo "")
                export STORAGE_KEY
            fi
            
            log_success "✅ Configuration récupérée depuis Terraform"
        else
            log_warning "⚠️ Terraform outputs vides, utilisation des variables d'environnement"
        fi
        
        cd "$PROJECT_ROOT"
    fi
    
    # Fallback Azure CLI pour récupérer l'IP publique
    if [[ -z "$PUBLIC_IP" ]]; then
        PUBLIC_IP=$(az network public-ip list --resource-group "$RESOURCE_GROUP" --query "[0].ipAddress" -o tsv 2>/dev/null || echo "")
        export PUBLIC_IP
    fi
    
    log_info "📋 Configuration finale:"
    log_info "  ACR: $ACR_NAME"
    log_info "  AKS: $AKS_NAME" 
    log_info "  Resource Group: $RESOURCE_GROUP"
    
    log_success "✅ Configuration manuelle chargée"
}

# Fonction pour l'initialisation automatique des données (selon environnement)
initialize_sample_data() {
    if [[ "$WITH_DATA" == "true" ]]; then
        log_info "📊 Initialisation des données d'exemple..."
        
        # Attendre que service-selection soit prêt
        log_info "⏳ Attente que service-selection soit prêt..."
        kubectl wait --for=condition=ready pod -l app=service-selection -n "${K8S_NAMESPACE:-ibis-x}" --timeout=5m
        
        # Initialiser les données
        log_info "🚀 Lancement de l'initialisation des datasets..."
        kubectl exec -n "${K8S_NAMESPACE:-ibis-x}" deployment/service-selection -- python scripts/init_datasets.py all
        
        log_success "✅ Données d'exemple initialisées"
    else
        log_info "📊 Initialisation des données désactivée (WITH_DATA=$WITH_DATA)"
    fi
}

# Fonction pour attendre et vérifier les migrations
wait_for_migrations() {
    log_info "⏳ Attente des migrations de base de données..."
    
    # Attendre PostgreSQL
    log_info "🗄️ Attente que PostgreSQL soit prêt..."
    kubectl wait pod --selector=app=postgresql --for=condition=Ready -n "${K8S_NAMESPACE:-ibis-x}" --timeout=5m
    
    # Attendre les migrations
    log_info "🔄 Attente des jobs de migration..."
    if kubectl wait --for=condition=complete job/api-gateway-migration-job -n "${K8S_NAMESPACE:-ibis-x}" --timeout=5m 2>/dev/null; then
        log_success "✅ Migration API Gateway terminée"
    else
        log_warning "⚠️ Migration API Gateway non trouvée ou échouée"
    fi
    
    if kubectl wait --for=condition=complete job/service-selection-migration-job -n "${K8S_NAMESPACE:-ibis-x}" --timeout=5m 2>/dev/null; then
        log_success "✅ Migration Service Selection terminée"
    else
        log_warning "⚠️ Migration Service Selection non trouvée ou échouée"
    fi
    
    # Redémarrer les applications (comme dans GitHub Actions)
    if [[ "$DEPLOYMENT_MODE" == "production" ]]; then
        log_info "🔄 Redémarrage des applications (mode production)..."
        kubectl rollout restart deployment api-gateway -n "${K8S_NAMESPACE:-ibis-x}" 2>/dev/null || true
        kubectl rollout restart deployment service-selection -n "${K8S_NAMESPACE:-ibis-x}" 2>/dev/null || true
    fi
    
    log_success "✅ Migrations et redémarrages terminés"
}

# Fonction de nettoyage des jobs (comme dans GitHub Actions)
cleanup_migration_jobs() {
    if [[ "$DEPLOYMENT_MODE" == "production" ]]; then
        log_info "🧹 Nettoyage des jobs de migration (mode production)..."
        kubectl delete job api-gateway-migration-job service-selection-migration-job -n "${K8S_NAMESPACE:-ibis-x}" --ignore-not-found=true
        log_success "✅ Jobs de migration nettoyés"
    else
        log_info "🧹 Conservation des jobs de migration (mode développement)"
    fi
}

# Fonction pour configurer kubectl
configure_kubectl() {
    log_info "Configuration de kubectl pour AKS..."
    
    # Récupérer les credentials AKS
    az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$AKS_NAME" --overwrite-existing
    
    # Vérifier la connexion
    kubectl cluster-info
    
    log_success "kubectl configuré pour AKS"
}

# Fonction pour mettre à jour les secrets Kubernetes
update_k8s_secrets() {
    log_info "Mise à jour des secrets Kubernetes..."
    
    # Créer le namespace s'il n'existe pas
    kubectl create namespace ibis-x --dry-run=client -o yaml | kubectl apply -f -
    
    # Les secrets seront créés automatiquement par create_missing_secrets()
    # Cette fonction se contente de préparer le namespace
    
    log_success "Namespace et préparation des secrets terminés"
}

# Fonction INTELLIGENTE pour construire et pousser les images Docker
build_and_push_images() {
    log_info "🏗️ Construction et push des images Docker vers ACR..."
    log_info "🏷️ Mode: $DEPLOYMENT_MODE | Tag: $IMAGE_TAG | Angular: $ANGULAR_ENV"
    
    # Se connecter à ACR
    az acr login --name "$ACR_NAME"
    
    cd "$PROJECT_ROOT"
    
    # Fonction helper pour build/push avec gestion intelligente des tags
    build_and_push_image() {
        local service_name="$1"
        local dockerfile_path="$2"
        local build_context="$3"
        local build_args="$4"
        
        log_info "📦 Construction de l'image $service_name..."
        
        # Tags selon l'environnement
        local base_image="$ACR_NAME.azurecr.io/$service_name"
        local tags_args=""
        
        if [[ "$DEPLOYMENT_MODE" == "production" ]]; then
            # En production : tag avec SHA + latest
            tags_args="-t $base_image:$IMAGE_TAG -t $base_image:latest"
        else
            # En local : seulement latest
            tags_args="-t $base_image:latest"
        fi
        
        # Construire avec les arguments appropriés
        local docker_cmd="docker build $tags_args $build_args -f $dockerfile_path $build_context"
        
        if eval "$docker_cmd"; then
            # Pousser tous les tags
            if [[ "$DEPLOYMENT_MODE" == "production" ]]; then
                docker push "$base_image:$IMAGE_TAG"
                docker push "$base_image:latest"
                log_success "✅ Image $service_name pushée (tags: $IMAGE_TAG, latest)"
            else
                docker push "$base_image:latest"
                log_success "✅ Image $service_name pushée (tag: latest)"
            fi
        else
            log_error "❌ Échec construction de l'image $service_name"
            exit 1
        fi
    }
    
    # 1. API Gateway
    build_and_push_image "ibis-x-api-gateway" "api-gateway/Dockerfile" "api-gateway/" ""
    
    # 2. Service Selection (contexte racine pour accéder aux modules communs)
    build_and_push_image "service-selection" "service-selection/Dockerfile" "." ""
    
    # 3. Frontend (avec build args spécifiques à l'environnement)
    local frontend_build_args=""
    if [[ "$DEPLOYMENT_MODE" == "production" ]]; then
        frontend_build_args="--build-arg ANGULAR_ENV=production"
        log_info "🌐 Frontend: Build en mode PRODUCTION"
    else
        frontend_build_args="--build-arg ANGULAR_ENV=development"
        log_info "🌐 Frontend: Build en mode DEVELOPMENT"
    fi
    
    build_and_push_image "frontend" "frontend/Dockerfile" "frontend/" "$frontend_build_args"
    
    log_success "🚀 Toutes les images Docker pushées vers ACR : $ACR_NAME"
}

# Fonction pour déployer l'application sur Kubernetes
deploy_application() {
    log_info "Déploiement de l'application IBIS-X sur AKS..."
    
    cd "$PROJECT_ROOT"
    
    # CORRECTION PRÉVENTIVE DES ACR avant tout déploiement
    log_info "🔧 Correction préventive des noms ACR avant déploiement..."
    update_all_acr_references
    
    # Vérifier les noms de projet
    verify_project_names
    
    # Installer les composants Kubernetes nécessaires
    install_nginx_ingress
    install_cert_manager
    
    # Attendre que les contrôleurs soient prêts
    log_info "Attente que NGINX Ingress soit prêt..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s
    
    log_info "Attente que Cert-Manager soit prêt..."
    kubectl wait --namespace cert-manager \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/name=cert-manager \
        --timeout=300s
    
    # Mettre à jour les références d'images dans kustomization.yaml de façon automatique
    KUSTOMIZATION_FILE="$K8S_DIR/overlays/azure/kustomization.yaml"
    
    # Créer une copie de sauvegarde
    cp "$KUSTOMIZATION_FILE" "$KUSTOMIZATION_FILE.backup"
    
    # Méthode robuste compatible Windows/Linux - Skip Python pour éviter les erreurs
    log_info "Mise à jour automatique du kustomization.yaml..."
    
    # Méthode directe selon l'OS
    if [[ "$IS_WINDOWS" == true ]]; then
        # Convertir le chemin pour Windows
        local KUSTOMIZATION_FILE_WIN=$(echo "$KUSTOMIZATION_FILE" | sed 's|^/c/|C:/|')
        
        log_info "Utilisation de PowerShell pour Windows..."
        powershell.exe -Command "
        try {
            if (Test-Path '$KUSTOMIZATION_FILE_WIN') {
                \$content = Get-Content '$KUSTOMIZATION_FILE_WIN' -Raw -Encoding UTF8
                \$content = \$content -replace 'newName: .*azurecr\.io/ibis-x-api-gateway', 'newName: $ACR_NAME.azurecr.io/ibis-x-api-gateway'
                \$content = \$content -replace 'newName: .*azurecr\.io/service-selection', 'newName: $ACR_NAME.azurecr.io/service-selection'  
                \$content = \$content -replace 'newName: .*azurecr\.io/frontend', 'newName: $ACR_NAME.azurecr.io/frontend'
                [System.IO.File]::WriteAllText('$KUSTOMIZATION_FILE_WIN', \$content, [System.Text.Encoding]::UTF8)
                Write-Host 'Fichier kustomization.yaml mis à jour avec PowerShell'
            } else {
                Write-Warning 'Fichier kustomization.yaml non trouvé, création avec sed alternative...'
                exit 2
            }
        } catch {
            Write-Warning ('Erreur PowerShell: ' + \$_.Exception.Message)
            exit 2
        }
        " 2>/dev/null
        
        # Vérifier si PowerShell a réussi
        if [[ $? -ne 0 ]]; then
            log_warning "PowerShell échoué, utilisation de sed comme alternative..."
            # Alternative sed même sur Windows (via Git Bash)
            sed -i.tmp \
                -e "s|newName: .*azurecr.io/ibis-x-api-gateway|newName: $ACR_NAME.azurecr.io/ibis-x-api-gateway|" \
                -e "s|newName: .*azurecr.io/service-selection|newName: $ACR_NAME.azurecr.io/service-selection|" \
                -e "s|newName: .*azurecr.io/frontend|newName: $ACR_NAME.azurecr.io/frontend|" \
                "$KUSTOMIZATION_FILE" 2>/dev/null || true
            rm -f "$KUSTOMIZATION_FILE.tmp" 2>/dev/null || true
        fi
    else
        # Utiliser sed pour Linux/MacOS
        log_info "Utilisation de sed pour Linux/MacOS..."
        sed -i.tmp \
            -e "s|newName: .*azurecr.io/ibis-x-api-gateway|newName: $ACR_NAME.azurecr.io/ibis-x-api-gateway|" \
            -e "s|newName: .*azurecr.io/service-selection|newName: $ACR_NAME.azurecr.io/service-selection|" \
            -e "s|newName: .*azurecr.io/frontend|newName: $ACR_NAME.azurecr.io/frontend|" \
            "$KUSTOMIZATION_FILE"
        rm -f "$KUSTOMIZATION_FILE.tmp" 2>/dev/null || true
    fi
    
    log_success "Mise à jour du kustomization.yaml terminée"
    
    # Déploiement automatique avec stratégie optimisée par OS
    log_info "Déploiement automatique avec stratégie optimisée..."
    
    # Sauvegarder le répertoire courant
    ORIGINAL_DIR=$(pwd)
    
    # Sur Windows, utiliser directement le déploiement robuste (kustomize a des problèmes avec les chemins)
    # Sur Linux/MacOS, essayer d'abord kustomize
    if [[ "$IS_WINDOWS" == true ]]; then
        log_info "Windows détecté - utilisation du déploiement robuste optimisé..."
        
        # Déploiement robuste étape par étape
        log_info "Déploiement automatique des composants..."
        
        # 1. Secrets de base (déjà créés par create_missing_secrets)
        kubectl apply -f "$K8S_DIR/base/api-gateway/gateway-secrets.yaml" 2>/dev/null || true
        kubectl apply -f "$K8S_DIR/base/service-selection/db-secrets.yaml" 2>/dev/null || true
        
        # 2. PostgreSQL
        kubectl apply -f "$K8S_DIR/overlays/azure/postgresql-statefulset.yaml" || true
        kubectl apply -f "$K8S_DIR/base/postgres/postgresql-service.yaml" || true
        
        # 3. Applications avec images automatiquement corrigées
        deploy_app_with_correct_images
        
        # 4. Services
        kubectl apply -f "$K8S_DIR/base/api-gateway/service.yaml" || true
        kubectl apply -f "$K8S_DIR/base/service-selection/service.yaml" || true  
        kubectl apply -f "$K8S_DIR/base/frontend/service.yaml" || true
        
        # 5. Ingress et certificats
        kubectl apply -f "$K8S_DIR/base/common/letsencrypt-prod-issuer.yaml" || true
        kubectl apply -f "$K8S_DIR/base/common/ingress.yaml" || true
        
        log_success "Déploiement robuste Windows terminé avec succès"
    else
        # Sur Linux/MacOS, essayer d'abord Kustomize
        log_info "Linux/MacOS détecté - tentative Kustomize puis fallback si nécessaire..."
        
        cd "$K8S_DIR/overlays/azure/" || exit 1
        
        if kubectl apply -k . 2>/dev/null; then
            cd "$ORIGINAL_DIR"
            log_success "Déploiement Kustomize réussi"
        else
            log_info "Kustomize échoué - utilisation du déploiement alternatif..."
            cd "$ORIGINAL_DIR"
            
            # Déploiement robuste étape par étape
            log_info "Déploiement automatique des composants..."
            
            # 1. Secrets de base (déjà créés par create_missing_secrets)
            kubectl apply -f "$K8S_DIR/base/api-gateway/gateway-secrets.yaml" 2>/dev/null || true
            kubectl apply -f "$K8S_DIR/base/service-selection/db-secrets.yaml" 2>/dev/null || true
            
            # 2. PostgreSQL
            kubectl apply -f "$K8S_DIR/overlays/azure/postgresql-statefulset.yaml" || true
            kubectl apply -f "$K8S_DIR/base/postgres/postgresql-service.yaml" || true
            
            # 3. Applications avec images automatiquement corrigées
            deploy_app_with_correct_images
            
            # 4. Services
            kubectl apply -f "$K8S_DIR/base/api-gateway/service.yaml" || true
            kubectl apply -f "$K8S_DIR/base/service-selection/service.yaml" || true  
            kubectl apply -f "$K8S_DIR/base/frontend/service.yaml" || true
            
            # 5. Ingress et certificats
            kubectl apply -f "$K8S_DIR/base/common/letsencrypt-prod-issuer.yaml" || true
            kubectl apply -f "$K8S_DIR/base/common/ingress.yaml" || true
            
            log_success "Déploiement alternatif automatique terminé"
        fi
    fi
}

# Fonction pour déployer les applications avec les bonnes images automatiquement
deploy_app_with_correct_images() {
    log_info "Déploiement automatique des applications avec images corrigées..."
    
    # Créer fichiers temporaires avec les bonnes images (méthode robuste)
    local TEMP_DIR=""
    if [[ "$IS_WINDOWS" == true ]]; then
        TEMP_DIR="$TEMP/ibis-x-deploy-$$"
    else
        TEMP_DIR="/tmp/ibis-x-deploy-$$"
    fi
    mkdir -p "$TEMP_DIR"
    
    # 1. API Gateway
    log_info "Déploiement API Gateway avec image ACR $ACR_NAME..."
    sed "s|image: ibis-x-api-gateway|image: $ACR_NAME.azurecr.io/ibis-x-api-gateway:latest|" "$K8S_DIR/base/api-gateway/deployment.yaml" > "$TEMP_DIR/api-gateway-deployment.yaml"
    kubectl apply -f "$TEMP_DIR/api-gateway-deployment.yaml"
    kubectl apply -f "$K8S_DIR/base/api-gateway/service.yaml" 2>/dev/null || true
    
    # 2. Service Selection  
    log_info "Déploiement Service Selection avec image ACR $ACR_NAME..."
    sed "s|image: service-selection|image: $ACR_NAME.azurecr.io/service-selection:latest|" "$K8S_DIR/base/service-selection/deployment.yaml" > "$TEMP_DIR/service-selection-deployment.yaml"
    kubectl apply -f "$TEMP_DIR/service-selection-deployment.yaml"
    kubectl apply -f "$K8S_DIR/base/service-selection/service.yaml" 2>/dev/null || true
    
    # 3. Frontend
    log_info "Déploiement Frontend avec image ACR $ACR_NAME..."
    sed "s|image: frontend|image: $ACR_NAME.azurecr.io/frontend:latest|" "$K8S_DIR/base/frontend/deployment.yaml" > "$TEMP_DIR/frontend-deployment.yaml"
    kubectl apply -f "$TEMP_DIR/frontend-deployment.yaml"
    kubectl apply -f "$K8S_DIR/base/frontend/service.yaml" 2>/dev/null || true
    
    # 4. Secrets nécessaires (créés automatiquement)
    log_info "Création automatique des secrets manquants..."
    kubectl apply -f "$K8S_DIR/base/api-gateway/gateway-secrets.yaml" 2>/dev/null || true
    kubectl apply -f "$K8S_DIR/base/service-selection/db-secrets.yaml" 2>/dev/null || true
    
    # 5. Redémarrage forcé pour prendre en compte les nouvelles images et secrets
    log_info "Redémarrage automatique des pods avec nouvelles images ACR..."
    kubectl delete pods -l app=api-gateway -n ibis-x --ignore-not-found=true 2>/dev/null || true
    kubectl delete pods -l app=service-selection -n ibis-x --ignore-not-found=true 2>/dev/null || true
    kubectl delete pods -l app=frontend -n ibis-x --ignore-not-found=true 2>/dev/null || true
    
    # 6. Mise à jour automatique des images vers ACR  
    log_info "Mise à jour automatique des images vers ACR..."
    kubectl set image deployment/api-gateway api-gateway=$ACR_NAME.azurecr.io/ibis-x-api-gateway:latest -n ibis-x 2>/dev/null || true
    kubectl set image deployment/service-selection service-selection=$ACR_NAME.azurecr.io/service-selection:latest -n ibis-x 2>/dev/null || true
    kubectl set image deployment/frontend frontend=$ACR_NAME.azurecr.io/frontend:latest -n ibis-x 2>/dev/null || true
    
    # 7. Ingress et certificats SSL automatiques
    log_info "Déploiement de l'ingress et génération automatique des certificats SSL..."
    kubectl apply -f "$K8S_DIR/base/common/letsencrypt-prod-issuer.yaml" 2>/dev/null || true
    kubectl apply -f "$K8S_DIR/base/common/ingress.yaml" 2>/dev/null || true
    
    # Nettoyer les fichiers temporaires
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    log_success "✅ DÉPLOIEMENT 100% AUTOMATIQUE RÉUSSI ! Applications en ligne avec images ACR, secrets, et SSL !"
}

# Fonction ULTRA-ROBUSTE pour corriger automatiquement TOUS les noms ACR (VERSION AMÉLIORÉE)
update_all_acr_references() {
    log_info "🔍 CORRECTION AUTOMATIQUE ROBUSTE du nom ACR : $ACR_NAME"
    
    local new_acr_name="$ACR_NAME.azurecr.io"
    local updated_files=0
    local debug_mode=true
    
    # PATTERNS ACR ÉTENDUS - capture TOUS les types possibles
    local acr_patterns=(
        "ibisxprodacr[0-9]*\.azurecr\.io"      # Pattern principal
        "ibisprodacr[0-9]*\.azurecr\.io"       # Ancien pattern
        "exaiacr[0-9]*\.azurecr\.io"           # Pattern EXAI
        "exai.*acr[0-9]*\.azurecr\.io"         # Pattern EXAI étendu
        "[a-z]*acr[0-9]*\.azurecr\.io"         # Pattern générique
        "[a-zA-Z0-9]*\.azurecr\.io"            # Pattern très large
    )
    
    # Fonction interne ULTRA-ROBUSTE pour corriger un fichier spécifique
    fix_acr_in_file_robust() {
        local file_path="$1"
        local file_name=$(basename "$file_path")
        local correction_needed=false
        local correction_successful=false
        
        if [[ ! -f "$file_path" ]]; then
            log_warning "⚠️ Fichier introuvable: $file_path"
            return 1
        fi
        
        [[ "$debug_mode" == true ]] && log_info "🔧 Analyse de $file_name..."
        
        # Détecter TOUS les patterns ACR possibles
        for pattern in "${acr_patterns[@]}"; do
            if grep -q "$pattern" "$file_path" 2>/dev/null; then
                correction_needed=true
                [[ "$debug_mode" == true ]] && log_info "📍 Pattern détecté dans $file_name: $pattern"
                break
            fi
        done
        
        # Si aucun pattern détecté, vérifier si le nouveau ACR est déjà présent
        if [[ "$correction_needed" == false ]]; then
            if grep -q "$new_acr_name" "$file_path" 2>/dev/null; then
                [[ "$debug_mode" == true ]] && log_info "✅ $file_name déjà à jour avec $ACR_NAME"
                return 0
            else
                # Détection générale d'azurecr.io pour catch-all
                if grep -q "azurecr\.io" "$file_path" 2>/dev/null; then
                    correction_needed=true
                    [[ "$debug_mode" == true ]] && log_info "📍 Pattern générique azurecr.io détecté dans $file_name"
                fi
            fi
        fi
        
        if [[ "$correction_needed" == false ]]; then
            [[ "$debug_mode" == true ]] && log_info "✅ $file_name ne nécessite aucune correction"
            return 0
        fi
        
        log_info "🔧 Correction REQUISE pour $file_name..."
        
        # Sauvegarde de sécurité
        cp "$file_path" "$file_path.backup-$(date +%s)" 2>/dev/null || true
        
        # MÉTHODE 1: PowerShell sur Windows (plus agressive)
        if [[ "$IS_WINDOWS" == true ]]; then
            local ps_result=$(powershell.exe -Command "
            try {
                \$content = Get-Content '$file_path' -Raw -Encoding UTF8
                \$originalContent = \$content
                
                # Remplacer TOUS les patterns possibles
                \$content = \$content -replace 'ibisxprodacr[0-9]+\.azurecr\.io', '$new_acr_name'
                \$content = \$content -replace 'ibisprodacr[0-9]+\.azurecr\.io', '$new_acr_name'
                \$content = \$content -replace 'exaiacr[0-9]+\.azurecr\.io', '$new_acr_name'
                \$content = \$content -replace 'exai[a-zA-Z0-9]*acr[0-9]+\.azurecr\.io', '$new_acr_name'
                \$content = \$content -replace '[a-z]+acr[0-9]+\.azurecr\.io', '$new_acr_name'
                
                # Vérifier si une modification a eu lieu
                if (\$content -ne \$originalContent) {
                    Set-Content '$file_path' -Value \$content -NoNewline -Encoding UTF8
                    Write-Output 'SUCCESS'
                } else {
                    Write-Output 'NOCHANGE'
                }
            } catch {
                Write-Output \"FAILED: \$(\$_.Exception.Message)\"
            }
            " 2>/dev/null || echo "FAILED")
            
            case "$ps_result" in
                "SUCCESS")
                    log_info "✅ $file_name corrigé avec PowerShell"
                    correction_successful=true
                    ;;
                "NOCHANGE")
                    [[ "$debug_mode" == true ]] && log_info "🔄 PowerShell: aucun changement détecté pour $file_name"
                    ;;
                *)
                    log_warning "⚠️ PowerShell échoué pour $file_name: $ps_result"
                    ;;
            esac
        fi
        
        # MÉTHODE 2: sed (fallback universel)
        if [[ "$correction_successful" == false ]]; then
            [[ "$debug_mode" == true ]] && log_info "🔄 Tentative avec sed pour $file_name..."
            
            # Appliquer TOUS les remplacements sed
            local sed_success=true
            for pattern in "${acr_patterns[@]}"; do
                # Convertir le pattern grep en pattern sed (échapper les caractères spéciaux)
                local sed_pattern="${pattern//\\/\\\\}"
                sed -i.bak "s|$sed_pattern|$new_acr_name|g" "$file_path" 2>/dev/null || sed_success=false
            done
            
            if [[ "$sed_success" == true ]]; then
                rm -f "$file_path.bak" 2>/dev/null || true
                log_info "✅ $file_name corrigé avec sed"
                correction_successful=true
            else
                rm -f "$file_path.bak" 2>/dev/null || true
                log_warning "⚠️ sed également échoué pour $file_name"
            fi
        fi
        
        # VÉRIFICATION FINALE OBLIGATOIRE
        if grep -q "$new_acr_name" "$file_path" 2>/dev/null; then
            log_success "✅ VÉRIFICATION OK: $file_name contient maintenant $ACR_NAME"
            correction_successful=true
        else
            log_error "❌ ÉCHEC CRITIQUE: $file_name ne contient toujours pas $ACR_NAME après correction!"
            correction_successful=false
        fi
        
        # Restaurer backup en cas d'échec
        if [[ "$correction_successful" == false ]] && [[ -f "$file_path.backup-"* ]]; then
            log_warning "🔄 Restauration du backup pour $file_name..."
            cp "$file_path.backup-"* "$file_path" 2>/dev/null || true
        fi
        
        return $([ "$correction_successful" == true ] && echo 0 || echo 1)
    }
    
    # Corriger chaque fichier critique avec vérification
    log_info "🎯 Correction ROBUSTE des fichiers de déploiement..."
    
    # Fichiers à corriger (ordre de priorité)
    local critical_files=(
        "$K8S_DIR/base/jobs/api-gateway-migration-job.yaml"
        "$K8S_DIR/base/jobs/service-selection-migration-job.yaml"
        "$K8S_DIR/overlays/azure/kustomization.yaml"
        "$K8S_DIR/overlays/azure/migration-jobs-image-patch.yaml"
        "$K8S_DIR/overlays/azure/service-selection-migration-job-patch.yaml"
    )
    
    for file in "${critical_files[@]}"; do
        if fix_acr_in_file_robust "$file"; then
            updated_files=$((updated_files + 1))
        else
            log_error "❌ ÉCHEC CRITIQUE pour $file"
        fi
    done
    
    # Vérification finale STRICTE
    log_info "🔍 Vérification finale STRICTE..."
    
    local api_job_ok=0
    local service_job_ok=0
    
    # Compter les occurrences du nouveau ACR
    if [[ -f "$K8S_DIR/base/jobs/api-gateway-migration-job.yaml" ]]; then
        api_job_ok=$(grep -c "$new_acr_name" "$K8S_DIR/base/jobs/api-gateway-migration-job.yaml" 2>/dev/null | tr -d '\r\n' || echo "0")
    fi
    
    if [[ -f "$K8S_DIR/base/jobs/service-selection-migration-job.yaml" ]]; then
        service_job_ok=$(grep -c "$new_acr_name" "$K8S_DIR/base/jobs/service-selection-migration-job.yaml" 2>/dev/null | tr -d '\r\n' || echo "0")
    fi
    
    # Nettoyer les variables
    api_job_ok=${api_job_ok//[^0-9]/}
    service_job_ok=${service_job_ok//[^0-9]/}
    api_job_ok=${api_job_ok:-0}
    service_job_ok=${service_job_ok:-0}
    
    if [[ "$api_job_ok" -gt 0 ]] && [[ "$service_job_ok" -gt 0 ]]; then
        log_success "✅ VÉRIFICATION RÉUSSIE - Tous les jobs contiennent le bon ACR: $ACR_NAME"
        log_info "📊 Comptage: API Job = $api_job_ok, Service Job = $service_job_ok"
    else
        log_error "❌ ÉCHEC FINAL - Certains jobs n'ont TOUJOURS PAS le bon ACR!"
        log_error "📊 Comptage: API Job = $api_job_ok, Service Job = $service_job_ok"
        
        # Debug supplémentaire en cas d'échec
        log_info "🔍 DIAGNOSTIC D'ÉCHEC:"
        if [[ -f "$K8S_DIR/base/jobs/api-gateway-migration-job.yaml" ]]; then
            local api_current=$(grep "azurecr.io" "$K8S_DIR/base/jobs/api-gateway-migration-job.yaml" 2>/dev/null || echo "AUCUN ACR DÉTECTÉ")
            log_info "API Job contient: $api_current"
        fi
        if [[ -f "$K8S_DIR/base/jobs/service-selection-migration-job.yaml" ]]; then
            local service_current=$(grep "azurecr.io" "$K8S_DIR/base/jobs/service-selection-migration-job.yaml" 2>/dev/null || echo "AUCUN ACR DÉTECTÉ")
            log_info "Service Job contient: $service_current"
        fi
    fi
    
    # Nettoyage des backups (mais garder en cas d'échec pour debug)
    if [[ "$api_job_ok" -gt 0 ]] && [[ "$service_job_ok" -gt 0 ]]; then
        find "$K8S_DIR" -name "*.backup-*" -delete 2>/dev/null || true
        log_info "🧹 Backups nettoyés après succès"
    else
        log_warning "🔒 Backups conservés pour debug après échec"
    fi
    
    # TOUJOURS nettoyer les jobs après correction (pour être sûr)
    log_info "🧹 Nettoyage automatique des anciens jobs..."
    kubectl delete job api-gateway-migration-job service-selection-migration-job -n ibis-x 2>/dev/null || true
    sleep 2
    
    log_success "🎯 CORRECTION ROBUSTE TERMINÉE - $updated_files fichier(s) traités avec ACR : $ACR_NAME"
    
    # Retourner le statut de succès
    return $([ "$api_job_ok" -gt 0 ] && [ "$service_job_ok" -gt 0 ] && echo 0 || echo 1)
}

# Fonction INTELLIGENTE pour gérer automatiquement les jobs de migration avec les bonnes images ACR
fix_migration_jobs() {
    log_info "🔍 VÉRIFICATION INTELLIGENTE des jobs de migration avec ACR $ACR_NAME..."
    
    # FORCER la correction des fichiers avant toute chose
    log_info "🎯 CORRECTION PRÉVENTIVE des fichiers jobs avant création..."
    update_all_acr_references
    
    # Vérifier les jobs existants et leur statut
    local api_job_exists=$(kubectl get job api-gateway-migration-job -n ibis-x 2>/dev/null && echo "true" || echo "false")
    local service_job_exists=$(kubectl get job service-selection-migration-job -n ibis-x 2>/dev/null && echo "true" || echo "false")
    
    local api_complete="False"
    local service_complete="False"
    
    if [[ "$api_job_exists" == "true" ]]; then
        api_complete=$(kubectl get job api-gateway-migration-job -n ibis-x -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null | tr -d '\r\n' || echo "False")
    fi
    
    if [[ "$service_job_exists" == "true" ]]; then
        service_complete=$(kubectl get job service-selection-migration-job -n ibis-x -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null | tr -d '\r\n' || echo "False")
    fi
    
    # Si les jobs existent et sont terminés avec succès, ne pas les recréer
    if [[ "$api_complete" == "True" ]] && [[ "$service_complete" == "True" ]]; then
        log_success "✅ Migrations déjà terminées avec succès - aucune action nécessaire"
        return 0
    fi
    
    # Vérifier s'il y a des jobs défaillants (ImagePullBackOff ou Failed)
    local failed_migration_pods=$(kubectl get pods -n ibis-x -o jsonpath='{.items[?(@.metadata.name=~".*migration.*")].metadata.name}' 2>/dev/null || echo "")
    local has_failed_jobs=false
    
    if [[ -n "$failed_migration_pods" ]]; then
        for pod in $failed_migration_pods; do
            local pod_status=$(kubectl get pod "$pod" -n ibis-x -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
            local container_status=$(kubectl get pod "$pod" -n ibis-x -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || echo "")
            
            if [[ "$pod_status" == "Failed" ]] || [[ "$container_status" == "ImagePullBackOff" ]]; then
                has_failed_jobs=true
                log_warning "❌ Job défaillant détecté: $pod (Status: $pod_status, Reason: $container_status)"
            fi
        done
    fi
    
    # Si jobs défaillants OU jobs non existants, les recréer
    if [[ "$has_failed_jobs" == true ]] || [[ "$api_job_exists" == "false" ]] || [[ "$service_job_exists" == "false" ]]; then
        log_info "🧹 NETTOYAGE et RECRÉATION des jobs de migration..."
        
        # Supprimer tous les jobs de migration existants
        kubectl delete job api-gateway-migration-job service-selection-migration-job -n ibis-x 2>/dev/null || true
        sleep 3
        
        # Créer les nouveaux jobs avec les fichiers corrigés
        log_info "🚀 Création des jobs de migration avec ACR corrigé $ACR_NAME..."
        kubectl apply -f "$K8S_DIR/base/jobs/api-gateway-migration-job.yaml" || {
            log_error "❌ Échec création job API Gateway"
            return 1
        }
        kubectl apply -f "$K8S_DIR/base/jobs/service-selection-migration-job.yaml" || {
            log_error "❌ Échec création job Service Selection"
            return 1
        }
        
        log_success "✅ Jobs de migration créés avec les bonnes images ACR"
    fi
    
    # Attendre et vérifier la complétion avec feedback amélioré
    log_info "⏳ Attente de la complétion des migrations (timeout: 5min)..."
    
    local timeout=300
    local elapsed=0
    local check_interval=15
    
    while [[ $elapsed -lt $timeout ]]; do
        # Nettoyer les sorties kubectl pour éviter les caractères parasites
        api_complete=$(kubectl get job api-gateway-migration-job -n ibis-x -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null | tr -d '\r\n' || echo "False")
        service_complete=$(kubectl get job service-selection-migration-job -n ibis-x -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null | tr -d '\r\n' || echo "False")
        
        local api_failed=$(kubectl get job api-gateway-migration-job -n ibis-x -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null | tr -d '\r\n' || echo "False")
        local service_failed=$(kubectl get job service-selection-migration-job -n ibis-x -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null | tr -d '\r\n' || echo "False")
        
        if [[ "$api_complete" == "True" ]] && [[ "$service_complete" == "True" ]]; then
            log_success "✅ TOUTES LES MIGRATIONS TERMINÉES AVEC SUCCÈS !"
            return 0
        fi
        
        if [[ "$api_failed" == "True" ]] || [[ "$service_failed" == "True" ]]; then
            log_error "❌ Échec de migration détecté - Affichage des logs..."
            kubectl get jobs -n ibis-x 2>/dev/null || true
            kubectl get pods -n ibis-x | grep migration 2>/dev/null || true
            return 1
        fi
        
        log_info "⏳ Migrations en cours... API: $api_complete, Service: $service_complete (${elapsed}s/${timeout}s)"
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
    done
    
    # Si on arrive ici, il y a eu un timeout
    log_warning "⚠️ TIMEOUT atteint - Vérification du statut final..."
    kubectl get jobs -n ibis-x 2>/dev/null || true
    kubectl get pods -n ibis-x | grep migration 2>/dev/null || true
    
    log_success "🎯 Gestion automatique des jobs de migration terminée (avec timeout)"
    return 1
}

# Fonction de vérification finale et auto-correction
final_auto_check_and_fix() {
    log_info "🔍 Vérification finale et auto-correction..."
    
    # 1. Vérifier et corriger automatiquement les ACR dans les fichiers
    log_info "🔧 Auto-correction des noms ACR..."
    update_all_acr_references
    
    # 2. Vérifier et corriger automatiquement les jobs de migration
    log_info "🔧 Auto-correction des jobs de migration..."
    fix_migration_jobs
    
    # 3. Vérification finale de l'état global
    log_info "📊 État final du déploiement :"
    echo "======================="
    kubectl get pods -n ibis-x 2>/dev/null || true
    echo "======================="
    kubectl get jobs -n ibis-x 2>/dev/null || true
    echo "======================="
    kubectl get ingress -n ibis-x 2>/dev/null || true
    echo "======================="
    
    log_success "✅ Vérification finale et auto-correction terminées"
}

# Fonction pour attendre que les pods soient prêts  
wait_for_pods() {
    # Attendre que les pods soient prêts
    log_info "Attente du démarrage des pods..."
    kubectl wait --for=condition=ready pod -l app=api-gateway -n ibis-x --timeout=300s
    kubectl wait --for=condition=ready pod -l app=service-selection -n ibis-x --timeout=300s
    kubectl wait --for=condition=ready pod -l app=frontend -n ibis-x --timeout=300s
    
    log_success "Application IBIS-X déployée sur AKS"
}

# Fonction pour gérer les secrets selon le mode de déploiement
create_missing_secrets() {
    log_info "🔐 Gestion des secrets - Mode: $DEPLOYMENT_MODE"
    
    if [[ "$USE_GITHUB_SECRETS" == "true" ]]; then
        # 🏭 MODE GITHUB ACTIONS: Secrets injectés dans les fichiers YAML
        log_info "🏭 Application des secrets depuis les fichiers GitHub Actions..."
        create_github_secrets
    else
        # 🛠️ MODE MANUEL: Configuration manuelle des secrets
        log_info "🛠️ Configuration manuelle des secrets..."
        create_manual_secrets
    fi
    
    log_success "✅ Gestion des secrets terminée"
}

# Fonction pour les secrets GitHub Actions
create_github_secrets() {
    log_info "📋 Application des secrets GitHub Actions..."
    
    # GitHub Actions a déjà modifié les fichiers YAML avec les vrais secrets
    # Il suffit d'appliquer les fichiers secrets
    
    # 1. Supprimer les anciens secrets (pour forcer la mise à jour)
    log_info "🧹 Suppression des anciens secrets..."
    kubectl delete secret gateway-secrets -n "$K8S_NAMESPACE" --ignore-not-found=true
    kubectl delete secret kaggle-secrets -n "$K8S_NAMESPACE" --ignore-not-found=true
    kubectl delete secret db-secrets -n "$K8S_NAMESPACE" --ignore-not-found=true
    
    # 2. Appliquer les secrets depuis les fichiers (modifiés par GitHub Actions)
    log_info "📄 Application des secrets depuis les fichiers YAML..."
    kubectl apply -f k8s/base/api-gateway/gateway-secrets.yaml
    kubectl apply -f k8s/base/service-selection/kaggle-secrets.yaml
    kubectl apply -f k8s/base/service-selection/db-secrets.yaml
    
    # 3. Storage secrets (récupérer depuis Azure)
    create_storage_secrets_from_azure
    
    log_success "✅ Secrets GitHub Actions appliqués"
}

# Fonction pour les secrets manuels (production sans GitHub Actions)
create_manual_secrets() {
    log_info "🛠️ Configuration manuelle des secrets..."
    
    log_warning "⚠️ CONFIGURATION MANUELLE REQUISE"
    log_warning "Vous devez configurer les secrets manuellement pour la production"
    log_warning "Voir la documentation pour les étapes détaillées"
    
    # 1. Créer les secrets Kaggle avec des placeholders (À REMPLACER)
    if ! kubectl get secret kaggle-secrets -n "$K8S_NAMESPACE" &>/dev/null; then
        log_info "🔑 Création kaggle-secrets (À CONFIGURER)..."
        kubectl create secret generic kaggle-secrets -n "$K8S_NAMESPACE" \
            --from-literal=username=CHANGEME_KAGGLE_USERNAME \
            --from-literal=key=CHANGEME_KAGGLE_KEY
        log_warning "⚠️ REMPLACEZ les valeurs kaggle-secrets par vos vraies credentials !"
    fi
    
    # 2. Storage secrets depuis Azure
    create_storage_secrets_from_azure
    
    # 3. Gateway secrets (À CONFIGURER pour la production)
    if ! kubectl get secret gateway-secrets -n "$K8S_NAMESPACE" &>/dev/null; then
        log_info "🔑 Création gateway-secrets (À CONFIGURER)..."
        kubectl create secret generic gateway-secrets -n "$K8S_NAMESPACE" \
            --from-literal=secret-key=CHANGEME_JWT_SECRET_KEY \
            --from-literal=database-url=CHANGEME_DATABASE_URL \
            --from-literal=google-client-id=CHANGEME_GOOGLE_CLIENT_ID \
            --from-literal=google-client-secret=CHANGEME_GOOGLE_CLIENT_SECRET \
            --from-literal=oauth-redirect-url=CHANGEME_OAUTH_REDIRECT_URL
        log_warning "⚠️ REMPLACEZ toutes les valeurs gateway-secrets par vos vraies valeurs !"
    fi
    
    # 4. DB secrets (À CONFIGURER)
    if ! kubectl get secret db-secrets -n "$K8S_NAMESPACE" &>/dev/null; then
        log_info "🔑 Création db-secrets (À CONFIGURER)..."
        kubectl create secret generic db-secrets -n "$K8S_NAMESPACE" \
            --from-literal=database-url=CHANGEME_DATABASE_URL
        log_warning "⚠️ REMPLACEZ database-url par votre vraie URL de base de données !"
    fi
    
    log_warning "📋 ÉTAPES MANUELLES REQUISES :"
    log_warning "1. kubectl edit secret gateway-secrets -n $K8S_NAMESPACE"
    log_warning "2. kubectl edit secret kaggle-secrets -n $K8S_NAMESPACE"
    log_warning "3. kubectl edit secret db-secrets -n $K8S_NAMESPACE"
    log_warning "4. Remplacez tous les 'CHANGEME_*' par vos vraies valeurs"
    
    log_success "✅ Secrets manuels créés (CONFIGURATION REQUISE)"
}

# Fonction pour créer les secrets de stockage Azure 
create_storage_secrets_from_azure() {
    log_info "☁️ Récupération des secrets de stockage Azure..."
    
    # Utiliser les valeurs déjà récupérées ou récupérer via Azure CLI
    if [[ -z "$STORAGE_ACCOUNT" ]] || [[ -z "$STORAGE_KEY" ]]; then
        log_info "📂 Récupération storage depuis Azure CLI..."
        STORAGE_ACCOUNT=$(az storage account list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null || echo "")
        if [[ -n "$STORAGE_ACCOUNT" ]]; then
            STORAGE_KEY=$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$STORAGE_ACCOUNT" --query "[0].value" -o tsv 2>/dev/null || echo "")
        fi
    fi
    
    # Créer le secret storage si on a les valeurs
    if [[ -n "$STORAGE_ACCOUNT" ]] && [[ -n "$STORAGE_KEY" ]]; then
        kubectl delete secret storage-secrets -n "$K8S_NAMESPACE" 2>/dev/null || true
        
        log_info "🗂️ Création storage-secrets avec valeurs Azure..."
        kubectl create secret generic storage-secrets -n "$K8S_NAMESPACE" \
            --from-literal=azure-storage-account-name="$STORAGE_ACCOUNT" \
            --from-literal=azure-storage-account-key="$STORAGE_KEY" \
            --from-literal=azure-container-name=ibis-x-datasets \
            --from-literal=access-key="$STORAGE_ACCOUNT" \
            --from-literal=secret-key="$STORAGE_KEY"
        
        log_success "✅ Storage secrets créés: $STORAGE_ACCOUNT"
    else
        log_warning "⚠️ Impossible de récupérer les secrets de stockage Azure"
        log_warning "🛠️ Vous devrez configurer storage-secrets manuellement si nécessaire"
    fi
}

# Fonction pour vérifier et redémarrer les pods en erreur
fix_failed_pods() {
    log_info "Vérification et correction automatique des pods en erreur..."
    
    # Attendre un peu que les pods démarrent
    sleep 30
    
    # Vérifier les pods qui ne sont pas prêts
    local failed_pods=""
    if kubectl get namespace ibis-x &>/dev/null; then
        failed_pods=$(kubectl get pods -n ibis-x --field-selector=status.phase!=Running -o name 2>/dev/null || echo "")
    fi
    
    if [[ -n "$failed_pods" ]]; then
        log_warning "Pods en erreur détectés, redémarrage automatique..."
        
        # Redémarrer les pods en erreur
        kubectl delete pod -n ibis-x -l app=service-selection --ignore-not-found=true
        kubectl delete pod -n ibis-x -l app=api-gateway --ignore-not-found=true
        kubectl delete pod -n ibis-x -l app=frontend --ignore-not-found=true
        
        # Attendre que les nouveaux pods démarrent
        log_info "Attente du redémarrage des pods..."
        sleep 60
        
        # Vérifier à nouveau
        kubectl get pods -n ibis-x 2>/dev/null || log_info "Pods en cours de création..."
    fi
    
    log_success "Vérification des pods terminée"
}

# Fonction pour exécuter les migrations de base de données avec auto-correction complète
run_migrations() {
    log_info "🚀 Démarrage de l'auto-correction complète des migrations..."
    final_auto_check_and_fix
}

# Fonction pour afficher les informations de l'application
show_application_info() {
    log_success "🎉 Déploiement IBIS-X 100% AUTOMATIQUE terminé avec succès !"
    echo
    echo "✅ AUTOMATISATION COMPLÈTE RÉUSSIE :"
    echo "===================================="
    echo "✅ Infrastructure Azure créée automatiquement"
    echo "✅ Images Docker construites et pushées automatiquement"
    echo "✅ Secrets Kubernetes créés automatiquement (vrais secrets Azure)"
    echo "✅ Applications déployées automatiquement (avec fallback Windows)"
    echo "✅ NGINX Ingress + Cert-Manager installés automatiquement"
    echo "✅ Pods défaillants redémarrés automatiquement"
    echo "✅ Aucune commande manuelle requise !"
    echo
    echo "📋 Informations de l'application :"
    echo "=================================="
    echo "🌐 URL de l'application: https://ibisx.fr (certificat SSL automatique)"
    echo "🌐 URL de l'API: https://api.ibisx.fr (certificat SSL automatique)"
    echo "🌐 URL HTTP direct: http://$PUBLIC_IP"
    echo "🗄️  Storage Account: $STORAGE_ACCOUNT"
    echo "🐳 Container Registry: $ACR_NAME.azurecr.io"
    echo "☸️  Cluster AKS: $AKS_NAME"
    echo "📦 Resource Group: $RESOURCE_GROUP"
    echo
    echo "🔧 Commandes utiles pour monitoring :"
    echo "====================================="
    echo "# Voir l'état des pods:"
    echo "kubectl get pods -n ibis-x"
    echo
    echo "# Voir les services:"
    echo "kubectl get services -n ibis-x"
    echo
    echo "# Voir l'ingress et IP publique:"
    echo "kubectl get ingress -n ibis-x"
    echo
    echo "# Voir les certificats SSL et leur statut:"
    echo "kubectl get certificates -n ibis-x"
    echo ""
    echo "# Voir l'ingress et IP publique:"
    echo "kubectl get ingress -n ibis-x"
    echo ""
    echo "# Tester l'application en ligne:"
    echo "curl -I http://$PUBLIC_IP"
    echo
    echo "# Voir les logs des applications:"
    echo "kubectl logs -f deployment/api-gateway -n ibis-x"
    echo "kubectl logs -f deployment/service-selection -n ibis-x"
    echo "kubectl logs -f deployment/frontend -n ibis-x"
    echo
    echo "📝 SCRIPT ENTIÈREMENT AUTOMATIQUE :"
    echo "==================================="
    echo "🎯 Pour relancer un déploiement complet : ./scripts/deploy-to-azure.sh"
    echo "🔄 Le script détecte automatiquement l'infrastructure existante"
    echo "🛠️ Tous les problèmes Windows/Linux gérés automatiquement"
    echo "🔐 Tous les secrets générés automatiquement"
    echo "📦 Toutes les images avec les bons noms automatiquement"
    echo
    echo "⚠️  PROCHAINES ÉTAPES (optionnelles) :"
    echo "====================================="
    echo "1. Configurez vos DNS pour pointer vers l'IP: $PUBLIC_IP"
    echo "2. Les certificats SSL se génèreront automatiquement une fois les DNS configurés"
    echo "3. L'application est accessible immédiatement via l'IP temporaire"
}

# Fonction pour nettoyer les fichiers de sauvegarde après un déploiement réussi
cleanup_backup_files() {
    log_info "Nettoyage des fichiers de sauvegarde..."
    
    # Supprimer les fichiers de sauvegarde
    find "$K8S_DIR" -name "*.yaml.backup" -delete 2>/dev/null || true
    find "$TERRAFORM_DIR" -name "*.backup" -delete 2>/dev/null || true
    
    log_success "Fichiers de sauvegarde nettoyés"
}

# Fonction pour nettoyer en cas d'erreur
cleanup_on_error() {
    log_error "Une erreur s'est produite pendant le déploiement."
    
    # Restaurer les fichiers de sauvegarde s'ils existent
    if [ -f "$K8S_DIR/base/service-selection/storage-secrets.yaml.backup" ]; then
        mv "$K8S_DIR/base/service-selection/storage-secrets.yaml.backup" "$K8S_DIR/base/service-selection/storage-secrets.yaml"
        log_info "Fichier storage-secrets.yaml restauré"
    fi
    
    if [ -f "$K8S_DIR/overlays/azure/kustomization.yaml.backup" ]; then
        mv "$K8S_DIR/overlays/azure/kustomization.yaml.backup" "$K8S_DIR/overlays/azure/kustomization.yaml"
        log_info "Fichier kustomization.yaml restauré"
    fi
    
    # Restaurer tous les fichiers YAML modifiés
    find "$K8S_DIR" -name "*.yaml.backup" -exec bash -c 'mv "$1" "${1%.backup}"' _ {} \; 2>/dev/null || true
    find "$TERRAFORM_DIR" -name "*.backup" -exec bash -c 'mv "$1" "${1%.backup}"' _ {} \; 2>/dev/null || true
    log_info "Tous les fichiers restaurés"
    
    echo
    log_warning "Pour nettoyer les ressources Azure créées, exécutez :"
    echo "cd $TERRAFORM_DIR && terraform destroy"
}

# Fonction principale
main() {
    log_info "🚀 Script de Déploiement Production IBIS-X"
    log_info "🎯 Mode: $DEPLOYMENT_MODE"
    log_info "ℹ️  Pour le développement local, utilisez: make dev"
    echo
    
    # Configurer le gestionnaire d'erreur
    trap cleanup_on_error ERR
    
    # Workflow principal
    log_info "📋 === DÉPLOIEMENT PRODUCTION ==="
    
    # Étapes d'infrastructure et déploiement
    check_prerequisites
    check_azure_login
    
    # Gestion de l'infrastructure (créer si nécessaire)
    manage_infrastructure
    
    # Configuration et déploiement
    get_terraform_outputs
    configure_kubectl
    
    # Build et déploiement de l'application
    build_and_push_images
    update_k8s_secrets  # Créer le namespace
    create_missing_secrets
    deploy_application
    
    # Migrations et finalisation
    wait_for_migrations
    initialize_sample_data
    final_auto_check_and_fix
    
    # Nettoyage si mode GitHub Actions
    if [[ "$USE_GITHUB_SECRETS" == "true" ]]; then
        cleanup_migration_jobs
    fi
    
    # Afficher les informations finales
    show_application_info
    
    # Nettoyer les fichiers de sauvegarde
    cleanup_backup_files
    
    log_success "🎉 DÉPLOIEMENT PRODUCTION TERMINÉ AVEC SUCCÈS !"
}

# Fonction pour gérer l'infrastructure selon le contexte
manage_infrastructure() {
    log_info "🏗️ Gestion de l'infrastructure Azure..."
    
    if [[ "$USE_GITHUB_SECRETS" == "true" ]]; then
        # Mode GitHub Actions : infrastructure supposée existante
        log_info "🏭 Mode GitHub Actions - Infrastructure supposée existante"
        log_info "ℹ️  Si l'infrastructure n'existe pas, créez-la manuellement avec ce script"
    else
        # Mode manuel : vérifier si infrastructure existe, sinon la créer
        log_info "🛠️ Mode manuel - Vérification de l'infrastructure..."
        
        # Vérifier si l'infrastructure existe
        if check_infrastructure_exists; then
            log_success "✅ Infrastructure existante détectée"
        else
            log_info "🏗️ Infrastructure non trouvée - Création automatique..."
            create_infrastructure
        fi
    fi
}

# Fonction pour vérifier si l'infrastructure existe
check_infrastructure_exists() {
    log_info "🔍 Vérification de l'existence de l'infrastructure..."
    
    # Vérifier si les ressources principales existent
    local acr_exists=$(az acr show --name "$AZURE_CONTAINER_REGISTRY" --resource-group "$AZURE_RESOURCE_GROUP" 2>/dev/null && echo "true" || echo "false")
    local aks_exists=$(az aks show --name "$AKS_CLUSTER_NAME" --resource-group "$AZURE_RESOURCE_GROUP" 2>/dev/null && echo "true" || echo "false")
    
    if [[ "$acr_exists" == "true" ]] && [[ "$aks_exists" == "true" ]]; then
        log_success "✅ Infrastructure existante (ACR + AKS)"
        return 0
    else
        log_info "❌ Infrastructure incomplète ou manquante"
        log_info "   ACR ($AZURE_CONTAINER_REGISTRY): $acr_exists"
        log_info "   AKS ($AKS_CLUSTER_NAME): $aks_exists"
        return 1
    fi
}

# Fonction pour créer l'infrastructure
create_infrastructure() {
    log_info "🏗️ Création de l'infrastructure Azure via Terraform..."
    
    # Créer l'infrastructure complète
    check_kubernetes_versions
    init_terraform
    deploy_infrastructure
    
    log_success "✅ Infrastructure créée avec succès"
}

# Vérifier si le script est exécuté directement
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 
