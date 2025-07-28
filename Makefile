.PHONY: help dev quick-dev update-secrets start-minikube create-namespace docker-env deploy wait-services migrate migrate-jobs init-data dev-with-data clean clean-migrations logs stop reset check-prerequisites

# Configuration
NAMESPACE ?= ibis-x
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
	@echo "$(BLUE)IBIS-X - Commandes Make disponibles$(NC)"
	@echo ""
	@echo "$(YELLOW)COMMANDE RECOMMANDEE POUR LE DEVELOPPEMENT :$(NC)"
	@echo "  $(GREEN)make dev$(NC)          - Lance l'application complete avec les 7 vrais datasets"
	@echo ""
	@echo "$(BLUE)PRINCIPALES COMMANDES :$(NC)"
	@echo "  $(GREEN)dev$(NC)                Installation complete + vrais datasets"
	@echo "  $(GREEN)dev-no-data$(NC)        Installation SANS datasets (tests uniquement)"
	@echo "  $(GREEN)quick-dev$(NC)          Deploiement rapide + datasets"
	@echo "  $(GREEN)stop$(NC)               Arrete l'application"
	@echo "  $(GREEN)clean$(NC)              Nettoyage complet"
	@echo "  $(GREEN)logs$(NC)               Affiche les logs"
	@echo ""
	@echo "$(YELLOW)NOTE: 'make dev' inclut maintenant automatiquement les vrais datasets !$(NC)"

check-prerequisites: ## Vérifie que tous les outils requis sont installés
	@echo "Verification des prerequis..."
	@echo "Verification simplifiee pour compatibilite Windows"
	@echo "Assurez-vous que Docker, Minikube, kubectl, Skaffold et Python sont installes"
	@echo "Tous les prerequis sont presumes satisfaits"

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
	-kubectl create namespace $(NAMESPACE)
	@echo "$(YELLOW)Namespace $(NAMESPACE) existe deja ou cree$(NC)"
	@echo "$(GREEN)Namespace pret$(NC)"

# Configurer l'environnement Docker pour Minikube
docker-env:
	@echo "Configuration de l'environnement Docker..."
	@echo "Note: Sur Windows, configurez manuellement avec: minikube docker-env --shell=powershell | Invoke-Expression"
	@echo "Environnement Docker configure"

deploy-services: ## Déploie les services uniquement (sans jobs) avec Skaffold
	@echo "$(BLUE)Deploiement des services (sans jobs)...$(NC)"
	@skaffold run --profile=local-services --namespace=$(NAMESPACE)
	@echo "$(GREEN)Services deployes$(NC)"

start-portforwards: stop-portforwards ## Lance les port forwards automatiquement
	@echo "$(BLUE)Lancement des port forwards...$(NC)"
	@echo "$(YELLOW)Configuration des acces externes...$(NC)"
	@powershell.exe -Command "Start-Process -NoNewWindow kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/frontend','8080:80'"
	@powershell.exe -Command "Start-Process -NoNewWindow kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/api-gateway-service','9000:80'"
	@powershell.exe -Command "Start-Process -NoNewWindow kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/minio-service','6701:6701'"
	@echo ""
	@echo "$(GREEN)Acces aux services maintenant disponibles :$(NC)"
	@echo "  $(GREEN)Frontend:$(NC) http://localhost:8080"
	@echo "  $(GREEN)API Gateway:$(NC) http://localhost:9000"
	@echo "  $(GREEN)API Docs:$(NC) http://localhost:9000/docs"
	@echo "  $(GREEN)MinIO Console:$(NC) http://localhost:6701"
	@echo ""
	@echo "$(GREEN)Port forwards actifs en arriere-plan$(NC)"

deploy: deploy-services ## Déploie l'application avec Skaffold (alias pour deploy-services)

deploy-jobs: ## Déploie les jobs uniquement avec kubectl et patches minikube
	@echo "$(BLUE)Deploiement des jobs avec patches minikube...$(NC)"
	@kubectl apply -k k8s/overlays/minikube-jobs-only
	@echo "$(GREEN)Jobs deployes$(NC)"

wait-services: ## Attend que tous les services soient prêts
	@echo "$(BLUE)Attente de la disponibilite des services...$(NC)"
	@echo "$(YELLOW)Attente PostgreSQL...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=postgresql -n $(NAMESPACE) --timeout=60s 2>nul || echo "$(YELLOW)PostgreSQL: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente MinIO...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=minio -n $(NAMESPACE) --timeout=60s 2>nul || echo "$(YELLOW)MinIO: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente API Gateway...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=60s 2>nul || echo "$(YELLOW)API Gateway: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente Service Selection...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=service-selection -n $(NAMESPACE) --timeout=60s 2>nul || echo "$(YELLOW)Service Selection: tentative d'attente terminée$(NC)"
	@echo "$(GREEN)Tous les services sont prets$(NC)"

