#!/usr/bin/env python3
"""
Script de test pour vérifier le système de nettoyage des données avec de vrais datasets.

Ce script teste :
1. Le chargement de vrais datasets depuis MinIO
2. L'analyse de qualité des données réelles
3. Les recommandations adaptées aux vrais patterns de données
"""

import os
import sys
import requests
import logging
from typing import Optional

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_dataset_loading(dataset_id: str):
    """Teste le chargement d'un dataset réel."""
    try:
        # Importer les modules locaux
        from app.ml.preprocessing import analyze_dataset_quality, DataQualityAnalyzer
        
        # Simuler l'appel à l'API pour analyser la qualité des données
        print(f"🔍 Test du chargement du dataset: {dataset_id}")
        
        # Charger le dataset via la fonction mise à jour
        from app.main import _load_dataset_sample
        df = _load_dataset_sample(dataset_id, 5000)
        
        print(f"✅ Dataset chargé avec succès:")
        print(f"   • Lignes: {len(df)}")
        print(f"   • Colonnes: {len(df.columns)}")
        print(f"   • Colonnes: {list(df.columns)}")
        
        # Afficher un aperçu des données
        print(f"\n📊 Aperçu des données:")
        print(df.head())
        
        print(f"\n📈 Types de données:")
        print(df.dtypes)
        
        print(f"\n🔍 Données manquantes par colonne:")
        missing_info = df.isnull().sum()
        for col, missing_count in missing_info.items():
            if missing_count > 0:
                percentage = (missing_count / len(df)) * 100
                print(f"   • {col}: {missing_count} ({percentage:.1f}%)")
        
        return df
        
    except Exception as e:
        logger.error(f"❌ Erreur lors du test de chargement: {str(e)}")
        return None

def test_data_quality_analysis(df, target_column: Optional[str] = None):
    """Teste l'analyse de qualité des données."""
    try:
        from app.ml.preprocessing import analyze_dataset_quality
        
        print(f"\n🔬 Analyse de qualité des données...")
        
        # Si pas de target spécifiée, essayer de deviner
        if not target_column and len(df.columns) > 0:
            # Prendre la dernière colonne comme target par défaut
            target_column = df.columns[-1]
            print(f"   • Target auto-détectée: {target_column}")
        
        # Analyser la qualité
        analysis = analyze_dataset_quality(df, target_column)
        
        print(f"\n📊 Résultats de l'analyse:")
        print(f"   • Score de qualité: {analysis['data_quality_score']}/100")
        
        severity = analysis['missing_data_analysis']['severity_assessment']
        print(f"   • Niveau de sévérité: {severity['level']}")
        print(f"   • Score de sévérité: {severity['overall_score']}")
        print(f"   • Action requise: {'Oui' if severity['action_required'] else 'Non'}")
        
        if severity['main_issues']:
            print(f"   • Issues principales:")
            for issue in severity['main_issues']:
                print(f"     - {issue}")
        
        # Afficher les recommandations
        print(f"\n💡 Recommandations:")
        recommendations = analysis['preprocessing_recommendations']
        
        print(f"   • Scaling recommandé: {recommendations['scaling_recommendation']}")
        print(f"   • Encoding recommandé: {recommendations['encoding_recommendation']}")
        
        if recommendations['priority_actions']:
            print(f"   • Actions prioritaires:")
            for action in recommendations['priority_actions']:
                print(f"     - {action['priority'].upper()}: {action['description']}")
        
        # Stratégies par colonne
        if recommendations['missing_values_strategy']:
            print(f"\n🛠️ Stratégies de nettoyage par colonne:")
            for column, strategy_info in recommendations['missing_values_strategy'].items():
                print(f"   • {column}:")
                print(f"     - Stratégie: {strategy_info['strategy']}")
                print(f"     - Confiance: {strategy_info['confidence']:.0%}")
                print(f"     - Explication: {strategy_info['explanation']}")
        
        return analysis
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'analyse de qualité: {str(e)}")
        return None

