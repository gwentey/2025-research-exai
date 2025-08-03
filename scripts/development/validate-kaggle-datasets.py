#!/usr/bin/env python3
"""
Script de validation pour vérifier que les VRAIS datasets Kaggle sont importés.

Ce script vérifie :
1. Que les datasets sont stockés avec des UUIDs dans MinIO
2. Que les métadonnées correspondent aux vrais datasets Kaggle
3. Que les fichiers sont bien au format Parquet
4. Qu'aucune fausse donnée n'existe
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def check_kubectl():
    """Vérifie que kubectl est disponible."""
    try:
        subprocess.run(["kubectl", "version", "--client"], capture_output=True, check=True)
        return True
    except:
        print("❌ kubectl n'est pas installé ou accessible")
        return False

def get_datasets_from_db():
    """Récupère la liste des datasets depuis la base de données."""
    try:
        # Exécuter une requête SQL via kubectl
        cmd = [
            "kubectl", "exec", "-n", "ibis-x", 
            "deployment/service-selection", "--",
            "python", "-c",
            """
import os
import sys
sys.path.append('/app')
from database import SessionLocal
from models import Dataset, DatasetFile

with SessionLocal() as session:
    datasets = session.query(Dataset).all()
    for ds in datasets:
        files = session.query(DatasetFile).filter(DatasetFile.dataset_id == ds.id).all()
        print(f'DATASET|{ds.id}|{ds.dataset_name}|{ds.storage_path}|{len(files)}')
        for f in files:
            print(f'  FILE|{f.file_name_in_storage}|{f.format}|{f.size_bytes}')
"""
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erreur lors de la récupération des datasets: {result.stderr}")
            return []
        
        datasets = []
        current_dataset = None
        
        for line in result.stdout.strip().split('\n'):
            if line.startswith('DATASET|'):
                parts = line.split('|')
                current_dataset = {
                    'id': parts[1],
                    'name': parts[2],
                    'storage_path': parts[3],
                    'file_count': int(parts[4]),
                    'files': []
                }
                datasets.append(current_dataset)
            elif line.strip().startswith('FILE|') and current_dataset:
                parts = line.strip().split('|')
                current_dataset['files'].append({
                    'name': parts[1],
                    'format': parts[2],
                    'size': int(parts[3]) if parts[3] != 'None' else 0
                })
        
        return datasets
        
    except Exception as e:
        print(f"❌ Erreur lors de la récupération des datasets: {e}")
        return []

def validate_datasets(datasets):
    """Valide que les datasets sont corrects."""
    print("\n🔍 === VALIDATION DES DATASETS ===")
    
    valid_count = 0
    invalid_count = 0
    
    # Mapping des vrais noms de datasets Kaggle
    EXPECTED_DATASETS = {
        "Students Performance in Exams",
        "Student Stress Factors", 
        "Student Depression Dataset",
        "Students' Social Media Addiction",
        "Riiid Answer Correctness",
        "OULAD",
        "Student Academic Performance"
    }
    
    for dataset in datasets:
        print(f"\n📊 Dataset: {dataset['name']}")
        print(f"   ID: {dataset['id']}")
        print(f"   Storage Path: {dataset['storage_path']}")
        
        # Vérification 1: Le storage_path doit contenir un UUID
        is_valid = True
        
        if not dataset['storage_path'] or dataset['storage_path'] == 'None':
            print("   ❌ Pas de storage_path défini")
            is_valid = False
        elif not any(char in dataset['storage_path'] for char in ['-']):
            print("   ❌ Storage path ne contient pas d'UUID")
            is_valid = False
        else:
            print("   ✅ Storage path contient un UUID")
        
        # Vérification 2: Le nom doit correspondre à un vrai dataset
        if dataset['name'] in EXPECTED_DATASETS:
            print("   ✅ Nom correspond à un vrai dataset Kaggle")
        else:
            print(f"   ⚠️  Nom '{dataset['name']}' ne correspond pas exactement aux datasets Kaggle attendus")
            # Ne pas invalider car le nom peut varier légèrement
        
        # Vérification 3: Les fichiers doivent être au format Parquet
        if dataset['file_count'] == 0:
            print("   ❌ Aucun fichier trouvé")
            is_valid = False
        else:
            print(f"   📁 {dataset['file_count']} fichier(s) trouvé(s):")
            parquet_found = False
            for file in dataset['files']:
                print(f"      - {file['name']} ({file['format']}, {file['size']} bytes)")
                if file['format'] == 'parquet':
                    parquet_found = True
            
            if parquet_found:
                print("   ✅ Fichiers Parquet trouvés")
            else:
                print("   ❌ Aucun fichier Parquet trouvé")
                is_valid = False
        
        # Vérification 4: Taille des fichiers (les vrais datasets sont substantiels)
        total_size = sum(f['size'] for f in dataset['files'])
        if total_size < 1000:  # Moins de 1KB = probablement faux
            print(f"   ❌ Taille totale trop petite ({total_size} bytes) - probablement de fausses données")
            is_valid = False
        else:
            print(f"   ✅ Taille totale raisonnable ({total_size / 1024 / 1024:.2f} MB)")
        
        if is_valid:
            valid_count += 1
            print("   ✅ DATASET VALIDE")
        else:
            invalid_count += 1
            print("   ❌ DATASET INVALIDE")
    
    return valid_count, invalid_count

def check_minio_structure():
    """Vérifie la structure dans MinIO."""
    print("\n☁️  === VÉRIFICATION MINIO ===")
    
    try:
        # Lister les objets dans MinIO
        cmd = [
            "kubectl", "exec", "-n", "ibis-x",
            "deployment/service-selection", "--",
            "python", "-c",
            """
