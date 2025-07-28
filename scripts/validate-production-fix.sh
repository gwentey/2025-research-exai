#!/bin/bash

# 🔍 SCRIPT DE VALIDATION DES CORRECTIONS PRODUCTION IBIS-X
# Ce script valide que les corrections apportées au déploiement production fonctionnent

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Variables
PROJECT_ROOT=$(pwd)
GITHUB_WORKFLOW_FILE="$PROJECT_ROOT/.github/workflows/deploy-production-v2.yml"
KUSTOMIZATION_FILE="$PROJECT_ROOT/k8s/overlays/azure/kustomization.yaml"
DEPLOY_SCRIPT="$PROJECT_ROOT/scripts/deploy-to-azure.sh"

# Fonction de validation de la découverte dynamique GitHub Actions
validate_github_discovery() {
    log_info "🔍 Validation de la découverte dynamique GitHub Actions..."
    
    if ! grep -q "Découverte Dynamique de l'Infrastructure Azure" "$GITHUB_WORKFLOW_FILE"; then
        log_error "❌ Étape de découverte dynamique manquante dans GitHub Actions"
        return 1
    fi
    
    if ! grep -q "ACR_NAME=.*az acr list" "$GITHUB_WORKFLOW_FILE"; then
        log_error "❌ Commande de découverte ACR manquante"
        return 1
    fi
    
    if ! grep -q "AZURE_CONTAINER_REGISTRY=\$ACR_NAME" "$GITHUB_WORKFLOW_FILE"; then
        log_error "❌ Export de variable ACR manquant"
        return 1
    fi
    
    log_success "✅ Découverte dynamique GitHub Actions validée"
    return 0
}

# Fonction de validation du kustomization dynamique
validate_kustomization_dynamic() {
    log_info "🔍 Validation du kustomization dynamique..."
    
    if ! grep -q "PLACEHOLDER_ACR" "$KUSTOMIZATION_FILE"; then
        log_error "❌ Placeholders ACR manquants dans kustomization.yaml"
        return 1
    fi
    
    if grep -q "ibisxprodacr[0-9]" "$KUSTOMIZATION_FILE"; then
        log_error "❌ Noms ACR hardcodés encore présents dans kustomization.yaml"
        return 1
    fi
    
    # Vérifier que tous les services ont des placeholders
    local services=("ibis-x-api-gateway" "service-selection" "frontend")
    for service in "${services[@]}"; do
        if ! grep -q "PLACEHOLDER_ACR.azurecr.io/$service" "$KUSTOMIZATION_FILE"; then
            log_error "❌ Placeholder manquant pour le service: $service"
            return 1
        fi
    done
    
    log_success "✅ Kustomization dynamique validé"
    return 0
}

# Fonction de validation du script de déploiement
validate_deploy_script() {
    log_info "🔍 Validation du script de déploiement..."
    
    if ! grep -q "s|PLACEHOLDER_ACR|" "$DEPLOY_SCRIPT"; then
        log_error "❌ Remplacement des placeholders ACR manquant dans le script"
        return 1
    fi
    
    if ! grep -q "get_github_infrastructure_info" "$DEPLOY_SCRIPT"; then
        log_error "❌ Fonction de récupération GitHub manquante"
        return 1
    fi
    
    if ! grep -q "get_manual_infrastructure_info" "$DEPLOY_SCRIPT"; then
        log_error "❌ Fonction de récupération manuelle manquante"
        return 1
    fi
    
    log_success "✅ Script de déploiement validé"
    return 0
}

