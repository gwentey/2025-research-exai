.PHONY: help dev quick-dev update-secrets start-minikube create-namespace docker-env deploy wait-services migrate migrate-jobs init-data dev-with-data clean clean-migrations logs stop reset check-prerequisites

# Configuration
NAMESPACE ?= exai
TIMEOUT ?= 300s

# Couleurs pour l'affichage (désactivées sur Windows)
ifeq ($(OS),Windows_NT)
    GREEN := 
    RED := 
    YELLOW := 
    BLUE := 
    NC := 
else
    GREEN := \033[32m
    RED := \033[31m
    YELLOW := \033[33m
    BLUE := \033[34m
    NC := \033[0m
endif

help: ## Affiche cette aide
	@echo "$(BLUE)EXAI - Commandes Make disponibles$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

check-prerequisites: ## Vérifie que tous les outils requis sont installés
	@echo "$(BLUE)Verification des prerequis...$(NC)"
	@command -v docker >/dev/null 2>&1 || { echo "$(RED)Docker n'est pas installe$(NC)"; exit 1; }
	@command -v minikube >/dev/null 2>&1 || { echo "$(RED)Minikube n'est pas installe$(NC)"; exit 1; }
	@command -v kubectl >/dev/null 2>&1 || { echo "$(RED)kubectl n'est pas installe$(NC)"; exit 1; }
	@command -v skaffold >/dev/null 2>&1 || { echo "$(RED)Skaffold n'est pas installe$(NC)"; exit 1; }
	@command -v python >/dev/null 2>&1 || { echo "$(RED)Python n'est pas installe$(NC)"; exit 1; }
	@test -f .env || { echo "$(RED)Fichier .env manquant$(NC)"; exit 1; }
	@echo "$(GREEN)Tous les prerequis sont satisfaits$(NC)"

update-secrets: ## Met à jour les secrets Kubernetes avec les valeurs du .env
	@echo "$(BLUE)Mise a jour des secrets Kubernetes...$(NC)"
	@python -m scripts.update-local-secrets
	@echo "$(GREEN)Secrets mis a jour$(NC)"

start-minikube: ## Démarre Minikube avec configuration optimale
	@echo "$(BLUE)Demarrage de Minikube...$(NC)"
	@minikube status >/dev/null 2>&1 || minikube start --memory 4096 --cpus 2 --disk-size 20g
	@minikube addons enable ingress
	@minikube addons enable storage-provisioner
	@echo "$(GREEN)Minikube demarre$(NC)"

create-namespace: ## Crée le namespace Kubernetes
	@echo "$(BLUE)Creation du namespace $(NAMESPACE)...$(NC)"
	@kubectl create namespace $(NAMESPACE) 2>/dev/null || echo "$(YELLOW)Namespace $(NAMESPACE) existe deja$(NC)"
	@echo "$(GREEN)Namespace pret$(NC)"

docker-env: ## Configure l'environnement Docker pour Minikube
	@echo "$(BLUE)Configuration de l'environnement Docker...$(NC)"
	@eval $$(minikube docker-env) && echo "$(GREEN)Environnement Docker configure$(NC)"

deploy: ## Déploie l'application avec Skaffold
	@echo "$(BLUE)Deploiement de l'application...$(NC)"
	@eval $$(minikube docker-env) && skaffold run --profile=local --namespace=$(NAMESPACE)
	@echo "$(GREEN)Application deployee$(NC)"
	@echo "$(BLUE)Creation des tags latest pour les jobs...$(NC)"
	@eval $$(minikube docker-env) && \
	docker tag $$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "exai-api-gateway" | head -1) exai-api-gateway:latest && \
	docker tag $$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "service-selection" | head -1) service-selection:latest || true
	@echo "$(GREEN)Tags latest crees$(NC)"

wait-services: ## Attend que tous les services soient prêts
	@echo "$(BLUE)Attente de la disponibilite des services...$(NC)"
	@echo "$(YELLOW)Attente PostgreSQL...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=postgresql -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Timeout PostgreSQL$(NC)"; exit 1; }
	@echo "$(YELLOW)Attente MinIO...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=minio -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Timeout MinIO$(NC)"; exit 1; }
	@echo "$(YELLOW)Attente API Gateway...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Timeout API Gateway$(NC)"; exit 1; }
	@echo "$(YELLOW)Attente Service Selection...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=service-selection -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Timeout Service Selection$(NC)"; exit 1; }
	@echo "$(GREEN)Tous les services sont prets$(NC)"

