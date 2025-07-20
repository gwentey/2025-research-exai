#!/bin/bash

# Script de suppression de l'infrastructure Azure EXAI
# Utilise Terraform pour détruire toutes les ressources créées

set -e  # Arrêter le script en cas d'erreur

# Variables de configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/azure-infrastructure"

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
    
    # Vérifier que le répertoire Terraform existe
    if [ ! -d "$TERRAFORM_DIR" ]; then
        log_error "Le répertoire Terraform n'existe pas: $TERRAFORM_DIR"
        exit 1
    fi
    
    log_success "Prérequis vérifiés"
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

# Fonction pour afficher les ressources qui seront supprimées
show_resources_to_destroy() {
    log_info "Analyse des ressources qui seront supprimées..."
    
    cd "$TERRAFORM_DIR"
    
    # Vérifier si le state file existe
    if [ ! -f "terraform.tfstate" ]; then
        log_warning "Aucun fichier d'état Terraform trouvé. Il se peut qu'aucune ressource ne soit déployée."
        return
    fi
    
    # Afficher le plan de destruction
    log_info "Génération du plan de destruction..."
    terraform plan -destroy -out=destroy_plan
    
    echo
    log_warning "⚠️  ATTENTION: Les ressources suivantes seront DÉFINITIVEMENT supprimées !"
    echo
}

# Fonction pour demander confirmation
ask_confirmation() {
    log_warning "🚨 DERNIÈRE CHANCE - Cette action est IRRÉVERSIBLE !"
    echo
    echo "Cette opération va supprimer :"
    echo "- Tous les clusters Kubernetes et applications"
    echo "- Tous les comptes de stockage et données"
    echo "- Toutes les images Docker dans ACR"
    echo "- Tous les réseaux virtuels et IPs publiques"
    echo "- Tous les logs et métriques de monitoring"
    echo
    log_error "⚠️  TOUTES VOS DONNÉES SERONT PERDUES !"
    echo
    
    # Triple confirmation pour éviter les erreurs
    read -p "Tapez 'SUPPRIMER' (en majuscules) pour confirmer: " confirm1
    if [ "$confirm1" != "SUPPRIMER" ]; then
        log_info "Suppression annulée."
        exit 0
    fi
    
    read -p "Êtes-vous absolument certain ? (oui/NON): " confirm2
    if [ "$confirm2" != "oui" ]; then
        log_info "Suppression annulée."
        exit 0
    fi
    
    echo
    log_warning "Démarrage de la suppression dans 10 secondes..."
    log_warning "Appuyez sur Ctrl+C pour annuler maintenant !"
    
    for i in {10..1}; do
        echo -n "⏰ $i "
        sleep 1
    done
    echo
    echo
}

# Fonction pour supprimer les applications Kubernetes en premier
cleanup_kubernetes_resources() {
    log_info "Nettoyage des ressources Kubernetes..."
    
    # Vérifier si kubectl est disponible et configuré
    if command -v kubectl &> /dev/null; then
        # Essayer de supprimer les ressources EXAI si elles existent
        if kubectl get namespace exai &> /dev/null; then
            log_info "Suppression des applications EXAI de Kubernetes..."
            
            # Supprimer les jobs de migration s'ils existent
            kubectl delete job --all -n exai --ignore-not-found=true
            
            # Supprimer tous les déploiements, services, etc.
            kubectl delete all --all -n exai --ignore-not-found=true
            
            # Supprimer les secrets et configmaps
            kubectl delete secrets --all -n exai --ignore-not-found=true
            kubectl delete configmaps --all -n exai --ignore-not-found=true
            
            # Supprimer les PVCs
            kubectl delete pvc --all -n exai --ignore-not-found=true
            
            log_success "Applications Kubernetes supprimées"
        else
            log_info "Namespace exai non trouvé, ignoré"
        fi
    else
        log_warning "kubectl non disponible, impossible de nettoyer les ressources Kubernetes"
    fi
}

# Fonction pour vider les containers de stockage
cleanup_storage_containers() {
    log_info "Nettoyage des containers de stockage..."
    
    cd "$TERRAFORM_DIR"
    
    # Récupérer le nom du compte de stockage s'il existe
    if terraform show &> /dev/null; then
        STORAGE_ACCOUNT=$(terraform output -raw storage_account_name 2>/dev/null || echo "")
        
        if [ -n "$STORAGE_ACCOUNT" ]; then
            log_info "Vidage du compte de stockage: $STORAGE_ACCOUNT"
            
            # Lister et supprimer tous les blobs dans tous les containers
            CONTAINERS=$(az storage container list --account-name "$STORAGE_ACCOUNT" --query "[].name" -o tsv 2>/dev/null || echo "")
            
            for container in $CONTAINERS; do
                log_info "Vidage du container: $container"
                az storage blob delete-batch --account-name "$STORAGE_ACCOUNT" --source "$container" --only-show-errors 2>/dev/null || true
            done
            
            log_success "Containers de stockage vidés"
        fi
    fi
}

