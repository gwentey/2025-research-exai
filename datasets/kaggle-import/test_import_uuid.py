#!/usr/bin/env python3
"""
Script de test pour le nouveau système d'import Kaggle avec UUID.

Ce script teste :
1. La connexion aux services (database, storage)
2. L'import d'un petit dataset Kaggle
3. La validation de la structure UUID
4. L'intégrité des données
"""

import os
import sys
import subprocess
from pathlib import Path

def test_environment():
    """Teste l'environnement et les dépendances."""
    print("🔍 Test de l'environnement...")
    
    # Test variables d'environnement critiques
    required_vars = ['KAGGLE_USERNAME', 'KAGGLE_KEY', 'DATABASE_URL']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Variables d'environnement manquantes: {missing_vars}")
        print("💡 Ajoutez-les dans votre fichier .env")
        return False
    
    print("✅ Variables d'environnement OK")
    
    # Test imports Python
    try:
        import kaggle
        import pandas
        import pyarrow
        print("✅ Dépendances Python OK")
    except ImportError as e:
        print(f"❌ Dépendance manquante: {e}")
        print("💡 Exécutez: pip install -r requirements.txt")
        return False
    
    return True

def test_kaggle_connection():
    """Teste la connexion à l'API Kaggle."""
    print("\n🔑 Test de la connexion Kaggle...")
    
    try:
        import kaggle
        kaggle.api.authenticate()
        
        # Test simple : lister les datasets d'un utilisateur connu
        datasets = kaggle.api.dataset_list(user="spscientist", page_size=1)
        print("✅ Connexion Kaggle OK")
        return True
    except Exception as e:
        print(f"❌ Erreur connexion Kaggle: {e}")
        return False

def test_services_connectivity():
    """Teste la connectivité aux services IBIS-X."""
    print("\n🌐 Test de connectivité aux services...")
    
    import requests
    
    # Test API Gateway
    try:
        response = requests.get('http://localhost:9000/health', timeout=5)
        if response.status_code == 200:
            print("✅ API Gateway accessible")
        else:
            print(f"⚠️ API Gateway répond mais code: {response.status_code}")
    except requests.RequestException:
        print("❌ API Gateway non accessible")
        print("💡 Lancez d'abord: make dev")
        return False
    
    # Test Frontend
    try:
        response = requests.get('http://localhost:8080', timeout=5)
        if response.status_code == 200:
            print("✅ Frontend accessible")
        else:
            print(f"⚠️ Frontend répond mais code: {response.status_code}")
    except requests.RequestException:
        print("⚠️ Frontend non accessible (optionnel)")
    
    return True

def test_single_dataset_import():
    """Teste l'import d'un seul dataset pour validation."""
    print("\n📥 Test d'import d'un dataset...")
    
    try:
        # Importer le dataset le plus petit
        cmd = [sys.executable, "kaggle_importer.py", "--dataset", "student_performance"]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent)
        
        if result.returncode == 0:
            print("✅ Import réussi")
            print("Logs de succès:", result.stdout[-200:] if len(result.stdout) > 200 else result.stdout)
            return True
        else:
            print("❌ Import échoué")
            print("Erreur:", result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors du test d'import: {e}")
        return False

def test_data_validation():
    """Teste la validation des données importées."""
    print("\n✅ Test de validation des données...")
    
    try:
        cmd = [sys.executable, "../scripts/development/validate-kaggle-datasets.py"]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent)
        
        if result.returncode == 0:
            print("✅ Validation des données réussie")
            return True
        else:
            print("❌ Validation échouée")
            print("Détails:", result.stdout)
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors de la validation: {e}")
        return False

def main():
    """Fonction principale de test."""
    print("🚀 Test du Système d'Import Kaggle UUID IBIS-X")
    print("=" * 60)
    
    tests = [
        ("Environment", test_environment),
        ("Kaggle Connection", test_kaggle_connection), 
        ("Services Connectivity", test_services_connectivity),
        ("Single Dataset Import", test_single_dataset_import),
        ("Data Validation", test_data_validation)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 20} {test_name} {'=' * 20}")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name}: RÉUSSI")
            else:
                print(f"❌ {test_name}: ÉCHOUÉ")
        except Exception as e:
            print(f"❌ {test_name}: ERREUR - {e}")
    
    print(f"\n{'=' * 60}")
    print(f"📊 RÉSULTATS FINAUX")
    print(f"{'=' * 60}")
    print(f"✅ Tests réussis: {passed}/{total}")
    print(f"❌ Tests échoués: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 TOUS LES TESTS RÉUSSIS !")
        print("💡 Le système d'import Kaggle UUID est prêt pour l'utilisation")
        print("🚀 Vous pouvez maintenant utiliser: make dev-data")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) ont échoué")
        print("💡 Corrigez les erreurs avant d'utiliser le système")
        return 1

if __name__ == "__main__":
    sys.exit(main())