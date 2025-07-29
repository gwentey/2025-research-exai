#!/bin/bash

# 🔧 SCRIPT RAPIDE - Correction IP Statique NGINX Ingress
# Usage: ./scripts/fix-nginx-static-ip.sh

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[FIX-IP]${NC} $1"
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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Variables par défaut (peuvent être surchargées par variables d'environnement)
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-ibis-x-prod-rg}"
AKS_NAME="${AKS_CLUSTER_NAME:-ibis-x-prod-aks}"

log_info "🔧 Script de correction rapide IP statique NGINX Ingress"
log_info "📋 Resource Group: $RESOURCE_GROUP"
log_info "📋 AKS Cluster: $AKS_NAME"

# 1. Vérifier les prérequis
if ! command -v kubectl &> /dev/null; then
    log_error "❌ kubectl non installé"
    exit 1
fi

if ! command -v az &> /dev/null; then
    log_error "❌ Azure CLI non installé"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    log_error "❌ Helm non installé"
    exit 1
fi

# 2. Récupérer l'IP statique depuis Azure
log_info "🔍 Recherche de l'IP statique dans Azure..."

node_resource_group=$(az group list --query "[?contains(name, 'MC_${RESOURCE_GROUP}_${AKS_NAME}')].name" --output tsv 2>/dev/null | head -1)

if [[ -z "$node_resource_group" ]]; then
    log_error "❌ Resource group AKS non trouvé"
    exit 1
fi

static_ip=$(az network public-ip show --resource-group "$node_resource_group" --name "ibis-x-prod-ingress-ip" --query "ipAddress" --output tsv 2>/dev/null || echo "")

if [[ -z "$static_ip" ]]; then
    log_error "❌ IP statique 'ibis-x-prod-ingress-ip' non trouvée dans $node_resource_group"
    log_info "💡 Créez l'IP statique avec :"
    echo "   az network public-ip create --resource-group '$node_resource_group' --name 'ibis-x-prod-ingress-ip' --allocation-method Static --sku Standard --location eastus"
    exit 1
fi

log_success "✅ IP statique trouvée : $static_ip"

# 3. Vérifier l'IP actuelle de NGINX
log_info "🔍 Vérification de l'IP actuelle de NGINX..."

nginx_current_ip=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

log_info "🎯 IP statique attendue : $static_ip"
log_info "🔍 IP actuelle NGINX : ${nginx_current_ip:-AUCUNE}"

if [[ "$nginx_current_ip" == "$static_ip" ]]; then
    log_success "✅ NGINX utilise déjà l'IP statique correcte !"
    
    # Vérifier l'ingress de l'application
    ingress_ip=$(kubectl get ingress -n ibis-x ibis-x-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [[ "$ingress_ip" == "$static_ip" ]]; then
        log_success "✅ Ingress application OK : $ingress_ip"
        log_success "🎉 Tout est correct ! Aucune action nécessaire."
        exit 0
    else
        log_warning "⚠️ Ingress application : ${ingress_ip:-PENDING} (attente synchronisation...)"
        exit 0
    fi
fi

# 4. IP incorrecte détectée - Correction
log_error "❌ PROBLÈME : NGINX utilise une IP incorrecte !"
log_info "🔧 CORRECTION AUTOMATIQUE en cours..."

# Option 1 : Patch du service (méthode douce)
log_info "🔄 Tentative de patch du service NGINX..."
kubectl patch svc ingress-nginx-controller -n ingress-nginx -p "{\"spec\":{\"loadBalancerIP\":\"$static_ip\"}}" 2>/dev/null || true

# Attendre et vérifier
sleep 30
nginx_current_ip=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

if [[ "$nginx_current_ip" == "$static_ip" ]]; then
    log_success "✅ CORRECTION RÉUSSIE avec patch : $nginx_current_ip"
    exit 0
fi

# Option 2 : Recréation complète de NGINX (méthode forte)
log_warning "⚠️ Patch insuffisant - Recréation complète de NGINX..."

read -p "Voulez-vous recréer NGINX Ingress avec l'IP statique ? (y/N): " confirm
if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    log_info "❌ Operation annulée par l'utilisateur"
    exit 1
fi

log_info "🗑️ Suppression de NGINX Ingress..."
helm uninstall ingress-nginx -n ingress-nginx 2>/dev/null || true
kubectl delete namespace ingress-nginx --ignore-not-found=true
sleep 10

log_info "📦 Réinstallation de NGINX avec IP statique forcée..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace \
    --set controller.service.loadBalancerIP="$static_ip" \
    --set controller.service.type=LoadBalancer \
    --set "controller.service.annotations.service\.beta\.kubernetes\.io/azure-load-balancer-static-ip=$static_ip" \
    --set "controller.service.annotations.service\.beta\.kubernetes\.io/azure-load-balancer-resource-group=$node_resource_group" \
    --set "controller.service.annotations.service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path=/healthz" \
    --set "controller.service.annotations.service\.beta\.kubernetes\.io/azure-load-balancer-mode=shared" \
    --set controller.replicaCount=2 \
    --set "controller.nodeSelector.kubernetes\.io/os=linux" \
    --set "defaultBackend.nodeSelector.kubernetes\.io/os=linux" \
    --wait --timeout=10m

# Validation finale
log_info "🔍 Validation finale..."
nginx_final_ip=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

if [[ "$nginx_final_ip" == "$static_ip" ]]; then
    log_success "🎉 SUCCÈS COMPLET : NGINX utilise l'IP statique : $nginx_final_ip"
    
    # Afficher l'état final
    echo
    log_info "📊 État final :"
    kubectl get svc -n ingress-nginx ingress-nginx-controller
    echo
    kubectl get ingress -n ibis-x 2>/dev/null || true
    
    log_success "✅ Correction terminée ! Votre site devrait être accessible."
else
    log_error "❌ ÉCHEC : IP finale incorrecte"
    log_error "   Attendue : $static_ip"
    log_error "   Actuelle : ${nginx_final_ip:-AUCUNE}"
    exit 1
fi 