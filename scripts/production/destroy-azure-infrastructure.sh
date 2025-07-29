#!/bin/bash

# Script de destruction sécurisée de l'infrastructure Azure IBIS-X
# Ce script supprime toutes les ressources Azure créées par Terraform

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

# Fonction pour confirmer la destruction
confirm_destruction() {
    log_warning "⚠️  ATTENTION: Cette action va SUPPRIMER DÉFINITIVEMENT toutes les ressources Azure IBIS-X !"
    echo
    echo "Ressources qui seront supprimées :"
    echo "- Cluster AKS et tous les pods/services Kubernetes"
    echo "- Azure Container Registry et toutes les images Docker"
    echo "- Compte de stockage Azure et toutes les données"
    echo "- Réseau virtuel et configurations réseau"
    echo "- Log Analytics et Application Insights"
    echo "- Toutes les autres ressources du groupe de ressources"
    echo
    
    read -p "Êtes-vous ABSOLUMENT SÛR de vouloir continuer ? Tapez 'DETRUIRE' pour confirmer : " confirmation
    
    if [[ "$confirmation" != "DETRUIRE" ]]; then
        log_error "Destruction annulée par l'utilisateur"
        exit 1
    fi
    
    log_warning "Destruction confirmée. Démarrage dans 10 secondes..."
    echo "Appuyez sur Ctrl+C pour annuler maintenant !"
    sleep 10
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis pour la destruction..."
    
    # Vérifier Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI n'est pas installé"
        exit 1
    fi
    
    # Vérifier Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform n'est pas installé"
        exit 1
    fi
    
    # Vérifier kubectl (optionnel pour le nettoyage K8s)
    if command -v kubectl &> /dev/null; then
        log_info "kubectl détecté - nettoyage Kubernetes possible"
    else
        log_warning "kubectl non installé - nettoyage Kubernetes ignoré"
    fi
    
    log_success "Prérequis validés"
}

# Fonction pour vérifier la connexion Azure
check_azure_login() {
    log_info "Vérification de la connexion Azure..."
    
    if ! az account show &> /dev/null; then
        log_warning "Non connecté à Azure. Connexion requise..."
        az login
    fi
    
    local ACCOUNT_INFO=$(az account show --output json)
    local SUBSCRIPTION_NAME=$(echo "$ACCOUNT_INFO" | jq -r '.name')
    local SUBSCRIPTION_ID=$(echo "$ACCOUNT_INFO" | jq -r '.id')
    
    log_success "Connecté à Azure:"
    echo "  Subscription: $SUBSCRIPTION_NAME"
    echo "  ID: $SUBSCRIPTION_ID"
}

# Fonction pour nettoyer les ressources Kubernetes (optionnel)
cleanup_kubernetes() {
    log_info "Nettoyage des ressources Kubernetes..."
    
    if ! command -v kubectl &> /dev/null; then
        log_warning "kubectl non disponible - nettoyage K8s ignoré"
        return 0
    fi
    
    # Essayer de récupérer les credentials du cluster existant
    local RESOURCE_GROUP="ibis-x-prod-rg"
    local CLUSTER_NAME="ibis-x-prod-aks"
    
    # Chercher d'abord les anciens noms (IBIS-X)
    if az aks show --resource-group "IBIS-X-perso-rg" --name "IBIS-X-prod-aks" &> /dev/null; then
        RESOURCE_GROUP="IBIS-X-perso-rg"
        CLUSTER_NAME="IBIS-X-prod-aks"
        log_info "Cluster IBIS-X détecté - nettoyage..."
    elif az aks show --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" &> /dev/null; then
        log_info "Cluster IBIS-X détecté - nettoyage..."
    else
        log_warning "Aucun cluster AKS trouvé - nettoyage K8s ignoré"
        return 0
    fi
    
    # Récupérer les credentials
    az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --overwrite-existing || {
        log_warning "Impossible de récupérer les credentials K8s"
        return 0
    }
    
    # Supprimer les namespaces de l'application
    kubectl delete namespace IBIS-X --ignore-not-found=true
    kubectl delete namespace ibis-x --ignore-not-found=true
    
    # Supprimer les composants installés via Helm
    helm uninstall cert-manager --namespace cert-manager --ignore-not-found || true
    helm uninstall ingress-nginx --namespace ingress-nginx --ignore-not-found || true
    
    # Supprimer les namespaces des composants
    kubectl delete namespace cert-manager --ignore-not-found=true
    kubectl delete namespace ingress-nginx --ignore-not-found=true
    
    log_success "Nettoyage Kubernetes terminé"
}

# Fonction pour détruire l'infrastructure Terraform
destroy_terraform_infrastructure() {
    log_info "Destruction de l'infrastructure Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Vérifier si Terraform est initialisé
    if [ ! -d ".terraform" ]; then
        log_warning "Terraform non initialisé - initialisation..."
        terraform init
    fi
    
    # Générer le plan de destruction
    log_info "Génération du plan de destruction..."
    terraform plan -destroy -out=destroy.tfplan
    
    # Afficher un résumé
    echo
    log_warning "Terraform va détruire les ressources listées ci-dessus."
    read -p "Confirmez-vous la destruction ? (y/N): " terraform_confirm
    
    if [[ $terraform_confirm != [yY] && $terraform_confirm != [yY][eE][sS] ]]; then
        log_error "Destruction Terraform annulée"
        rm -f destroy.tfplan
        exit 1
    fi
    
    # Appliquer la destruction
    log_info "Application de la destruction Terraform..."
    terraform apply destroy.tfplan
    
    # Nettoyer
    rm -f destroy.tfplan
    
    log_success "Infrastructure Terraform détruite"
}

# Fonction pour nettoyage final
final_cleanup() {
    log_info "Nettoyage final..."
    
    # Supprimer les fichiers de sauvegarde générés par le script de déploiement
    find "$PROJECT_ROOT/k8s" -name "*.backup" -delete 2>/dev/null || true
    find "$PROJECT_ROOT/k8s" -name "*.tmp" -delete 2>/dev/null || true
    
    log_success "Nettoyage final terminé"
}

# Fonction principale
main() {
    log_info "🗑️  Démarrage de la destruction de l'infrastructure IBIS-X"
    echo
    
    # Étapes de destruction
    check_prerequisites
    check_azure_login
    confirm_destruction
    cleanup_kubernetes
    destroy_terraform_infrastructure
    final_cleanup
    
    log_success "🎉 Destruction de l'infrastructure terminée !"
    echo
    echo "Toutes les ressources Azure IBIS-X ont été supprimées."
    echo "Vous pouvez maintenant relancer le déploiement avec le nouveau script."
}

# Vérifier si le script est exécuté directement
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 
