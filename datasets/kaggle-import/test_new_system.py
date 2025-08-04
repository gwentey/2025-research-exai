#!/usr/bin/env python3
"""
Script de test pour le nouveau système de métadonnées enrichies.

Ce script teste le nouveau DatasetMetadataLoader et KaggleMetadataMapperV2
sans avoir besoin de faire un import complet depuis Kaggle.
"""

import sys
from pathlib import Path

# Ajouter le chemin pour les imports
sys.path.insert(0, str(Path(__file__).parent))

from importer_lib.metadata_loader import DatasetMetadataLoader
from kaggle_metadata_mapper_v2 import KaggleMetadataMapperV2


class MockDatasetConfig:
    """Mock pour simuler la config d'un dataset."""
    def __init__(self, name, domain, kaggle_ref, description, ml_task):
        self.name = name
        self.domain = domain
        self.kaggle_ref = kaggle_ref
        self.description = description
        self.ml_task = ml_task


def test_metadata_loader():
    """Teste le DatasetMetadataLoader."""
    print("🧪 Test du DatasetMetadataLoader...")
    
    loader = DatasetMetadataLoader()
    
    # Test 1: Lister les datasets disponibles
    datasets = loader.get_available_datasets()
    print(f"✅ Datasets disponibles: {datasets}")
    
    # Test 2: Charger un dataset spécifique
    if 'academic_performance' in datasets:
        metadata = loader.load_dataset_metadata('academic_performance')
        print(f"✅ Métadonnées chargées: {len(metadata)} champs")
        print(f"   - Nom: {metadata.get('dataset_name', 'N/A')}")
        print(f"   - Domaine: {metadata.get('domain', 'N/A')}")
        print(f"   - Objectif: {metadata.get('objective', 'N/A')[:100]}...")
    
    return True


def test_new_mapper():
    """Teste le nouveau KaggleMetadataMapperV2."""
    print("\\n🧪 Test du KaggleMetadataMapperV2...")
    
    mapper = KaggleMetadataMapperV2()
    
    # Simuler une configuration de dataset
    dataset_config = MockDatasetConfig(
        name='academic_performance',
        domain='education',
        kaggle_ref='nikhil7280/student-performance-multiple-linear-regression',
        description='Academic performance prediction with multiple factors',
        ml_task='regression'
    )
    
    # Simuler des métadonnées Kaggle (ignorées dans la nouvelle version)
    kaggle_metadata = {
        'title': 'Student Performance Dataset',
        'description': 'Analysis of student performance factors',
        'usabilityRating': 0.8
    }
    
    # Simuler des métadonnées de fichiers
    file_metadata = {
        'total_rows': 10000,
        'total_columns': 6,
        'has_missing_values': False,
        'missing_percentage': 0.0,
        'column_details': [
            {'column_name': 'hours_studied', 'data_type_interpreted': 'numerical_float'},
            {'column_name': 'previous_scores', 'data_type_interpreted': 'numerical_integer'},
            {'column_name': 'extracurricular_activities', 'data_type_interpreted': 'categorical'},
            {'column_name': 'sleep_hours', 'data_type_interpreted': 'numerical_float'},
            {'column_name': 'sample_question_papers_practiced', 'data_type_interpreted': 'numerical_integer'},
            {'column_name': 'performance_index', 'data_type_interpreted': 'numerical_integer'}
        ]
    }
    
    storage_path = "datasets/test-uuid-12345"
    
    # Tester le mapping
    try:
        enriched_metadata = mapper.map_kaggle_to_dataset(
            dataset_config, 
            kaggle_metadata, 
            file_metadata, 
            storage_path
        )
        
        print(f"✅ Mapping réussi: {len(enriched_metadata)} champs")
        print(f"   - Nom du dataset: {enriched_metadata.get('dataset_name', 'N/A')}")
        print(f"   - Instances: {enriched_metadata.get('instances_number', 'N/A')}")
        print(f"   - Features: {enriched_metadata.get('features_number', 'N/A')}")
        print(f"   - Domaine: {enriched_metadata.get('domain', 'N/A')}")
        print(f"   - Tâche: {enriched_metadata.get('task', 'N/A')}")
        print(f"   - Transparence: {enriched_metadata.get('transparency', 'N/A')}")
        print(f"   - Anonymisation: {enriched_metadata.get('anonymization_applied', 'N/A')}")
        print(f"   - Storage path: {enriched_metadata.get('storage_path', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du mapping: {e}")
        return False


def test_fallback_system():
    """Teste le système de fallback pour un dataset inexistant."""
    print("\\n🧪 Test du système de fallback...")
    
    mapper = KaggleMetadataMapperV2()
    
    # Simuler un dataset qui n'a pas de métadonnées spécifiques
    dataset_config = MockDatasetConfig(
        name='inexistant_dataset',
        domain='education',
        kaggle_ref='user/nonexistent-dataset',
        description='Dataset de test pour fallback',
        ml_task='classification'
    )
    
    kaggle_metadata = {
        'title': 'Test Dataset',
        'description': 'Test fallback system'
    }
    
    file_metadata = {
        'total_rows': 1000,
        'total_columns': 5,
        'has_missing_values': True,
        'missing_percentage': 2.5,
        'column_details': []
    }
    
    storage_path = "datasets/test-fallback-uuid"
    
    try:
        enriched_metadata = mapper.map_kaggle_to_dataset(
            dataset_config, 
            kaggle_metadata, 
            file_metadata, 
            storage_path
        )
        
        print(f"✅ Fallback réussi: {len(enriched_metadata)} champs")
        print(f"   - Nom: {enriched_metadata.get('dataset_name', 'N/A')}")
        print(f"   - Source utilisée: Template de fallback")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur dans le fallback: {e}")
        return False


def main():
    """Point d'entrée principal des tests."""
    print("🚀 Test du nouveau système de métadonnées enrichies")
    print("="*60)
    
    success = True
    
    try:
        # Test 1: DatasetMetadataLoader
        success &= test_metadata_loader()
        
        # Test 2: KaggleMetadataMapperV2
        success &= test_new_mapper()
        
        # Test 3: Système de fallback
        success &= test_fallback_system()
        
        print("\\n" + "="*60)
        if success:
            print("✅ Tous les tests sont passés avec succès !")
            print("🎉 Le nouveau système de métadonnées enrichies fonctionne correctement.")
        else:
            print("❌ Certains tests ont échoué.")
            
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")
        success = False
    
    return success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)