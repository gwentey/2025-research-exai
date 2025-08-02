#!/usr/bin/env python3
"""
Démonstration du nouveau système de nettoyage des données avec cache
"""

import requests
import json
import time
from datetime import datetime

# Configuration
API_BASE_URL = "http://localhost:8082"
DATASET_ID = "550e8400-e29b-41d4-a716-446655440000"  # Exemple d'UUID

def demo_data_quality_analysis():
    """Démontre l'analyse de qualité avec système de cache"""
    
    print("=" * 80)
    print("🧹 DÉMONSTRATION DU NOUVEAU SYSTÈME DE NETTOYAGE DES DONNÉES")
    print("=" * 80)
    
    # 1. Première analyse (sera mise en cache)
    print("\n📊 Étape 1: Première analyse du dataset")
    print("-" * 40)
    
    start_time = time.time()
    response = requests.post(
        f"{API_BASE_URL}/data-quality/analyze",
        json={
            "dataset_id": DATASET_ID,
            "sample_size": 5000,
            "force_refresh": False
        }
    )
    
    first_duration = time.time() - start_time
    
    if response.status_code == 200:
        analysis = response.json()
        print(f"✅ Analyse réussie en {first_duration:.2f} secondes")
        print(f"📈 Score de qualité: {analysis['data_quality_score']}/100")
        print(f"📊 Dataset: {analysis['dataset_overview']['total_rows']} lignes × {analysis['dataset_overview']['total_columns']} colonnes")
        
        # Afficher les colonnes avec problèmes
        missing_data = analysis['missing_data_analysis']['columns_with_missing']
        if missing_data:
            print("\n🔍 Colonnes avec données manquantes:")
            for col_name, col_info in missing_data.items():
                print(f"  - {col_name}: {col_info['missing_percentage']:.1f}% manquants")
                print(f"    → Stratégie recommandée: {col_info['recommended_strategy']['strategy']}")
                print(f"    → Raison: {col_info['recommended_strategy']['reason']}")
    else:
        print(f"❌ Erreur: {response.status_code} - {response.text}")
        return
    
    # 2. Deuxième appel (devrait utiliser le cache)
    print("\n📊 Étape 2: Deuxième analyse (depuis le cache)")
    print("-" * 40)
    
    start_time = time.time()
    response = requests.post(
        f"{API_BASE_URL}/data-quality/analyze",
        json={
            "dataset_id": DATASET_ID,
            "sample_size": 5000,
            "force_refresh": False
        }
    )
    
    cache_duration = time.time() - start_time
    
    if response.status_code == 200:
        print(f"✅ Analyse depuis le cache en {cache_duration:.2f} secondes")
        print(f"⚡ Amélioration de performance: {(first_duration/cache_duration):.1f}x plus rapide!")
    
    # 3. Demander une stratégie de preprocessing optimisée
    print("\n🎯 Étape 3: Obtenir une stratégie de nettoyage personnalisée")
    print("-" * 40)
    
    response = requests.post(
        f"{API_BASE_URL}/data-quality/suggest-strategy",
        json={
            "dataset_id": DATASET_ID,
            "target_column": "default_risk",
            "task_type": "classification"
        }
    )
    
    if response.status_code == 200:
        strategy = response.json()
        print("✅ Stratégie personnalisée générée:")
        
        # Afficher les stratégies par colonne
        print("\n📋 Stratégies de nettoyage par colonne:")
        for col, strat in strategy['missing_values'].items():
            print(f"  - {col}: {strat}")
        
        # Afficher l'impact estimé
        impact = strategy['estimated_impact']
        print(f"\n📊 Impact estimé:")
        print(f"  - Amélioration attendue: {impact['expected_improvement']}")
        print(f"  - Taux de rétention des données: {impact['data_retention_rate']*100:.0f}%")
        print(f"  - Score de confiance: {impact['confidence_score']*100:.0f}%")
    
    # 4. Forcer une nouvelle analyse
    print("\n📊 Étape 4: Forcer une nouvelle analyse (ignorer le cache)")
    print("-" * 40)
    
    response = requests.post(
        f"{API_BASE_URL}/data-quality/analyze",
        json={
            "dataset_id": DATASET_ID,
            "sample_size": 5000,
            "force_refresh": True  # Force une nouvelle analyse
        }
    )
    
    if response.status_code == 200:
        print("✅ Nouvelle analyse forcée avec succès")
        print("💡 Utile si le dataset a été modifié")

def demo_cleaning_workflow():
    """Démontre le workflow complet de nettoyage"""
    
    print("\n" + "=" * 80)
    print("🔄 WORKFLOW COMPLET DE NETTOYAGE")
    print("=" * 80)
    
    # Simuler les étapes du wizard
    steps = [
        ("1️⃣ Sélection du dataset", "Dataset 'Customer Churn' sélectionné"),
        ("2️⃣ Analyse de qualité", "Détection de 5 colonnes avec données manquantes"),
        ("3️⃣ Application Auto-Fix", "Stratégies optimales appliquées automatiquement"),
        ("4️⃣ Validation manuelle", "Ajustement de 2 stratégies par l'utilisateur"),
        ("5️⃣ Configuration sauvegardée", "Prêt pour l'entraînement ML")
    ]
    
    for step, description in steps:
        print(f"\n{step}")
        print(f"  → {description}")
        time.sleep(0.5)  # Petite pause pour l'effet
    
    print("\n✅ Nettoyage terminé avec succès!")
    print("📊 Résumé:")
    print("  - Colonnes supprimées: 1 (>80% manquants)")
    print("  - Colonnes imputées: 4 (stratégies variées)")
    print("  - Score de qualité: 85/100 → 94/100")
    print("  - Temps total: 12 secondes")

def main():
    """Point d'entrée principal"""
    try:
        # Vérifier que l'API est accessible
        response = requests.get(f"{API_BASE_URL}/health")
        if response.status_code != 200:
            print("❌ L'API ML Pipeline n'est pas accessible")
            print("Assurez-vous que le service est démarré avec: make dev")
            return
        
        # Lancer les démonstrations
        demo_data_quality_analysis()
        print("\n" * 2)
        demo_cleaning_workflow()
        
        print("\n" + "=" * 80)
        print("🎉 Démonstration terminée!")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        print("Assurez-vous que tous les services sont démarrés")

if __name__ == "__main__":
    main()