# Fonction pour supprimer les images ACR
cleanup_acr_images() {
    log_info "Nettoyage des images dans Azure Container Registry..."
    
    cd "$TERRAFORM_DIR"
    
    # Récupérer le nom de l'ACR s'il existe
    if terraform show &> /dev/null; then
        ACR_NAME=$(terraform output -raw acr_name 2>/dev/null || echo "")
        
        if [ -n "$ACR_NAME" ]; then
            log_info "Suppression des images dans ACR: $ACR_NAME"
            
            # Lister et supprimer tous les repositories
            REPOS=$(az acr repository list --name "$ACR_NAME" --output tsv 2>/dev/null || echo "")
            
            for repo in $REPOS; do
                log_info "Suppression du repository: $repo"
                az acr repository delete --name "$ACR_NAME" --repository "$repo" --yes 2>/dev/null || true
            done
            
            log_success "Images ACR supprimées"
        fi
    fi
}

# Fonction pour exécuter la destruction Terraform
destroy_infrastructure() {
    log_info "🔥 Suppression de l'infrastructure Azure avec Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Appliquer le plan de destruction
    terraform apply destroy_plan
    
    log_success "Infrastructure Azure supprimée !"
}

# Fonction pour nettoyer les fichiers locaux
cleanup_local_files() {
    log_info "Nettoyage des fichiers locaux..."
    
    cd "$TERRAFORM_DIR"
    
    # Supprimer les fichiers de plan
    rm -f tfplan destroy_plan
    
    # Optionnel: supprimer le state file (décommenter si souhaité)
    # log_warning "Suppression du fichier d'état Terraform..."
    # rm -f terraform.tfstate terraform.tfstate.backup
    
    # Restaurer les fichiers de configuration d'origine
    K8S_DIR="$PROJECT_ROOT/k8s"
    
    if [ -f "$K8S_DIR/base/service-selection/storage-secrets.yaml.backup" ]; then
        mv "$K8S_DIR/base/service-selection/storage-secrets.yaml.backup" "$K8S_DIR/base/service-selection/storage-secrets.yaml"
        log_info "Fichier storage-secrets.yaml restauré"
    fi
    
    if [ -f "$K8S_DIR/overlays/azure/kustomization.yaml.backup" ]; then
        mv "$K8S_DIR/overlays/azure/kustomization.yaml.backup" "$K8S_DIR/overlays/azure/kustomization.yaml"
        log_info "Fichier kustomization.yaml restauré"
    fi
    
    log_success "Fichiers locaux nettoyés"
}

# Fonction pour afficher le résumé final
show_cleanup_summary() {
    log_success "🎉 Suppression complète terminée !"
    echo
    echo "📋 Ressources supprimées :"
    echo "========================="
    echo "✅ Applications Kubernetes"
    echo "✅ Cluster AKS"
    echo "✅ Comptes de stockage et données"
    echo "✅ Container Registry et images"
    echo "✅ Réseaux virtuels et IPs"
    echo "✅ Monitoring et logs"
    echo "✅ Groupe de ressources principal"
    echo
    echo "💡 Pour redéployer l'infrastructure :"
    echo "  ./scripts/deploy-to-azure.sh"
    echo
    log_success "Votre environnement Azure est maintenant complètement nettoyé."
}

# Fonction de gestion d'erreur
handle_error() {
    log_error "Une erreur s'est produite pendant la suppression."
    echo
    log_warning "Que faire maintenant :"
    echo "1. Vérifiez les logs d'erreur ci-dessus"
    echo "2. Vous pouvez essayer de relancer le script"
    echo "3. Ou supprimer manuellement les ressources restantes via le portail Azure"
    echo
    echo "Pour supprimer manuellement :"
    echo "1. Connectez-vous au portail Azure: https://portal.azure.com"
    echo "2. Recherchez le groupe de ressources commençant par 'exai-'"
    echo "3. Supprimez le groupe de ressources entier"
    exit 1
}

# Fonction principale
main() {
    log_warning "🗑️  Script de suppression de l'infrastructure Azure EXAI"
    echo
    
    # Configurer le gestionnaire d'erreur
    trap handle_error ERR
    
    # Étapes de suppression
    check_prerequisites
    check_azure_login
    show_resources_to_destroy
    ask_confirmation
    cleanup_kubernetes_resources
    cleanup_storage_containers
    cleanup_acr_images
    destroy_infrastructure
    cleanup_local_files
    
    # Afficher le résumé
    show_cleanup_summary
}

# Vérifier si le script est exécuté directement
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 