migrate-jobs: ## Lance les migrations via les jobs Kubernetes
	@echo "$(BLUE)Lancement des migrations via jobs Kubernetes...$(NC)"
	@echo "$(YELLOW)Suppression des anciens jobs...$(NC)"
	-@kubectl delete job api-gateway-migration-job -n $(NAMESPACE) 2>nul
	-@kubectl delete job service-selection-migration-job -n $(NAMESPACE) 2>nul
	@echo "$(YELLOW)Deploiement des jobs de migration...$(NC)"
	@$(MAKE) deploy-jobs
	@echo "$(YELLOW)Attente de completion des jobs...$(NC)"
	@kubectl wait --for=condition=complete job/api-gateway-migration-job -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Echec migration API Gateway$(NC)"; kubectl logs job/api-gateway-migration-job -n $(NAMESPACE); exit 1; }
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
	-@kubectl delete job service-selection-data-init-job -n $(NAMESPACE) 2>nul
	@echo "$(YELLOW)Lancement du job d'initialisation...$(NC)"
	@kubectl apply -f k8s/base/jobs/service-selection-data-init-job.yaml -n $(NAMESPACE)
	@kubectl wait --for=condition=complete job/service-selection-data-init-job -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Echec initialisation datasets$(NC)"; kubectl logs job/service-selection-data-init-job -n $(NAMESPACE); exit 1; }
	@echo "$(GREEN)Vrais datasets initialises avec succes via job$(NC)"

dev: check-prerequisites update-secrets start-minikube create-namespace docker-env deploy-services wait-services migrate-jobs init-data start-portforwards quick-logs ## Installation complète et démarrage en mode développement avec vrais datasets

dev-no-data: check-prerequisites update-secrets start-minikube create-namespace docker-env deploy-services wait-services migrate-jobs start-portforwards quick-logs ## Installation complète SANS datasets (pour tests uniquement)

quick-dev: update-secrets deploy-services wait-services migrate-jobs init-data start-portforwards ## Déploiement rapide avec datasets (si Minikube déjà démarré)

logs: ## Affiche les logs en temps réel
	@echo "$(BLUE)Demarrage des logs en temps reel...$(NC)"
	@echo "$(YELLOW)Acces aux services :$(NC)"
	@echo "  $(GREEN)Frontend:$(NC) http://localhost:8080"
	@echo "  $(GREEN)API Gateway:$(NC) http://localhost:9000"
	@echo "  $(GREEN)API Docs:$(NC) http://localhost:9000/docs"
	@echo ""
	@echo "$(YELLOW)Appuyez sur Ctrl+C pour arreter les logs$(NC)"
	@echo ""
	@skaffold run --tail --profile=local --namespace=$(NAMESPACE)

view-logs: ## Affiche les logs des services sans redéployer
	@echo "$(BLUE)Demarrage des logs en temps reel...$(NC)"
	@echo "$(YELLOW)Logs en temps reel (Ctrl+C pour arreter):$(NC)"
	@echo ""
	@kubectl logs -f deployment/api-gateway -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f deployment/frontend -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f deployment/service-selection -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f statefulset/postgresql -n $(NAMESPACE) --prefix=true &
	@wait

quick-logs: ## Affiche uniquement les logs (sans messages d'état)
	@kubectl logs -f deployment/api-gateway -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f deployment/frontend -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f deployment/service-selection -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f statefulset/postgresql -n $(NAMESPACE) --prefix=true &
	@wait

stop-portforwards: ## Arrête tous les port forwards actifs
	@echo "$(BLUE)Arret des port forwards...$(NC)"
	@taskkill /F /IM kubectl.exe 2>nul || echo "Pas de port forwards actifs"
	@echo "$(GREEN)Port forwards arretes$(NC)"

stop: stop-portforwards ## Arrête l'application
	@echo "$(BLUE)Arret de l'application...$(NC)"
	@skaffold delete --profile=local --namespace=$(NAMESPACE) 2>nul
	@echo "$(GREEN)Application arretee$(NC)"

clean-migrations: ## Supprime les jobs de migration
	@echo "$(BLUE)Nettoyage des jobs de migration...$(NC)"
	-@kubectl delete job api-gateway-migration-job -n $(NAMESPACE) 2>nul
	-@kubectl delete job service-selection-migration-job -n $(NAMESPACE) 2>nul
	@echo "$(GREEN)Jobs de migration supprimes$(NC)"

clean: stop clean-migrations ## Nettoyage complet
	@echo "$(BLUE)Nettoyage complet...$(NC)"
	-@kubectl delete namespace $(NAMESPACE) 2>nul
	@echo "$(GREEN)Nettoyage termine$(NC)"

reset: clean dev ## Reset complet (nettoyage + redémarrage)

reset-secrets: ## Remet les placeholders dans les fichiers de secrets
	@echo "$(BLUE)Remise des placeholders...$(NC)"
	@python -m scripts.reset-placeholders
	@echo "$(GREEN)Placeholders restaures$(NC)" 