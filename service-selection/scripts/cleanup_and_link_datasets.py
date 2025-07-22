#!/usr/bin/env python3
"""
Script de nettoyage intelligent des doublons de datasets.

Ce script :
1. Identifie tous les doublons par nom de dataset similaire
2. Garde seulement le plus récent de chaque groupe
3. Supprime tous les autres exemplaires
4. Assure qu'il n'y ait que 7 datasets uniques au final

Usage:
    cd service-selection
    python scripts/cleanup_and_link_datasets.py
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from collections import defaultdict
import re

# Ajouter les répertoires nécessaires au path
script_dir = os.path.dirname(os.path.abspath(__file__))
service_dir = os.path.dirname(script_dir)

# Contexte (local vs Docker)
if os.path.exists(os.path.join(service_dir, 'app')):
    app_dir = os.path.join(service_dir, 'app')
    sys.path.insert(0, app_dir)
    context = "local"
else:
    sys.path.insert(0, service_dir)
    context = "docker"

try:
    from models import Dataset
    from database import DATABASE_URL
    sys.path.append(os.path.join(service_dir, '..'))
    from common.storage_client import get_storage_client
except ImportError as e:
    print(f"❌ Erreur d'import: {e}")
    sys.exit(1)

def normalize_dataset_name(name):
    """
    Normalise un nom de dataset pour identifier les doublons.
    """
    # Convertir en minuscules et enlever caractères spéciaux
    normalized = re.sub(r'[^a-z0-9\s]', '', name.lower())
    
    # Identifier les groupes sémantiques
    if 'social media' in normalized or 'addiction' in normalized:
        return 'social_media_group'
    elif 'stress' in normalized and 'student' in normalized:
        return 'student_stress_group'
    elif 'depression' in normalized and ('student' in normalized or 'mental health' in normalized):
        return 'student_depression_group'
    elif 'performance' in normalized and ('student' in normalized or 'exam' in normalized):
        return 'student_performance_group'
    elif 'academic' in normalized and 'performance' in normalized:
        return 'academic_performance_group'
    elif 'oulad' in normalized or 'open university' in normalized:
        return 'oulad_group'
    elif 'ednet' in normalized or 'riiid' in normalized or 'answer' in normalized:
        return 'ednet_group'
    else:
        return 'other_group'

def cleanup_dataset_duplicates():
    """
    Nettoie tous les doublons en gardant seulement 1 exemplaire de chaque dataset.
    """
    
    print("🧹 NETTOYAGE INTELLIGENT DES DOUBLONS")
    print("=" * 60)
    
    # Configuration BDD
    try:
        database_url = DATABASE_URL
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    except Exception as e:
        print(f"❌ Erreur de configuration BDD: {e}")
        sys.exit(1)

    with SessionLocal() as session:
        try:
            # === ÉTAPE 1: ANALYSER TOUS LES DATASETS ===
            print("\n📊 Analyse des datasets existants...")
            
            datasets = session.query(Dataset).order_by(Dataset.created_at.desc()).all()
            print(f"📈 Total datasets trouvés: {len(datasets)}")
            
            # Grouper par catégorie sémantique
            groups = defaultdict(list)
            for dataset in datasets:
                group_key = normalize_dataset_name(dataset.dataset_name)
                groups[group_key].append(dataset)
            
            print(f"🔍 Groupes identifiés: {len(groups)}")
            for group_name, dataset_list in groups.items():
                print(f"  📁 {group_name}: {len(dataset_list)} datasets")
                for ds in dataset_list:
                    print(f"     - {ds.dataset_name} (créé: {ds.created_at})")
            
            # === ÉTAPE 2: IDENTIFIER LES DOUBLONS ===
            datasets_to_keep = []
            datasets_to_delete = []
            
            for group_name, dataset_list in groups.items():
                if len(dataset_list) > 1:
                    print(f"\n🔄 Traitement groupe '{group_name}' - {len(dataset_list)} doublons")
                    
                    # Trier par date de création (le plus récent en premier)
                    sorted_datasets = sorted(dataset_list, key=lambda x: x.created_at, reverse=True)
                    
                    # Garder le plus récent avec vraies données (storage_path non vide)
                    keeper = None
                    for ds in sorted_datasets:
                        if ds.storage_path and ds.storage_path.strip():
                            keeper = ds
                            break
                    
                    # Si aucun avec storage_path, garder le plus récent
                    if not keeper:
                        keeper = sorted_datasets[0]
                    
                    datasets_to_keep.append(keeper)
                    print(f"  ✅ Garde: {keeper.dataset_name}")
                    
                    # Marquer les autres pour suppression
                    for ds in dataset_list:
                        if ds.id != keeper.id:
                            datasets_to_delete.append(ds)
                            print(f"  🗑️  Supprime: {ds.dataset_name}")
                            
                else:
                    # Un seul dataset dans le groupe, le garder
                    datasets_to_keep.append(dataset_list[0])
                    print(f"✅ Garde unique: {dataset_list[0].dataset_name}")
            
            # === ÉTAPE 3: SUPPRIMER LES DOUBLONS ===
            print(f"\n🗑️  Suppression de {len(datasets_to_delete)} doublons...")
            
            for dataset in datasets_to_delete:
                try:
                    session.delete(dataset)
                    print(f"  ❌ Supprimé: {dataset.dataset_name}")
                except Exception as e:
                    print(f"  ⚠️  Erreur suppression {dataset.dataset_name}: {e}")
            
            # Valider les suppressions
            session.commit()
            
            # === ÉTAPE 4: VÉRIFICATION FINALE ===
            print(f"\n📊 RÉSULTAT FINAL")
            print("=" * 30)
            
            remaining_datasets = session.query(Dataset).order_by(Dataset.dataset_name).all()
            print(f"✅ Datasets restants: {len(remaining_datasets)}")
            
            for i, ds in enumerate(remaining_datasets, 1):
                storage_indicator = "📁" if ds.storage_path else "📋"
                instances = f"{ds.instances_number:,}" if ds.instances_number else "N/A"
                print(f"  {i}. {storage_indicator} {ds.dataset_name}")
                print(f"     📊 {instances} instances - Créé: {ds.created_at.strftime('%Y-%m-%d %H:%M')}")
                if ds.storage_path:
                    print(f"     💾 Storage: {ds.storage_path}")
            
            if len(remaining_datasets) == 7:
                print("\n🎉 PARFAIT ! Exactement 7 datasets uniques comme demandé !")
            elif len(remaining_datasets) < 7:
                print(f"\n⚠️  Attention: Seulement {len(remaining_datasets)} datasets. Manque {7 - len(remaining_datasets)} datasets.")
            else:
                print(f"\n⚠️  Attention: {len(remaining_datasets)} datasets trouvés. Il devrait y en avoir 7.")
            
            print("\n✅ Nettoyage terminé avec succès !")
            
        except Exception as e:
            session.rollback()
            print(f"❌ Erreur lors du nettoyage: {e}")
            raise
        finally:
            session.close()

if __name__ == "__main__":
    cleanup_dataset_duplicates() 