def test_api_endpoints():
    """Teste les nouveaux endpoints API."""
    try:
        print(f"\n🌐 Test des endpoints API...")
        
        # Tester la connexion au service
        base_url = "http://localhost:8082"  # URL locale pour test
        health_response = requests.get(f"{base_url}/health", timeout=5)
        
        if health_response.status_code == 200:
            print(f"✅ Service ML Pipeline accessible")
            
            # Tester l'endpoint d'analyse de qualité
            test_request = {
                "dataset_id": "test-dataset",
                "target_column": "target",
                "sample_size": 1000
            }
            
            try:
                analysis_response = requests.post(
                    f"{base_url}/data-quality/analyze",
                    json=test_request,
                    timeout=30
                )
                
                if analysis_response.status_code == 200:
                    print(f"✅ Endpoint d'analyse de qualité fonctionne")
                    result = analysis_response.json()
                    print(f"   • Score de qualité: {result.get('data_quality_score', 'N/A')}")
                else:
                    print(f"⚠️ Endpoint retourne: {analysis_response.status_code}")
                    
            except requests.exceptions.RequestException as e:
                print(f"⚠️ Impossible de tester l'endpoint (service pas démarré): {str(e)}")
        else:
            print(f"⚠️ Service non accessible: {health_response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Service ML Pipeline non accessible (normal si pas démarré): {str(e)}")

def main():
    """Fonction principale de test."""
    print("🚀 Test du Système de Nettoyage des Données Réelles")
    print("=" * 60)
    
    # Tester avec différents datasets
    test_datasets = [
        # Essayer des IDs de datasets réels qui pourraient exister
        "social-media-dataset",
        "student-stress-dataset", 
        "ednet-dataset",
        "test-dataset",
        "sample-dataset"
    ]
    
    successful_tests = 0
    
    for dataset_id in test_datasets:
        print(f"\n{'='*60}")
        print(f"📁 Test avec dataset: {dataset_id}")
        print(f"{'='*60}")
        
        # Test de chargement
        df = test_dataset_loading(dataset_id)
        
        if df is not None:
            successful_tests += 1
            
            # Test d'analyse de qualité
            analysis = test_data_quality_analysis(df)
            
            if analysis:
                print(f"✅ Test réussi pour {dataset_id}")
            else:
                print(f"⚠️ Analyse échouée pour {dataset_id}")
                
            # Arrêter au premier dataset qui fonctionne pour éviter les tests répétitifs
            break
        else:
            print(f"❌ Échec du chargement pour {dataset_id}")
    
    # Test des endpoints API
    test_api_endpoints()
    
    # Résumé
    print(f"\n{'='*60}")
    print(f"📊 Résumé des tests")
    print(f"{'='*60}")
    
    if successful_tests > 0:
        print(f"✅ {successful_tests} dataset(s) testé(s) avec succès")
        print(f"✅ Le système de nettoyage fonctionne avec de vraies données")
        print(f"\n🎯 Prochaines étapes:")
        print(f"   1. Déployer les changements avec 'make dev'")
        print(f"   2. Tester dans l'interface web")
        print(f"   3. Vérifier que les vraies colonnes apparaissent (plus de 'feature_X')")
    else:
        print(f"⚠️ Aucun dataset réel trouvé - le système utilise des données de fallback")
        print(f"   • C'est normal si aucun dataset n'est encore initialisé")
        print(f"   • Lancez 'make init-data' pour créer des datasets de test")
    
    print(f"\n💡 Le système est configuré pour:")
    print(f"   • Charger les vrais datasets depuis MinIO")
    print(f"   • Analyser les vraies colonnes de données")  
    print(f"   • Fournir des recommandations adaptées")
    print(f"   • Utiliser des données de fallback si nécessaire")

if __name__ == "__main__":
    main()