# Fonction de validation des variables d'environnement
validate_environment_variables() {
    log_info "🔍 Validation des variables d'environnement..."
    
    # Vérifier que les variables fixes dans GitHub Actions correspondent à Terraform
    if ! grep -q "AZURE_RESOURCE_GROUP: 'ibis-x-prod-rg'" "$GITHUB_WORKFLOW_FILE"; then
        log_warning "⚠️ Resource group par défaut ne correspond pas à Terraform"
    fi
    
    if ! grep -q "AKS_CLUSTER_NAME: 'ibis-x-prod-aks'" "$GITHUB_WORKFLOW_FILE"; then
        log_warning "⚠️ Nom AKS par défaut ne correspond pas à Terraform"
    fi
    
    # Vérifier qu'il n'y a plus de variables ACR hardcodées
    if grep -q "AZURE_CONTAINER_REGISTRY: '" "$GITHUB_WORKFLOW_FILE"; then
        log_error "❌ Variable ACR hardcodée encore présente dans GitHub Actions"
        return 1
    fi
    
    log_success "✅ Variables d'environnement validées"
    return 0
}

# Fonction de simulation de découverte ACR
simulate_acr_discovery() {
    log_info "🧪 Simulation de la découverte ACR..."
    
    # Simuler une commande Azure CLI pour tester la logique
    local mock_acr_output="ibisxprodacr1234"
    
    log_info "Simulation: ACR découvert = $mock_acr_output"
    
    # Tester le remplacement de placeholder
    local test_content="newName: PLACEHOLDER_ACR.azurecr.io/ibis-x-api-gateway"
    local expected_result="newName: $mock_acr_output.azurecr.io/ibis-x-api-gateway"
    local actual_result=$(echo "$test_content" | sed "s|PLACEHOLDER_ACR|$mock_acr_output|g")
    
    if [[ "$actual_result" == "$expected_result" ]]; then
        log_success "✅ Simulation de remplacement réussie"
        log_info "  Avant: $test_content"
        log_info "  Après: $actual_result"
    else
        log_error "❌ Simulation de remplacement échouée"
        log_error "  Attendu: $expected_result"
        log_error "  Obtenu: $actual_result"
        return 1
    fi
    
    return 0
}

# Fonction de validation complète
validate_all() {
    log_info "🚀 Validation complète des corrections production IBIS-X"
    echo "========================================================="
    
    local total_tests=0
    local passed_tests=0
    
    # Test 1: GitHub Actions Discovery
    total_tests=$((total_tests + 1))
    if validate_github_discovery; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Test 2: Kustomization Dynamic
    total_tests=$((total_tests + 1))
    if validate_kustomization_dynamic; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Test 3: Deploy Script
    total_tests=$((total_tests + 1))
    if validate_deploy_script; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Test 4: Environment Variables
    total_tests=$((total_tests + 1))
    if validate_environment_variables; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Test 5: ACR Discovery Simulation
    total_tests=$((total_tests + 1))
    if simulate_acr_discovery; then
        passed_tests=$((passed_tests + 1))
    fi
    
    echo "========================================================="
    log_info "📊 Résultats de validation: $passed_tests/$total_tests tests réussis"
    
    if [[ $passed_tests -eq $total_tests ]]; then
        log_success "🎉 TOUTES LES VALIDATIONS RÉUSSIES !"
        log_success "✅ Les corrections de production sont prêtes"
        log_info ""
        log_info "📋 Prochaines étapes:"
        log_info "1. Committez ces modifications"
        log_info "2. Pushes sur la branche 'production'"
        log_info "3. GitHub Actions déclenchera automatiquement le déploiement"
        log_info "4. Surveillez les logs du workflow pour validation"
        echo "========================================================="
        return 0
    else
        log_error "❌ CERTAINES VALIDATIONS ONT ÉCHOUÉ"
        log_error "⚠️ Corrigez les erreurs avant de déployer en production"
        return 1
    fi
}

# Fonction principale
main() {
    log_info "🔍 DÉBUT DE LA VALIDATION DES CORRECTIONS PRODUCTION"
    echo
    
    validate_all
    
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "🎉 VALIDATION COMPLÈTE RÉUSSIE !"
    else
        log_error "❌ VALIDATION ÉCHOUÉE - Corrections nécessaires"
    fi
    
    exit $exit_code
}

# Exécuter si appelé directement
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 