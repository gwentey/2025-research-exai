.PHONY: help install test-auth import-all import-dataset import-small force-refresh status clean

# Afficher l'aide
help:
	@echo "🚀 Système d'Import Kaggle EXAI"
	@echo "================================="
	@echo ""
	@echo "Commandes disponibles :"
	@echo "  install      - Installer les dépendances"
	@echo "  test-auth    - Tester l'authentification Kaggle"
	@echo "  import-all   - Importer tous les datasets"
	@echo "  import-small - Importer seulement les petits datasets"
	@echo "  import-dataset DATASET=nom - Importer un dataset spécifique"
	@echo "  force-refresh - Forcer le re-téléchargement (ignore cache)"
	@echo "  status       - Afficher l'état des imports"
	@echo "  clean        - Nettoyer les fichiers temporaires"
	@echo ""
	@echo "Configuration requise :"
	@echo "  - Kaggle API credentials dans ~/.kaggle/kaggle.json"
	@echo "  - Variables d'environnement pour BDD et stockage"
	@echo ""
	@echo "Exemples :"
	@echo "  make import-dataset DATASET=student_performance"
	@echo "  make import-small"
	@echo "  make force-refresh"

# Installer les dépendances
install:
	@echo "📦 Installation des dépendances..."
	pip install -r requirements.txt

# Tester l'authentification Kaggle
test-auth:
	@echo "🔑 Test de l'authentification Kaggle..."
	python -c "import kaggle; kaggle.api.authenticate(); print('✅ Authentification réussie')"

# Importer tous les datasets
import-all:
	@echo "🚀 Import de tous les datasets depuis Kaggle..."
	python kaggle_importer.py

# Importer seulement les petits datasets (exclut riiid et oulad)
import-small:
	@echo "⚡ Import des datasets de taille modérée..."
	python kaggle_importer.py --dataset student_performance
	python kaggle_importer.py --dataset student_stress
	python kaggle_importer.py --dataset student_depression
	python kaggle_importer.py --dataset social_media_addiction
	python kaggle_importer.py --dataset academic_performance

# Importer un dataset spécifique
import-dataset:
	@if [ -z "$(DATASET)" ]; then \
		echo "❌ Erreur: Spécifiez DATASET=nom_dataset"; \
		echo "Datasets disponibles:"; \
		python -c "import yaml; config=yaml.safe_load(open('kaggle_datasets_config.yaml')); [print(f'  - {name}') for name in config['datasets'].keys()]"; \
		exit 1; \
	fi
	@echo "📥 Import du dataset: $(DATASET)"
	python kaggle_importer.py --dataset $(DATASET)

# Forcer le re-téléchargement
force-refresh:
	@echo "🔄 Re-téléchargement forcé de tous les datasets..."
	python kaggle_importer.py --force-refresh

# Afficher l'état des imports
status:
	@echo "📊 État des imports Kaggle"
	@echo "=========================="
	@echo ""
	@echo "Cache disponible :"
	@ls -la cache/ 2>/dev/null || echo "  Aucun cache trouvé"
	@echo ""
	@echo "Logs récents :"
	@tail -n 10 kaggle_import.log 2>/dev/null || echo "  Aucun log trouvé"
	@echo ""
	@echo "Configuration :"
	@python -c "import yaml; config=yaml.safe_load(open('kaggle_datasets_config.yaml')); print(f'  Datasets configurés: {len(config[\"datasets\"])}')"

# Nettoyer les fichiers temporaires
clean:
	@echo "🧹 Nettoyage des fichiers temporaires..."
	rm -rf cache/
	rm -f kaggle_import.log
	rm -rf __pycache__/
	rm -rf *.pyc
	@echo "✅ Nettoyage terminé"

# Vérifier la configuration
check-config:
	@echo "🔍 Vérification de la configuration..."
	@python -c "import yaml; yaml.safe_load(open('kaggle_datasets_config.yaml')); print('✅ Configuration YAML valide')"
	@echo "Variables d'environnement requises :"
	@python -c "import os; required=['DATABASE_URL', 'STORAGE_BACKEND']; missing=[v for v in required if not os.getenv(v)]; print(f'❌ Manquantes: {missing}' if missing else '✅ Toutes présentes')"

# Lister les datasets disponibles
list-datasets:
	@echo "📋 Datasets configurés :"
	@python -c "import yaml; config=yaml.safe_load(open('kaggle_datasets_config.yaml')); [print(f'  - {name:25} ({info[\"domain\"]:15}) {info[\"kaggle_ref\"]}') for name, info in config['datasets'].items()]"

# Test de connexion aux services
test-services:
	@echo "🔗 Test de connexion aux services..."
	@echo "Base de données :"
	@python -c "from service_selection.app.database import get_db_session; next(get_db_session()); print('✅ Connexion BDD OK')" 2>/dev/null || echo "❌ Connexion BDD échouée"
	@echo "Stockage d'objets :"
	@python -c "from common.storage_client import get_storage_client; client = get_storage_client(); print('✅ Client stockage OK')" 2>/dev/null || echo "❌ Client stockage échoué" 