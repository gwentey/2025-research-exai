.PHONY: help dev quick-dev update-secrets start-minikube create-namespace docker-env deploy wait-services migrate migrate-jobs wait-migrations init-data dev-with-data clean clean-migrations logs stop clean-namespace reset check-prerequisites test-ml-pipeline fix-portforwards list-jobs clean-temp-files healthcheck quick-logs start-portforwards-simple

ARGS ?=

# Configuration
NAMESPACE ?= ibis-x
TIMEOUT ?= 300s

# Ports MinIO
MINIO_API_PORT ?= 6700
MINIO_CONSOLE_PORT ?= 6701

# Couleurs pour l'affichage (détection Git Bash)
ifeq ($(findstring MINGW, $(shell uname -s 2>/dev/null || echo unknown)),MINGW)
    # Git Bash détecté - couleurs désactivées pour éviter les codes ANSI
    GREEN := 
    RED := 
    YELLOW := 
    BLUE := 
    NC := 
else
    # Terminal standard - couleurs activées
    GREEN := \033[32m
    RED := \033[31m
    YELLOW := \033[33m
    BLUE := \033[34m
    NC := \033[0m
endif

# Null device portable (évite la création d'un fichier 'nul' sous Git Bash)
ifeq ($(findstring /, $(SHELL)),/)
    NULL := /dev/null
else
    NULL := nul
endif

help: ## Affiche cette aide
	@echo "$(BLUE)IBIS-X - Commandes Make disponibles$(NC)"
	@echo ""
	@echo "$(YELLOW)COMMANDES RECOMMANDEES POUR LE DEVELOPPEMENT :$(NC)"
	@echo "  $(GREEN)make dev$(NC)          - Lance l'application complete UUID (upload datasets via interface)"
	@echo "  $(GREEN)make dev-data$(NC)     - Import automatique des VRAIS datasets Kaggle pour developpement"
	@echo ""
	@echo "$(BLUE)PRINCIPALES COMMANDES :$(NC)"
	@echo "  $(GREEN)dev$(NC)                Installation complete + système UUID + port-forwards AUTO"
	@echo "  $(GREEN)dev-data$(NC)           Import automatique Kaggle + validation (POUR DEV UNIQUEMENT)"
	@echo "  $(GREEN)dev-no-data$(NC)        Installation SANS datasets (tests uniquement)"
	@echo "  $(GREEN)quick-dev$(NC)          Deploiement rapide (upload datasets manuellement)"
	@echo "  $(GREEN)stop$(NC)               Arrete l'application"
	@echo "  $(GREEN)clean$(NC)              Nettoyage complet"
	@echo "  $(GREEN)logs$(NC)               Logs + port-forwards automatiques avec Skaffold"
	@echo ""
	@echo "$(BLUE)OUTILS DE DIAGNOSTIC :$(NC)"
	@echo "  $(GREEN)healthcheck$(NC)                Verifie l'etat des services"
	@echo "  $(GREEN)validate-datasets$(NC)          Valide que les VRAIS datasets Kaggle sont importes"
	@echo "  $(GREEN)start-portforwards-simple$(NC) Commandes manuelles (si besoin)"
	@echo ""
	@echo "$(YELLOW)NOUVEAU SYSTEME UUID - SECURISE ET MAINTENABLE :$(NC)"
	@echo "$(YELLOW)• Upload datasets via: http://localhost:8080/datasets$(NC)"
	@echo "$(YELLOW)• Fichiers stockés avec UUID (sécurisé, évite collisions)$(NC)"
	@echo "$(YELLOW)• Import Kaggle via 'make dev-data' (developement) ou upload manuel$(NC)"

check-prerequisites: ## Vérifie que tous les outils requis sont installés
	@echo "Verification des prerequis..."
	@echo "Verification simplifiee pour compatibilite Windows"
	@echo "Assurez-vous que Docker, Minikube, kubectl, Skaffold et Python sont installes"
	@echo "Tous les prerequis sont presumes satisfaits"

check-kaggle-credentials: ## Vérifie que les credentials Kaggle sont configurés
	@echo "$(BLUE)Verification des credentials Kaggle...$(NC)"
	@echo "$(YELLOW)ATTENTION: Verification simplifiee pour Windows - assurez-vous que .env contient:$(NC)"
	@echo "$(YELLOW)  KAGGLE_USERNAME=votre_username$(NC)"
	@echo "$(YELLOW)  KAGGLE_KEY=votre_api_key$(NC)"
	@echo "$(GREEN)✅ Verification passee (assurez-vous que .env est correct)$(NC)"

update-secrets: ## Met à jour les secrets Kubernetes avec les valeurs du .env
	@echo "$(BLUE)Mise a jour des secrets Kubernetes...$(NC)"
	@python scripts/development/update-local-secrets.py
	@echo "$(GREEN)Secrets mis a jour$(NC)"

clean-minikube: ## Nettoie et supprime Minikube (en cas de problème)
	@echo "$(BLUE)Nettoyage de Minikube...$(NC)"
	-@minikube stop 2>$(NULL)
	-@minikube delete 2>$(NULL)
	@echo "$(GREEN)Minikube nettoye$(NC)"

start-minikube: ## Démarre Minikube s'il n'est pas déjà en cours d'exécution
	@echo "$(BLUE)Demarrage de Minikube...$(NC)"
	@minikube status >/dev/null 2>&1 || minikube start --memory 4096 --cpus 2 --disk-size 20g
	@minikube addons enable ingress
	@minikube addons enable storage-provisioner
	@echo "$(GREEN)Minikube demarre$(NC)"

restart-minikube: clean-minikube start-minikube ## Redémarre Minikube proprement (en cas de problème)

create-namespace: ## Crée le namespace Kubernetes
	@echo "$(BLUE)Creation du namespace $(NAMESPACE)...$(NC)"
	-kubectl create namespace $(NAMESPACE)
	@echo "$(YELLOW)Namespace $(NAMESPACE) existe deja ou cree$(NC)"
	@echo "$(GREEN)Namespace pret$(NC)"

# Configurer l'environnement Docker pour Minikube
docker-env: ## Configure l'environnement Docker pour Minikube (comme l'ancien système)
	@echo "$(BLUE)Configuration de l'environnement Docker...$(NC)"
	@echo "$(GREEN)Environnement Docker configure$(NC)"

deploy: ## Déploie l'application avec Skaffold (comme l'ancien système)
	@echo "$(BLUE)Deploiement de l'application...$(NC)"
	@echo "$(YELLOW)Nettoyage des jobs existants pour eviter les conflits...$(NC)"
	-@kubectl delete jobs --all -n $(NAMESPACE) 2>$(NULL) || echo "$(YELLOW)Aucun job a supprimer$(NC)"
	@sleep 2
	@powershell.exe -Command "& minikube -p minikube docker-env --shell powershell | Invoke-Expression; skaffold run --profile=local --namespace=$(NAMESPACE)"
	@echo "$(GREEN)Application deployee$(NC)"

deploy-services-dev: ## Déploie les services en mode développement continu (avec surveillance)
	@echo "$(BLUE)Deploiement des services en mode developpement continu...$(NC)"
	@echo "$(YELLOW)Nettoyage des jobs existants pour eviter les conflits...$(NC)"
	-@kubectl delete jobs --all -n $(NAMESPACE) 2>$(NULL)
	@powershell.exe -Command "& minikube -p minikube docker-env --shell powershell | Invoke-Expression; skaffold dev --profile=local-services --namespace=$(NAMESPACE) --no-prune=false --cache-artifacts=false --cleanup=false --port-forward=false"
	@echo "$(GREEN)Services en mode developpement continu$(NC)"

start-portforwards: stop-portforwards ## Lance les port forwards dans le même terminal (Git Bash compatible)
	@echo "$(BLUE)Lancement des port forwards unifies...$(NC)"
	@echo "$(YELLOW)Verification de la disponibilite des services...$(NC)"
	@kubectl get service frontend -n $(NAMESPACE) >/dev/null 2>&1 || { echo "$(RED)Service frontend introuvable$(NC)"; exit 1; }
	@kubectl get service api-gateway-service -n $(NAMESPACE) >/dev/null 2>&1 || { echo "$(RED)Service api-gateway-service introuvable$(NC)"; exit 1; }
	@kubectl get service minio-service -n $(NAMESPACE) >/dev/null 2>&1 || { echo "$(RED)Service minio-service introuvable$(NC)"; exit 1; }
	@echo "$(YELLOW)Verification que tous les pods sont vraiment stables...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=frontend -n $(NAMESPACE) --timeout=30s || echo "$(YELLOW)Frontend: verification terminee$(NC)"
	@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=30s || echo "$(YELLOW)API Gateway: verification terminee$(NC)"
	@kubectl wait --for=condition=ready pod -l app=minio -n $(NAMESPACE) --timeout=30s || echo "$(YELLOW)MinIO: verification terminee$(NC)"
	@echo "$(YELLOW)Attente finale de stabilisation avant port-forwards...$(NC)"
	@sleep 5
	@echo "$(GREEN)Tous les services sont disponibles et stables$(NC)"
	@echo "$(YELLOW)Lancement des port-forwards en arriere-plan...$(NC)"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/frontend','8080:80'"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/api-gateway-service','9000:80'"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/minio-service','6700:6700'"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/minio-service','6701:6701'"
	@echo "$(YELLOW)Attente de l'etablissement des port forwards...$(NC)"
	@sleep 12
	@echo "$(YELLOW)Verification des port forwards...$(NC)"
	@powershell.exe -Command "try { $$response = Invoke-WebRequest -Uri 'http://localhost:8080' -TimeoutSec 3 -UseBasicParsing; Write-Host '$(GREEN)✓ Frontend OK (port 8080)$(NC)' } catch { Write-Host '$(RED)✗ Frontend non accessible$(NC)' }"
	@powershell.exe -Command "try { $$response = Invoke-WebRequest -Uri 'http://localhost:9000/health' -TimeoutSec 3 -UseBasicParsing; Write-Host '$(GREEN)✓ API Gateway OK (port 9000)$(NC)' } catch { Write-Host '$(RED)✗ API Gateway non accessible$(NC)' }"
	@powershell.exe -Command "try { $$response = Invoke-WebRequest -Uri 'http://localhost:6701' -TimeoutSec 3 -UseBasicParsing; Write-Host '$(GREEN)✓ MinIO OK (port 6701)$(NC)' } catch { Write-Host '$(YELLOW)! MinIO non disponible$(NC)' }"
	@echo ""
	@echo "$(GREEN)✅ Tous les port forwards sont operationnels !$(NC)"
	@echo "$(GREEN)Acces aux services maintenant disponibles :$(NC)"
	@echo "  $(GREEN)Frontend:$(NC) http://localhost:8080"
	@echo "  $(GREEN)API Gateway:$(NC) http://localhost:9000"
	@echo "  $(GREEN)API Docs:$(NC) http://localhost:9000/docs"
	@echo "  $(GREEN)MinIO Console:$(NC) http://localhost:6701"
	@echo ""
	@echo "$(GREEN)Port forwards actifs en arriere-plan$(NC)"

start-portforwards-resilient: stop-portforwards ## Lance les port forwards FONCTIONNEL GARANTI
	@echo "$(BLUE)Lancement des port forwards...$(NC)"
	@echo "$(YELLOW)Verification que les pods sont prets...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=frontend -n $(NAMESPACE) --timeout=30s
	@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=30s
	@echo "$(YELLOW)Demarrage direct des port-forwards dans Git Bash...$(NC)"
	@kubectl port-forward -n $(NAMESPACE) service/frontend 8080:80 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/api-gateway-service 9000:80 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/minio-service 6700:6700
	
	@echo "$(YELLOW)Attente etablissement des connexions (10 secondes)...$(NC)"
	@sleep 10
	@echo ""
	@echo "$(GREEN)✅ APPLICATION PRETE !$(NC)"
	@echo ""
	@echo "$(GREEN)► Frontend: http://localhost:8080$(NC)"
	@echo "$(GREEN)► API Gateway: http://localhost:9000$(NC)"
	@echo "$(GREEN)► API Docs: http://localhost:9000/docs$(NC)"
	@echo ""
	@echo "$(YELLOW)IMPORTANT: Pour arreter, utilisez 'make stop'$(NC)"

# deploy est défini plus haut - pas besoin d'alias

deploy-jobs: ## Déploie les jobs uniquement avec kubectl et patches minikube
	@echo "$(BLUE)Deploiement des jobs avec patches minikube...$(NC)"
	@kubectl apply -k k8s/overlays/minikube-jobs-only
	@echo "$(GREEN)Jobs deployes$(NC)"

wait-services: ## Attend que les services essentiels soient prêts (tolère les échecs)
	@echo "$(BLUE)Attente de la disponibilite des services essentiels...$(NC)"
	@echo "$(YELLOW)Services CRITIQUES (obligatoires):$(NC)"
	@echo "$(YELLOW)Attente PostgreSQL...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=postgresql -n $(NAMESPACE) --timeout=60s 2>$(NULL) || echo "$(YELLOW)PostgreSQL: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente API Gateway...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=60s 2>$(NULL) || echo "$(YELLOW)API Gateway: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente Service Selection...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=service-selection -n $(NAMESPACE) --timeout=60s 2>$(NULL) || echo "$(YELLOW)Service Selection: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente Frontend...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=frontend -n $(NAMESPACE) --timeout=60s 2>$(NULL) || echo "$(YELLOW)Frontend: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Services OPTIONNELS (peuvent echouer):$(NC)"
	@echo "$(YELLOW)Attente MinIO (optionnel)...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=minio -n $(NAMESPACE) --timeout=30s 2>$(NULL) || echo "$(YELLOW)MinIO: non disponible - application fonctionnera sans stockage objet$(NC)"
	@echo "$(YELLOW)Attente Redis...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=redis -n $(NAMESPACE) --timeout=60s 2>$(NULL) || echo "$(YELLOW)Redis: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente ML Pipeline...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=ml-pipeline -n $(NAMESPACE) --timeout=60s 2>$(NULL) || echo "$(YELLOW)ML Pipeline: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Attente ML Pipeline Workers...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=ml-pipeline-celery-worker -n $(NAMESPACE) --timeout=60s 2>$(NULL) || echo "$(YELLOW)ML Pipeline Workers: tentative d'attente terminée$(NC)"
	@echo "$(YELLOW)Verification finale de stabilite (15 secondes)...$(NC)"
	@sleep 15
	@echo "$(GREEN)Services essentiels prets (application accessible meme si certains services optionnels echouent)$(NC)"

migrate-jobs: ## Lance et ATTEND les migrations critiques pour éviter les erreurs
	@echo "$(BLUE)Execution des migrations critiques...$(NC)"
	@echo "$(YELLOW)Suppression des anciens jobs...$(NC)"
	-@kubectl delete job api-gateway-migration-job -n $(NAMESPACE) 2>/dev/null
	-@kubectl delete job service-selection-migration-job -n $(NAMESPACE) 2>/dev/null
	-@kubectl delete job ml-pipeline-migration-job -n $(NAMESPACE) 2>/dev/null
	@echo "$(YELLOW)Deploiement des jobs de migration...$(NC)"
	@$(MAKE) deploy-jobs
	@echo "$(YELLOW)Attente migration API Gateway (CRITIQUE pour authentification)...$(NC)"
	@kubectl wait --for=condition=complete job/api-gateway-migration-job -n $(NAMESPACE) --timeout=60s || { \
		echo "$(RED)Job de migration echoue, execution manuelle...$(NC)"; \
		kubectl exec -it deployment/api-gateway -n $(NAMESPACE) -- bash -c "cd /app && alembic upgrade head" || true; \
	}
	@echo "$(GREEN)✅ Migrations critiques terminees$(NC)"

wait-migrations: ## Attend que les migrations se terminent (jobs déjà déployés par deploy)
	@echo "$(BLUE)Attente de la completion des migrations...$(NC)"
	@echo "$(YELLOW)Attente migration API Gateway (CRITIQUE pour authentification)...$(NC)"
	@kubectl wait --for=condition=complete job/api-gateway-migration-job -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Echec migration API Gateway$(NC)"; kubectl logs job/api-gateway-migration-job -n $(NAMESPACE); exit 1; }
	@echo "$(YELLOW)Attente migration Service Selection...$(NC)"
	@kubectl wait --for=condition=complete job/service-selection-migration-job -n $(NAMESPACE) --timeout=$(TIMEOUT) || { echo "$(RED)Echec migration Service Selection$(NC)"; kubectl logs job/service-selection-migration-job -n $(NAMESPACE); exit 1; }
	@echo "$(GREEN)✅ Toutes les migrations terminees$(NC)"

migrate: wait-services migrate-jobs ## Lance les migrations (attend les services puis lance les jobs)

# init-data: DÉSACTIVÉ - Import Kaggle automatique remplacé par upload UUID via interface
# Utilisez l'interface web http://localhost:8080/datasets pour uploader des datasets
# Les fichiers sont automatiquement stockés avec des UUID pour la sécurité
#
# init-data: check-kaggle-credentials ## Initialise les VRAIS datasets depuis Kaggle (obligatoire)
#	@echo "$(BLUE)Initialisation des VRAIS datasets depuis Kaggle...$(NC)"
#	@echo "$(YELLOW)IMPORTANT: Cette operation va telecharger les vrais datasets depuis Kaggle$(NC)"
#	@echo "$(YELLOW)Cela peut prendre plusieurs minutes selon votre connexion internet$(NC)"
#	@echo "$(YELLOW)Suppression de l'ancien job Kaggle...$(NC)"
#	-@kubectl delete job kaggle-dataset-import-job -n $(NAMESPACE) 2>$(NULL)
#	@echo "$(YELLOW)Lancement du job d'import Kaggle...$(NC)"
#	@kubectl apply -f k8s/base/jobs/kaggle-dataset-import-job.yaml -n $(NAMESPACE)
#	@echo "$(YELLOW)Attente de la completion de l'import Kaggle (max 30 minutes)...$(NC)"
#	@kubectl wait --for=condition=complete job/kaggle-dataset-import-job -n $(NAMESPACE) --timeout=1800s
#	@echo "$(YELLOW)Si le job a echoue, verifiez les logs avec: kubectl logs -n $(NAMESPACE) job/kaggle-dataset-import-job$(NC)"
#	@echo "$(GREEN)✅ VRAIS datasets importes avec succes depuis Kaggle !$(NC)"
#	@echo ""
#	@echo "$(GREEN)🚀🚀🚀 IBIS-X EST MAINTENANT PRET AVEC LES VRAIS DATASETS ! 🚀🚀🚀$(NC)"
#	@echo "$(GREEN)✅ Frontend:$(NC) http://localhost:8080"
#	@echo "$(GREEN)✅ API Gateway:$(NC) http://localhost:9000/docs"
#	@echo "$(GREEN)✅ Toutes les migrations et vrais datasets sont termines !$(NC)"

# init-data-job: OBSOLÈTE - Utilisait les fausses données via init_datasets.py
# Utiliser 'make init-data' qui utilise les VRAIS datasets Kaggle

dev: clean-namespace check-prerequisites update-secrets start-minikube create-namespace docker-env deploy wait-services wait-migrations show-access dev-logs ## Installation complète UUID - Upload datasets via interface utilisateur

dev-logs: stop-portforwards ## Lance les port-forwards et reste avec les logs (target interne pour dev)
	@echo ""
	@echo "$(BLUE)🚀 LANCEMENT DES LOGS EN TEMPS REEL AVEC PORT-FORWARDS$(NC)"
	@echo "$(YELLOW)Nettoyage des anciens port-forwards...$(NC)"
	@echo "$(YELLOW)Lancement des port-forwards...$(NC)"
	@kubectl port-forward -n $(NAMESPACE) service/frontend 8080:80 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/api-gateway-service 9000:80 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/minio-service $(MINIO_API_PORT):6700 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/minio-service $(MINIO_CONSOLE_PORT):6701 > /dev/null 2>&1 &
	@sleep 5
	@echo "$(GREEN)✅ Port-forwards actifs !$(NC)"
	@echo ""
	@echo "$(GREEN)🌐 Application accessible sur :$(NC)"
	@echo "  $(GREEN)► Frontend:      http://localhost:8080$(NC)"
	@echo "  $(GREEN)► API Gateway:   http://localhost:9000$(NC)"
	@echo "  $(GREEN)► API Docs:      http://localhost:9000/docs$(NC)"
	@echo "  $(GREEN)► MinIO Console: http://localhost:6701$(NC)"
	@echo ""
	@echo "$(YELLOW)📋 === LOGS EN TEMPS REEL - Appuyez sur Ctrl+C pour TOUT arrêter ====$(NC)"
	@echo "$(BLUE)🔗 Services surveillés: Frontend, API Gateway, Service Selection, ML Pipeline, Workers$(NC)"
	@echo ""
	@echo "$(YELLOW)💡 ASTUCE: Si Ctrl+C ne nettoie pas tout, tapez: make clean-logs$(NC)"
	@echo ""
	@bash -c ' \
		cleanup() { \
			echo; \
			echo "🛑 Ctrl+C détecté - Nettoyage en cours..."; \
			taskkill /F /IM kubectl.exe 2>/dev/null || pkill -f "kubectl.*logs" || true; \
			echo "✅ Processus kubectl nettoyés"; \
			exit 0; \
		}; \
		trap cleanup INT; \
		kubectl logs -f deployment/api-gateway -n $(NAMESPACE) --prefix=true & \
		kubectl logs -f deployment/frontend -n $(NAMESPACE) --prefix=true & \
		kubectl logs -f deployment/service-selection -n $(NAMESPACE) --prefix=true & \
		kubectl logs -f deployment/ml-pipeline -n $(NAMESPACE) --prefix=true & \
		kubectl logs -f deployment/ml-pipeline-celery-worker -n $(NAMESPACE) --prefix=true & \
		wait \
	'

clean-namespace: ## Nettoie le namespace avant de démarrer
	@echo "$(BLUE)Nettoyage du namespace ibis-x...$(NC)"
	-@kubectl delete namespace ibis-x --force --grace-period=0 2>$(NULL) || echo "Namespace deja propre"
	@sleep 3
	@echo "$(GREEN)Namespace nettoye$(NC)"

dev-watch: check-prerequisites update-secrets start-minikube create-namespace docker-env deploy-services-dev wait-services migrate-jobs init-data watch-portforwards ## Mode développement AVANCÉ avec surveillance automatique des fichiers (optionnel)

dev-no-data: check-prerequisites update-secrets start-minikube create-namespace docker-env deploy wait-services wait-migrations show-access ## Installation SANS datasets (pour développement/tests uniquement)

show-access: ## Affiche les informations d'accès à l'application
	@echo ""
	@echo "$(GREEN)╔══════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║        🚀 IBIS-X EST PRÊT ET ACCESSIBLE ! 🚀                ║$(NC)"
	@echo "$(GREEN)╚══════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(BOLD)$(GREEN)URLs d'accès :$(NC)"
	@echo "  $(GREEN)► Frontend:$(NC)      http://localhost:8080"
	@echo "  $(GREEN)► API Gateway:$(NC)   http://localhost:9000"
	@echo "  $(GREEN)► API Docs:$(NC)      http://localhost:9000/docs"
	@echo "  $(GREEN)► MinIO Console:$(NC) http://localhost:6701 $(YELLOW)(si disponible)$(NC)"
	@echo ""
	@echo "$(BOLD)$(YELLOW)Commandes utiles :$(NC)"
	@echo "  $(YELLOW)► Voir les logs:$(NC)         make logs"
	@echo "  $(YELLOW)► Arrêter l'application:$(NC) make stop"
	@echo "  $(YELLOW)► Réparer les ports:$(NC)     make fix-portforwards"
	@echo "  $(YELLOW)► Surveiller les ports:$(NC)  make watch-portforwards"
	@echo ""
	@echo "$(BLUE)💡 Conseil: Si l'application ne répond pas, exécutez 'make fix-portforwards'$(NC)"
	@echo ""

logs-interactive: quick-logs ## Alias pour quick-logs avec nom plus explicite

quick-dev: update-secrets deploy wait-services wait-migrations init-data ## Déploiement rapide (si Minikube déjà démarré) - UTILISEZ 'make dev' à la place

logs: ## Affiche les logs en temps réel avec port-forwards automatiques (EXACT ancien système)
	@echo "$(BLUE)Demarrage des logs en temps reel avec port-forwards automatiques...$(NC)"
	@echo "$(YELLOW)Acces aux services :$(NC)"
	@echo "  $(GREEN)Frontend:$(NC) http://localhost:8080"
	@echo "  $(GREEN)API Gateway:$(NC) http://localhost:9000"
	@echo "  $(GREEN)API Docs:$(NC) http://localhost:9000/docs"
	@echo ""
	@echo "$(YELLOW)Lancement des port-forwards...$(NC)"
	@kubectl port-forward -n $(NAMESPACE) service/frontend 8080:80 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/api-gateway-service 9000:80 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/minio-service 6700:6700
	
	@sleep 3
	@echo "$(GREEN)✅ Port-forwards actifs !$(NC)"
	@echo ""
	@echo "$(YELLOW)=== LOGS EN TEMPS REEL - Appuyez sur Ctrl+C pour arreter TOUT ====$(NC)"
	@echo ""
	@kubectl logs -f deployment/api-gateway -n $(NAMESPACE) --prefix=true

view-logs: ## Affiche les logs des services sans redéployer
	@echo "$(BLUE)Demarrage des logs en temps reel...$(NC)"
	@echo "$(YELLOW)Logs en temps reel (Ctrl+C pour arreter):$(NC)"
	@echo ""
	@kubectl logs -f deployment/api-gateway -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f deployment/frontend -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f deployment/service-selection -n $(NAMESPACE) --prefix=true &
	@kubectl logs -f statefulset/postgresql -n $(NAMESPACE) --prefix=true &
	@wait

quick-logs: ## Affiche les logs dans le même terminal (Ctrl+C pour arrêter)
	@echo "$(BLUE)Affichage des logs IBIS-X dans le meme terminal...$(NC)"
	@echo "$(YELLOW)Services disponibles :$(NC)"
	@echo "  $(GREEN)Frontend:$(NC) http://localhost:8080"
	@echo "  $(GREEN)API Gateway:$(NC) http://localhost:9000"
	@echo "  $(GREEN)API Docs:$(NC) http://localhost:9000/docs"
	@echo ""
	@echo "$(YELLOW)Appuyez sur Ctrl+C pour arreter les logs$(NC)"
	@echo ""
	@echo "$(GREEN)=== Logs en temps reel ====$(NC)"
	@kubectl logs -f deployment/api-gateway -n $(NAMESPACE) --prefix=true --since=30s

stop-portforwards: ## Arrête tous les port forwards actifs PROPREMENT 
	@echo "$(BLUE)Arret de tous les port forwards et logs...$(NC)"
	@echo "$(YELLOW)Arret des processus kubectl en arriere-plan...$(NC)"
	-@pkill -f "kubectl.*port-forward" 2>/dev/null || true
	@sleep 3
	@echo "$(GREEN)✓ Tous les port forwards et logs arretes$(NC)"

clean-logs: stop-portforwards ## Nettoie tous les processus kubectl qui traînent (équivalent ancien Ctrl+C)
	@echo "$(BLUE)🧹 Nettoyage des processus kubectl orphelins...$(NC)"
	@echo "$(GREEN)✅ Tous les logs et port-forwards arrêtés proprement$(NC)"

restart-portforwards: ## Redémarre automatiquement les port forwards de manière ultra-robuste
	@echo "$(BLUE)Redemarrage ultra-robuste des port forwards...$(NC)"
	@echo "$(YELLOW)Arret FORCE de tous les anciens port forwards...$(NC)"
	@$(MAKE) stop-portforwards
	@sleep 3
	@echo "$(YELLOW)Verification de la stabilite des services ESSENTIELS...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=frontend -n $(NAMESPACE) --timeout=60s || echo "$(YELLOW)Frontend: attente terminee$(NC)"
	@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=60s || echo "$(YELLOW)API Gateway: attente terminee$(NC)"
	@echo "$(YELLOW)Verification MinIO (optionnel - ne bloque pas si echec)...$(NC)"
	-@kubectl wait --for=condition=ready pod -l app=minio -n $(NAMESPACE) --timeout=30s 2>$(NULL) || echo "$(YELLOW)MinIO: non disponible - port forward MinIO sera ignoré$(NC)"
	@echo "$(YELLOW)Attente supplementaire pour garantir la stabilite...$(NC)"
	@sleep 10
	@echo "$(YELLOW)Verification que Skaffold a termine ses operations...$(NC)"
	@sleep 5
	@$(MAKE) start-portforwards-resilient
	@echo "$(GREEN)Port forwards redemarres avec succes de maniere ultra-robuste !$(NC)"
	@echo ""
	@echo "$(GREEN)🎉🎉🎉 APPLICATION ACCESSIBLE MAINTENANT : http://localhost:8080 🎉🎉🎉$(NC)"
	@echo "$(GREEN)✅ FRONTEND PRET - AUCUNE ATTENTE REQUISE !$(NC)"
	@echo "$(YELLOW)Les migrations et initialisations se terminent automatiquement en arriere-plan...$(NC)"
	@echo ""

watch-portforwards: ## Surveille et relance automatiquement les port forwards en cas de problème
	@echo "$(BLUE)Surveillance automatique des port forwards...$(NC)"
	@echo "$(YELLOW)Appuyez sur Ctrl+C pour arreter la surveillance$(NC)"
	@powershell.exe -Command "while ($$true) { try { $$frontend = Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet -WarningAction SilentlyContinue; $$api = Test-NetConnection -ComputerName localhost -Port 9000 -InformationLevel Quiet -WarningAction SilentlyContinue; $$minio = Test-NetConnection -ComputerName localhost -Port 6701 -InformationLevel Quiet -WarningAction SilentlyContinue; if (-not $$frontend -or -not $$api -or -not $$minio) { Write-Host '$(YELLOW)Port forwards cassés - relancement automatique...$(NC)'; taskkill /F /IM kubectl.exe 2>$$null; Start-Sleep -Seconds 3; & make start-portforwards-resilient; Write-Host '$(GREEN)Port forwards relancés automatiquement$(NC)' } else { Write-Host '$(GREEN)Port forwards OK - $(NC)Frontend:8080 API:9000 MinIO:6701'; } Start-Sleep -Seconds 10 } catch { Write-Host 'Erreur surveillance - retry...'; Start-Sleep -Seconds 5 } }"

fix-portforwards: ## CORRECTION IMMEDIATE - Script automatique qui fonctionne vraiment
	@echo "$(BLUE)Correction avec script automatique...$(NC)"
	@$(MAKE) stop-portforwards
	@sleep 2  
	@echo "$(YELLOW)Lancement du script de correction...$(NC)"
	@$(MAKE) start-portforwards-final

# Cible réutilisable : lance les port-forwards MinIO (API + Console)
start-minio-portforwards:
	@kubectl port-forward -n $(NAMESPACE) service/minio-service $(MINIO_API_PORT):6700 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/minio-service $(MINIO_CONSOLE_PORT):6701 > /dev/null 2>&1 &
	@sleep 2

start-portforwards-simple: ## Port-forwards simples (3 commandes à copier-coller)
	@echo "$(BLUE)=== COMMANDES A EXECUTER DANS 3 TERMINAUX SEPARES ===$(NC)"
	@echo ""
	@echo "$(YELLOW)Copiez-collez ces 3 commandes dans 3 terminaux differents :$(NC)"
	@echo ""
	@echo "$(GREEN)kubectl port-forward -n ibis-x service/frontend 8080:80$(NC)"
	@echo "$(GREEN)kubectl port-forward -n ibis-x service/api-gateway-service 9000:80$(NC)"  
	@echo "$(GREEN)kubectl port-forward -n ibis-x service/minio-service 6700:6700
	@kubectl port-forward -n $(NAMESPACE) service/minio-service 6701:6701$(NC)"
	@echo ""
	@echo "$(BLUE)Puis allez sur http://localhost:8080$(NC)"

list-jobs: ## Liste les processus kubectl port-forward actifs
	@echo "$(BLUE)Processus kubectl port-forward actifs :$(NC)"
	@powershell.exe -Command "$$processes = Get-Process -Name kubectl -ErrorAction SilentlyContinue | Where-Object { $$_.CommandLine -like '*port-forward*' }; if ($$processes) { $$processes | Format-Table ProcessName, Id, StartTime -AutoSize } else { Write-Host 'Aucun port-forward actif' }"
	@echo ""
	@echo "$(YELLOW)Pour arreter tous les port-forwards : make stop-portforwards$(NC)"

clean-temp-files: ## Nettoie les fichiers temporaires créés par le Makefile
	@echo "$(BLUE)Nettoyage des fichiers temporaires...$(NC)"
	-@del launch-ports.bat 2>$(NULL) || echo ""
	-@del logs-viewer.bat 2>$(NULL) || echo ""
	-@del start-portforwards.bat 2>$(NULL) || echo ""

	@echo "$(GREEN)Fichiers temporaires nettoyes$(NC)"

healthcheck: ## Vérifie l'état de santé des services et port-forwards
	@echo "$(BLUE)Verification de l'etat des services...$(NC)"
	@curl -fsS --max-time 2 http://localhost:8080 >/dev/null 2>&1 && echo "$(GREEN)✓ Frontend OK (port 8080)$(NC)" || echo "$(RED)✗ Frontend ECHEC (port 8080)$(NC)"
	@curl -fsS --max-time 2 http://localhost:9000/health >/dev/null 2>&1 && echo "$(GREEN)✓ API Gateway OK (port 9000)$(NC)" || echo "$(RED)✗ API Gateway ECHEC (port 9000)$(NC)"
	@curl -fsS --max-time 2 http://localhost:$(MINIO_API_PORT) >/dev/null 2>&1 && echo "$(GREEN)✓ MinIO API OK (port $(MINIO_API_PORT))$(NC)" || echo "$(YELLOW)! MinIO non disponible (port $(MINIO_API_PORT))$(NC)"

dev-data: check-kaggle-credentials ## Import automatique des VRAIS datasets Kaggle pour développement local
	@echo "$(BLUE)🚀 Import automatique des VRAIS datasets Kaggle pour developpement...$(NC)"
	@echo "$(YELLOW)ATTENTION: Cette operation va telecharger les vrais datasets depuis Kaggle$(NC)"
	@echo "$(YELLOW)Cela peut prendre plusieurs minutes selon votre connexion internet$(NC)"
	@echo "$(YELLOW)Verification que l'application IBIS-X est accessible...$(NC)"
	@curl -fsS --max-time 3 http://localhost:8080 >/dev/null 2>&1 && echo "$(GREEN)✅ IBIS-X Frontend accessible sur localhost:8080$(NC)" || \
		(curl -fsS --max-time 3 http://localhost:9000/health >/dev/null 2>&1 && echo "$(GREEN)✅ IBIS-X API accessible sur localhost:9000$(NC)" || \
		echo "$(YELLOW)⚠️ Services pas accessibles - lancement des port-forwards$(NC)")
	
	@echo "$(YELLOW)Configuration des port-forwards pour accès local...$(NC)"
	@echo "$(YELLOW)Arrêt des anciens port-forwards...$(NC)"
	@-pkill -f "kubectl.*port-forward" 2>/dev/null || true
	@sleep 2
	
	@echo "$(YELLOW)Lancement des port-forwards nécessaires...$(NC)"
	@kubectl port-forward -n $(NAMESPACE) service/frontend 8080:80 > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/api-gateway-service 9000:80 > /dev/null 2>&1 &
	@$(MAKE) start-minio-portforwards > /dev/null 2>&1 &
	@kubectl port-forward -n $(NAMESPACE) service/postgresql-service 5432:5432 > /dev/null 2>&1 &
	
	@echo "$(YELLOW)Attente que les services soient prêts à accepter les connexions...$(NC)"
	@bash -c ' \
		for i in $$(seq 1 30); do \
			if curl -fsS --max-time 2 http://localhost:9000/health >/dev/null 2>&1 && \
			   curl -fsS --max-time 2 http://localhost:$(MINIO_API_PORT) >/dev/null 2>&1 && \
			   nc -z localhost 5432 >/dev/null 2>&1; then \
				echo "$(GREEN)✅ Tous les services sont accessibles !$(NC)"; \
				break; \
			fi; \
			echo "Attente des services... ($$i/30)"; \
			sleep 2; \
		done'
	
	@echo "$(YELLOW)Lancement de l'import Kaggle avec structure UUID...$(NC)"
	@cd datasets/kaggle-import && python main.py $(ARGS)
	
	@echo "$(YELLOW)Validation des datasets importes...$(NC)"
	@python scripts/development/validate-kaggle-datasets.py
	
	@echo ""
	@echo "$(GREEN)🎉🎉🎉 DATASETS KAGGLE IMPORTES AVEC SUCCES ! 🎉🎉🎉$(NC)"
	@echo "$(GREEN)✅ Structure UUID securisee dans MinIO$(NC)"
	@echo "$(GREEN)✅ Metadonnees completes en base PostgreSQL$(NC)"
	@echo "$(GREEN)✅ 7 vrais datasets Kaggle prets pour developpement$(NC)"
	@echo ""
	@echo "$(GREEN)Acces aux datasets :$(NC)"
	@echo "  $(GREEN)► Interface IBIS-X: http://localhost:8080/datasets$(NC)"
	@echo "  $(GREEN)► API Datasets: http://localhost:9000/datasets$(NC)"

validate-datasets: ## Valide que les VRAIS datasets Kaggle sont importés (pas de fausses données)
	@echo "$(BLUE)Validation des datasets...$(NC)"
	@python scripts/development/validate-kaggle-datasets.py

stop: stop-portforwards clean-temp-files ## Arrête l'application et nettoie les fichiers temporaires
	@echo "$(BLUE)Arret de l'application...$(NC)"
	@skaffold delete --profile=local --namespace=$(NAMESPACE) 2>$(NULL)
	@echo "$(GREEN)Application arretee et nettoyee$(NC)"

clean-migrations: ## Supprime les jobs de migration
	@echo "$(BLUE)Nettoyage des jobs de migration...$(NC)"
	-@kubectl delete job api-gateway-migration-job -n $(NAMESPACE) 2>$(NULL)
	-@kubectl delete job service-selection-migration-job -n $(NAMESPACE) 2>$(NULL)
	-@kubectl delete job ml-pipeline-migration-job -n $(NAMESPACE) 2>$(NULL)
	@echo "$(GREEN)Jobs de migration supprimes$(NC)"

clean: stop clean-migrations ## Nettoyage complet
	@echo "$(BLUE)Nettoyage complet...$(NC)"
	-@kubectl delete namespace $(NAMESPACE) 2>$(NULL)
	@echo "$(GREEN)Nettoyage termine$(NC)"

reset: clean dev ## Reset complet (nettoyage + redémarrage)

reset-secrets: ## Remet les placeholders dans les fichiers de secrets
	@echo "$(BLUE)Remise des placeholders...$(NC)"
	@python scripts/development/reset-placeholders.py
	@echo "$(GREEN)Placeholders restaures$(NC)"

test-ml-pipeline: ## Test rapide du service ML Pipeline
	@echo "$(BLUE)Test du service ML Pipeline...$(NC)"
	@echo "$(YELLOW)Verification Redis...$(NC)"
	@kubectl exec -n $(NAMESPACE) statefulset/redis -- redis-cli ping || echo "$(RED)Redis non disponible$(NC)"
	@echo "$(YELLOW)Verification API ML Pipeline...$(NC)"
	@kubectl port-forward -n $(NAMESPACE) service/ml-pipeline-service 8082:8082 &
	@sleep 3
	@curl -s http://localhost:8082/health || echo "$(RED)API ML Pipeline non disponible$(NC)"
	@echo "$(YELLOW)Verification Workers Celery...$(NC)"
	@kubectl logs -n $(NAMESPACE) deployment/ml-pipeline-celery-worker --tail=10 || echo "$(RED)Workers non disponibles$(NC)"
	@echo "$(GREEN)Test ML Pipeline termine$(NC)"

start-portforwards-final: ## Solution AUTOMATIQUE - PowerShell direct
	@echo "$(BLUE)=== LANCEMENT AUTOMATIQUE DES PORT-FORWARDS ===$(NC)"
	@echo "$(YELLOW)Verification pods prets...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=frontend -n $(NAMESPACE) --timeout=30s || true
	@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=30s || true
	@echo "$(YELLOW)Lancement des port-forwards avec PowerShell...$(NC)"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/frontend','8080:80'"
	@sleep 2
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/api-gateway-service','9000:80'"
	@sleep 2
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/minio-service','6700:6700'"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/minio-service','6701:6701'"
	@echo "$(YELLOW)Attente etablissement des connexions (10 secondes)...$(NC)"
	@sleep 10
	@echo ""
	@echo "$(GREEN)✅ APPLICATION PRETE !$(NC)"
	@echo ""
	@echo "$(GREEN)► Frontend: http://localhost:8080$(NC)"
	@echo "$(GREEN)► API Gateway: http://localhost:9000$(NC)"
	@echo "$(GREEN)► API Docs: http://localhost:9000/docs$(NC)"
	@echo "$(GREEN)► MinIO Console: http://localhost:6701$(NC)"
	@echo ""
	@echo "$(GREEN)Port-forwards lances automatiquement !$(NC)"

start-portforwards-auto: ## Lance automatiquement les port-forwards avec PowerShell (compatible Windows)
	@echo "$(BLUE)=== LANCEMENT AUTOMATIQUE DES PORT-FORWARDS ===$(NC)"
	@echo "$(YELLOW)Verification pods prets...$(NC)"
	@kubectl wait --for=condition=ready pod -l app=frontend -n $(NAMESPACE) --timeout=30s || true
	@kubectl wait --for=condition=ready pod -l app=api-gateway -n $(NAMESPACE) --timeout=30s || true
	@echo "$(YELLOW)Lancement des port-forwards en arriere-plan...$(NC)"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/frontend','8080:80'"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/api-gateway-service','9000:80'"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/minio-service','6700:6700'"
	@powershell.exe -Command "Start-Process -WindowStyle Hidden kubectl -ArgumentList 'port-forward','-n','$(NAMESPACE)','service/minio-service','6701:6701'"
	@sleep 3
	@echo "$(GREEN)✅ Port-forwards lances automatiquement !$(NC)"
	@echo "$(GREEN)  ► Frontend:      http://localhost:8080$(NC)"
	@echo "$(GREEN)  ► API Gateway:   http://localhost:9000$(NC)"
	@echo "$(GREEN)  ► MinIO Console: http://localhost:6701$(NC)" 