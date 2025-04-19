#!/bin/bash

# Script pour déployer PostgreSQL, API-Gateway et Service-Selection sur Kubernetes
# dans le namespace 'exai' et vérifier l'état des pods.

# Assurez-vous que kubectl est configuré pour pointer vers le bon cluster

NAMESPACE="exai"

# --- Variables de configuration ---
# Assurez-vous que ces chemins et labels sont corrects
POSTGRES_K8S_DIR="k8s/postgres/"      # Chemin vers les manifestes k8s de PostgreSQL
POSTGRES_LABEL="app=postgresql"    # Label pour identifier le pod PostgreSQL

GATEWAY_K8S_DIR="api-gateway/k8s/" # Chemin vers les manifestes k8s de l'API Gateway
GATEWAY_LABEL="app=api-gateway"    # TODO: Vérifier/Modifier ce label

SELECTION_K8S_DIR="service-selection/k8s/" # Chemin vers les manifestes k8s de Service Selection
SELECTION_LABEL="app=service-selection" # TODO: Vérifier/Modifier ce label

# Fonction pour appliquer les manifestes et vérifier l'erreur
apply_manifests() {
  local dir=$1
  local component_name=$2
  echo "-----------------------------------------------------"
  echo "Déploiement de $component_name depuis $dir..."
  kubectl apply -f "$dir" -n "$NAMESPACE"
  if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'application des manifestes pour $component_name."
    exit 1
  fi
  echo "✅ Manifestes pour $component_name appliqués avec succès."
}

# Fonction pour vérifier les pods
check_pods() {
  local label=$1
  local component_name=$2
  echo "-----------------------------------------------------"
  echo "Vérification du statut du pod $component_name (label: $label)..."
  kubectl get pods -n "$NAMESPACE" -l "$label"
  # On pourrait ajouter ici une boucle d'attente plus robuste
}

# --- Exécution ---

echo "🚀 Démarrage du déploiement complet sur le namespace '$NAMESPACE'..."

# 1. Déployer PostgreSQL
apply_manifests "$POSTGRES_K8S_DIR" "PostgreSQL"

# 2. Déployer API Gateway
apply_manifests "$GATEWAY_K8S_DIR" "API Gateway"

# 3. Déployer Service Selection
apply_manifests "$SELECTION_K8S_DIR" "Service Selection"

echo "⏳ Attente de quelques secondes pour que les pods démarrent..."
sleep 10 # Augmenté pour prendre en compte plusieurs déploiements

# 4. Vérifier les pods
check_pods "$POSTGRES_LABEL" "PostgreSQL"
check_pods "$GATEWAY_LABEL" "API Gateway"
check_pods "$SELECTION_LABEL" "Service Selection"

echo "🏁 Script de déploiement terminé." 