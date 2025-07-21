#!/bin/bash

# Script de déploiement automatisé pour IBIS-X sur Azure
# Ce script utilise Terraform pour créer l'infrastructure et déploie l'application

set -e  # Arrêter le script en cas d'erreur

# Variables de configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/azure-infrastructure"
K8S_DIR="$PROJECT_ROOT/k8s"

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

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI n'est pas installé. Installez-le depuis https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Vérifier Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform n'est pas installé. Installez-le depuis https://www.terraform.io/downloads.html"
        exit 1
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

# Nouvelle fonction pour mettre à jour les noms de projet IBIS-X → IBIS-X
update_project_names() {
    log_info "Mise à jour des noms de projet IBIS-X → IBIS-X..."
    
    # Sauvegarder les fichiers avant modification
    find "$K8S_DIR" -name "*.yaml" -exec cp {} {}.backup \;
    
    # Remplacer IBIS-X par IBIS-X dans tous les fichiers YAML Kubernetes
    find "$K8S_DIR" -name "*.yaml" -type f -exec sed -i.tmp \
        -e 's/IBIS-X/ibis-x/g' \
        -e 's/IBIS-X/IBIS-X/g' \
        -e 's/api\.IBIS-X-pipeline\.fr/api.ibisx.fr/g' \
        -e 's/IBIS-X-pipeline\.fr/ibisx.fr/g' \
        {} \;
    
    # Nettoyer les fichiers temporaires
    find "$K8S_DIR" -name "*.tmp" -delete
    
    log_success "Noms de projet mis à jour vers IBIS-X"
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

# Fonction pour récupérer les informations de sortie
get_terraform_outputs() {
    log_info "Récupération des informations de l'infrastructure..."
    
    cd "$TERRAFORM_DIR"
    
    # Récupérer les outputs Terraform
    STORAGE_ACCOUNT=$(terraform output -raw storage_account_name)
    STORAGE_KEY=$(terraform output -raw storage_account_primary_key)
    ACR_NAME=$(terraform output -raw acr_name)
    AKS_NAME=$(terraform output -raw aks_cluster_name)
    RESOURCE_GROUP=$(terraform output -raw resource_group_name)
    PUBLIC_IP=$(terraform output -raw public_ip_address)
    
    # Récupérer les secrets encodés en Base64
    AZURE_ACCOUNT_NAME_B64=$(terraform output -json storage_secrets_base64 | jq -r '.azure_storage_account_name')
    AZURE_ACCOUNT_KEY_B64=$(terraform output -json storage_secrets_base64 | jq -r '.azure_storage_account_key')
    
    log_success "Informations récupérées:"
    echo "  Storage Account: $STORAGE_ACCOUNT"
    echo "  ACR Registry: $ACR_NAME"
    echo "  AKS Cluster: $AKS_NAME"
    echo "  Resource Group: $RESOURCE_GROUP"
    echo "  Public IP: $PUBLIC_IP"
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
    kubectl create namespace IBIS-X --dry-run=client -o yaml | kubectl apply -f -
    
    # Mettre à jour le fichier de secrets avec les vraies valeurs
    SECRETS_FILE="$K8S_DIR/base/service-selection/storage-secrets.yaml"
    
    # Créer une copie de sauvegarde
    cp "$SECRETS_FILE" "$SECRETS_FILE.backup"
    
    # Remplacer les placeholders par les vraies valeurs encodées
    sed -i.tmp \
        -e "s|azure-storage-account-name: .*|azure-storage-account-name: $AZURE_ACCOUNT_NAME_B64|" \
        -e "s|azure-storage-account-key: .*|azure-storage-account-key: $AZURE_ACCOUNT_KEY_B64|" \
        "$SECRETS_FILE"
    
    # Nettoyer le fichier temporaire
    rm -f "$SECRETS_FILE.tmp"
    
    log_success "Secrets Kubernetes mis à jour"
}

# Fonction pour construire et pousser les images Docker
build_and_push_images() {
    log_info "Construction et push des images Docker vers ACR..."
    
    # Se connecter à ACR
    az acr login --name "$ACR_NAME"
    
    cd "$PROJECT_ROOT"
    
    # Construire et pousser l'image API Gateway
    log_info "Construction de l'image ibis-x-api-gateway..."
    docker build -t "$ACR_NAME.azurecr.io/ibis-x-api-gateway:latest" -f api-gateway/Dockerfile api-gateway/
    docker push "$ACR_NAME.azurecr.io/ibis-x-api-gateway:latest"
    
    # Construire et pousser l'image Service Selection
    log_info "Construction de l'image ibis-x-service-selection..."
    docker build -t "$ACR_NAME.azurecr.io/ibis-x-service-selection:latest" -f service-selection/Dockerfile service-selection/
    docker push "$ACR_NAME.azurecr.io/ibis-x-service-selection:latest"
    
    # Construire et pousser l'image Frontend
    log_info "Construction de l'image ibis-x-frontend..."
    docker build -t "$ACR_NAME.azurecr.io/ibis-x-frontend:latest" -f frontend/Dockerfile frontend/
    docker push "$ACR_NAME.azurecr.io/ibis-x-frontend:latest"
    
    log_success "Toutes les images Docker ont été pushées vers ACR"
}

# Fonction pour déployer l'application sur Kubernetes
deploy_application() {
    log_info "Déploiement de l'application IBIS-X sur AKS..."
    
    cd "$PROJECT_ROOT"
    
    # Mettre à jour les noms de projet
    update_project_names
    
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
    
    # Mettre à jour les références d'images dans kustomization.yaml
    KUSTOMIZATION_FILE="$K8S_DIR/overlays/azure/kustomization.yaml"
    
    # Créer une copie de sauvegarde
    cp "$KUSTOMIZATION_FILE" "$KUSTOMIZATION_FILE.backup"
    
    # Mettre à jour les noms d'images avec le vrai ACR
    sed -i.tmp \
        -e "s|newName: .*azurecr.io/IBIS-X-api-gateway|newName: $ACR_NAME.azurecr.io/ibis-x-api-gateway|" \
        -e "s|newName: .*azurecr.io/service-selection|newName: $ACR_NAME.azurecr.io/ibis-x-service-selection|" \
        -e "s|newName: .*azurecr.io/frontend|newName: $ACR_NAME.azurecr.io/ibis-x-frontend|" \
        -e "s|name: IBIS-X-api-gateway|name: ibis-x-api-gateway|" \
        -e "s|name: service-selection|name: ibis-x-service-selection|" \
        -e "s|name: frontend|name: ibis-x-frontend|" \
        "$KUSTOMIZATION_FILE"
    
    # Nettoyer le fichier temporaire
    rm -f "$KUSTOMIZATION_FILE.tmp"
    
    # Déployer avec Kustomize
    kubectl apply -k "$K8S_DIR/overlays/azure/"
    
    # Attendre que les pods soient prêts
    log_info "Attente du démarrage des pods..."
    kubectl wait --for=condition=ready pod -l app=api-gateway -n ibis-x --timeout=300s
    kubectl wait --for=condition=ready pod -l app=service-selection -n ibis-x --timeout=300s
    kubectl wait --for=condition=ready pod -l app=frontend -n ibis-x --timeout=300s
    
    log_success "Application IBIS-X déployée sur AKS"
}

# Fonction pour exécuter les migrations de base de données
run_migrations() {
    log_info "Exécution des migrations de base de données..."
    
    # Lancer les jobs de migration
    kubectl apply -f "$K8S_DIR/base/jobs/api-gateway-migration-job.yaml"
    kubectl apply -f "$K8S_DIR/base/jobs/service-selection-migration-job.yaml"
    
    # Attendre que les jobs se terminent
    kubectl wait --for=condition=complete job/api-gateway-migration-job -n ibis-x --timeout=300s
    kubectl wait --for=condition=complete job/service-selection-migration-job -n ibis-x --timeout=300s
    
    log_success "Migrations de base de données terminées"
}

# Fonction pour afficher les informations de l'application
show_application_info() {
    log_success "🎉 Déploiement IBIS-X terminé avec succès !"
    echo
    echo "📋 Informations de l'application :"
    echo "=================================="
    echo "🌐 URL de l'application: https://ibisx.fr"
    echo "🌐 URL de l'API: https://api.ibisx.fr"
    echo "🌐 URL HTTP (temporaire): http://$PUBLIC_IP"
    echo "🗄️  Storage Account: $STORAGE_ACCOUNT"
    echo "🐳 Container Registry: $ACR_NAME.azurecr.io"
    echo "☸️  Cluster AKS: $AKS_NAME"
    echo "📦 Resource Group: $RESOURCE_GROUP"
    echo
    echo "🔧 Commandes utiles :"
    echo "===================="
    echo "# Voir les pods:"
    echo "kubectl get pods -n ibis-x"
    echo
    echo "# Voir les services:"
    echo "kubectl get services -n ibis-x"
    echo
    echo "# Voir l'état de l'ingress:"
    echo "kubectl get ingress -n ibis-x"
    echo
    echo "# Voir les certificats SSL:"
    echo "kubectl get certificates -n ibis-x"
    echo
    echo "# Voir les logs d'un service:"
    echo "kubectl logs -f deployment/api-gateway -n ibis-x"
    echo "kubectl logs -f deployment/service-selection -n ibis-x"
    echo "kubectl logs -f deployment/frontend -n ibis-x"
    echo
    echo "# Se connecter à ACR:"
    echo "az acr login --name $ACR_NAME"
    echo
    echo "# Accéder à l'interface web Azure:"
    echo "az resource show --resource-group $RESOURCE_GROUP --name $STORAGE_ACCOUNT --resource-type Microsoft.Storage/storageAccounts --query id --output tsv | xargs -I {} az portal --resource {}"
    echo
    echo "⚠️  IMPORTANT:"
    echo "=============="
    echo "1. Configurez vos DNS pour pointer vers l'IP: $PUBLIC_IP"
    echo "2. Les certificats SSL se génèreront automatiquement une fois les DNS configurés"
    echo "3. Vérifiez que les pods NGINX Ingress et Cert-Manager sont bien démarrés"
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
    
    # Restaurer les fichiers YAML modifiés pour le changement de nom
    find "$K8S_DIR" -name "*.yaml.backup" -exec bash -c 'mv "$1" "${1%.backup}"' _ {} \;
    log_info "Fichiers YAML restaurés"
    
    echo
    log_warning "Pour nettoyer les ressources Azure créées, exécutez :"
    echo "cd $TERRAFORM_DIR && terraform destroy"
}

# Fonction principale
main() {
    log_info "🚀 Démarrage du déploiement IBIS-X sur Azure"
    echo
    
    # Configurer le gestionnaire d'erreur
    trap cleanup_on_error ERR
    
    # Étapes de déploiement
    check_prerequisites
    check_azure_login
    init_terraform
    deploy_infrastructure
    get_terraform_outputs
    configure_kubectl
    update_k8s_secrets
    build_and_push_images
    deploy_application
    run_migrations
    
    # Afficher les informations finales
    show_application_info
}

# Vérifier si le script est exécuté directement
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 