migrate-jobs: ## Lance les migrations via les jobs Kubernetes
	@echo "$(BLUE)Lancement des migrations via jobs Kubernetes...$(NC)"
	@echo "$(YELLOW)Suppression des anciens jobs...$(NC)"
	@kubectl delete job api-gateway-migration-job -n $(NAMESPACE) 2>/dev/null || true
	@kubectl delete job service-selection-migration-job -n $(NAMESPACE) 2>/dev/null || true
	@echo "$(YELLOW)Lancement job migration API Gateway...$(NC)"
	@kubectl apply -f k8s/base/jobs/api-gateway-migration-job.yaml -n $(NAMESPACE)
	@kubectl wait --for=condition=complete job/api-gateway-migration-job -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Echec migration API Gateway$(NC)"; kubectl logs job/api-gateway-migration-job -n $(NAMESPACE); exit 1; }
	@echo "$(YELLOW)Lancement job migration Service Selection...$(NC)"
	@kubectl apply -f k8s/base/jobs/service-selection-migration-job.yaml -n $(NAMESPACE)
	@kubectl wait --for=condition=complete job/service-selection-migration-job -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Echec migration Service Selection$(NC)"; kubectl logs job/service-selection-migration-job -n $(NAMESPACE); exit 1; }
	@echo "$(GREEN)Toutes les migrations terminees avec succes$(NC)"

migrate: wait-services migrate-jobs ## Lance les migrations (attend les services puis lance les jobs)

init-data: ## Initialise les vrais datasets dans la base de données (via exec)
	@echo "$(BLUE)Initialisation des vrais datasets...$(NC)"
	@echo "$(YELLOW)Execution du script d'initialisation avec vrais datasets...$(NC)"
	@kubectl exec -n $(NAMESPACE) deployment/service-selection -- python scripts/init_datasets.py social
	@echo "$(GREEN)Vrais datasets initialises avec succes$(NC)"

init-data-job: ## Lance l'initialisation des datasets via un job Kubernetes (pour production)
	@echo "$(BLUE)Lancement du job d'initialisation des vrais datasets...$(NC)"
	@echo "$(YELLOW)Suppression de l'ancien job...$(NC)"
	@kubectl delete job service-selection-data-init-job -n $(NAMESPACE) 2>/dev/null || true
	@echo "$(YELLOW)Lancement du job d'initialisation...$(NC)"
	@kubectl apply -f k8s/base/jobs/service-selection-data-init-job.yaml -n $(NAMESPACE)
	@kubectl wait --for=condition=complete job/service-selection-data-init-job -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Echec initialisation datasets$(NC)"; kubectl logs job/service-selection-data-init-job -n $(NAMESPACE); exit 1; }
	@echo "$(GREEN)Vrais datasets initialises avec succes via job$(NC)"

dev: check-prerequisites update-secrets start-minikube create-namespace docker-env deploy migrate logs ## Installation complète et démarrage en mode développement

dev-with-data: check-prerequisites update-secrets start-minikube create-namespace docker-env deploy migrate init-data logs ## Installation complète avec vrais datasets automatiques

quick-dev: update-secrets deploy migrate ## Déploiement rapide (si Minikube déjà démarré)

logs: ## Affiche les logs en temps réel
	@echo "$(BLUE)Demarrage des logs en temps reel...$(NC)"
	@echo "$(YELLOW)Acces aux services :$(NC)"
	@echo "  $(GREEN)Frontend:$(NC) http://localhost:8080"
	@echo "  $(GREEN)API Gateway:$(NC) http://localhost:9000"
	@echo "  $(GREEN)API Docs:$(NC) http://localhost:9000/docs"
	@echo ""
	@echo "$(YELLOW)Appuyez sur Ctrl+C pour arreter les logs$(NC)"
	@echo ""
	@skaffold dev --profile=local --namespace=$(NAMESPACE)

stop: ## Arrête l'application
	@echo "$(BLUE)Arret de l'application...$(NC)"
	@skaffold delete --profile=local --namespace=$(NAMESPACE) || true
	@echo "$(GREEN)Application arretee$(NC)"

clean-migrations: ## Supprime les jobs de migration
	@echo "$(BLUE)Nettoyage des jobs de migration...$(NC)"
	@kubectl delete job api-gateway-migration-job -n $(NAMESPACE) 2>/dev/null || true
	@kubectl delete job service-selection-migration-job -n $(NAMESPACE) 2>/dev/null || true
	@echo "$(GREEN)Jobs de migration supprimes$(NC)"

clean: stop clean-migrations ## Nettoyage complet
	@echo "$(BLUE)Nettoyage complet...$(NC)"
	@kubectl delete namespace $(NAMESPACE) 2>/dev/null || true
	@echo "$(GREEN)Nettoyage termine$(NC)"

reset: clean dev ## Reset complet (nettoyage + redémarrage)

reset-secrets: ## Remet les placeholders dans les fichiers de secrets
	@echo "$(BLUE)Remise des placeholders...$(NC)"
	@python -m scripts.reset-placeholders
	@echo "$(GREEN)Placeholders restaures$(NC)" 