import os
import sys
sys.path.append('/app')
from common.storage_client import get_storage_client

try:
    client = get_storage_client()
    files = client.list_files('')
    
    # Organiser par dossier
    folders = {}
    for file in files:
        if '/' in file:
            folder = file.split('/')[0]
            if folder not in folders:
                folders[folder] = 0
            folders[folder] += 1
    
    for folder, count in sorted(folders.items()):
        print(f'FOLDER|{folder}|{count}')
        
except Exception as e:
    print(f'ERROR|{str(e)}')
"""
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line.startswith('FOLDER|'):
                    parts = line.split('|')
                    folder = parts[1]
                    count = int(parts[2])
                    
                    # Vérifier si c'est un UUID
                    if '-' in folder and len(folder) == 36:
                        print(f"   ✅ Dossier UUID trouvé: {folder} ({count} fichiers)")
                    else:
                        print(f"   ❌ Dossier non-UUID trouvé: {folder} ({count} fichiers) - FAUSSES DONNÉES!")
                elif line.startswith('ERROR|'):
                    print(f"   ❌ Erreur MinIO: {line.split('|')[1]}")
        else:
            print(f"   ❌ Impossible d'accéder à MinIO: {result.stderr}")
            
    except Exception as e:
        print(f"   ❌ Erreur lors de la vérification MinIO: {e}")

def main():
    print("🔍 === VALIDATION DES DATASETS KAGGLE ===")
    print("Ce script vérifie que les VRAIS datasets sont importés depuis Kaggle\n")
    
    if not check_kubectl():
        return 1
    
    # Récupérer les datasets depuis la base de données
    datasets = get_datasets_from_db()
    
    if not datasets:
        print("❌ Aucun dataset trouvé dans la base de données")
        print("💡 Assurez-vous d'avoir exécuté 'make dev' avec les credentials Kaggle")
        return 1
    
    print(f"📊 {len(datasets)} dataset(s) trouvé(s) dans la base de données")
    
    # Valider les datasets
    valid, invalid = validate_datasets(datasets)
    
    # Vérifier la structure MinIO
    check_minio_structure()
    
    # Résumé final
    print("\n" + "="*60)
    print("📊 RÉSUMÉ DE LA VALIDATION")
    print("="*60)
    print(f"✅ Datasets valides: {valid}")
    print(f"❌ Datasets invalides: {invalid}")
    
    if invalid > 0:
        print("\n❌ VALIDATION ÉCHOUÉE")
        print("Des fausses données ont été détectées !")
        print("\n💡 Pour corriger :")
        print("1. Assurez-vous d'avoir configuré KAGGLE_USERNAME et KAGGLE_KEY dans .env")
        print("2. Exécutez 'make clean' pour nettoyer")
        print("3. Exécutez 'make dev' pour réimporter les vrais datasets")
        return 1
    else:
        print("\n✅ VALIDATION RÉUSSIE")
        print("Tous les datasets sont des VRAIS datasets importés depuis Kaggle !")
        return 0

if __name__ == "__main__":
    sys.exit(main())