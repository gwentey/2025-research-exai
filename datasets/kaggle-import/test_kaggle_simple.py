#!/usr/bin/env python3
"""
Test simple de l'API Kaggle pour vérifier que les credentials fonctionnent.
"""

import kaggle
import yaml
import tempfile
from pathlib import Path

def test_kaggle_api():
    """Test basique de l'API Kaggle."""
    print("🔍 Test de l'API Kaggle...")
    
    # Test d'authentification
    try:
        kaggle.api.authenticate()
        print("✅ Authentification réussie")
    except Exception as e:
        print(f"❌ Erreur d'authentification: {e}")
        return False
    
    # Charger la configuration
    try:
        with open('kaggle_datasets_config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        print(f"✅ Configuration chargée: {len(config['datasets'])} datasets")
    except Exception as e:
        print(f"❌ Erreur de configuration: {e}")
        return False
    
    # Tester le téléchargement d'un petit dataset
    test_dataset = "student_performance"
    if test_dataset not in config['datasets']:
        print(f"❌ Dataset {test_dataset} non trouvé dans la config")
        return False
    
    kaggle_ref = config['datasets'][test_dataset]['kaggle_ref']
    print(f"📥 Test de téléchargement: {kaggle_ref}")
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Télécharger le dataset
            kaggle.api.dataset_download_files(
                kaggle_ref,
                path=temp_dir,
                unzip=True
            )
            
            # Vérifier les fichiers téléchargés
            temp_path = Path(temp_dir)
            csv_files = list(temp_path.glob("*.csv"))
            if not csv_files:
                csv_files = list(temp_path.glob("**/*.csv"))
            
            print(f"✅ Téléchargement réussi: {len(csv_files)} fichiers CSV")
            for csv_file in csv_files:
                size_mb = csv_file.stat().st_size / (1024 * 1024)
                print(f"   - {csv_file.name}: {size_mb:.2f} MB")
            
            return True
            
    except Exception as e:
        print(f"❌ Erreur de téléchargement: {e}")
        return False

def list_configured_datasets():
    """Affiche la liste des datasets configurés."""
    print("\n📋 Datasets configurés:")
    try:
        with open('kaggle_datasets_config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        for name, info in config['datasets'].items():
            domain = info.get('domain', 'N/A')
            kaggle_ref = info.get('kaggle_ref', 'N/A')
            ml_task = info.get('ml_task', 'N/A')
            print(f"  - {name:25} | {domain:15} | {ml_task:12} | {kaggle_ref}")
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    print("🚀 Test du Système d'Import Kaggle EXAI")
    print("=" * 50)
    
    # Lister les datasets
    list_configured_datasets()
    
    # Tester l'API
    print("\n" + "=" * 50)
    success = test_kaggle_api()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 SUCCÈS: Le système Kaggle fonctionne parfaitement !")
        print("💡 Prochaines étapes:")
        print("   1. Démarrer EXAI avec MinIO: make dev")
        print("   2. Lancer l'import complet en production")
    else:
        print("❌ ÉCHEC: Vérifiez la configuration") 