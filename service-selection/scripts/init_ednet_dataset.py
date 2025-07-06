#!/usr/bin/env python3
"""
Script d'initialisation pour insérer le dataset EdNet (Riiid Answer Correctness) 
dans la base de données normalisée.

Ce script peut être exécuté pour réinsérer les données de test à chaque fois.

Usage:
    cd service-selection
    python scripts/init_ednet_dataset.py

Requirements:
    - Base de données PostgreSQL accessible
    - Variable d'environnement DATABASE_URL définie
    - Migrations Alembic appliquées
"""

import os
import sys
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ajouter les répertoires nécessaires au path pour importer nos modèles
script_dir = os.path.dirname(os.path.abspath(__file__))
service_dir = os.path.dirname(script_dir)

# Détection automatique du contexte (local vs Docker)
if os.path.exists(os.path.join(service_dir, 'app')):
    # Contexte local : service-selection/scripts/
    app_dir = os.path.join(service_dir, 'app')
    sys.path.insert(0, app_dir)
    context = "local"
else:
    # Contexte Docker : /app/scripts/
    # Les modules sont directement dans /app/
    sys.path.insert(0, service_dir)
    context = "docker"

try:
    from models import Base, Dataset, DatasetFile, FileColumn
    from database import DATABASE_URL
except ImportError as e:
    print(f"❌ Erreur d'import: {e}")
    print(f"🔍 Contexte détecté: {context}")
    print(f"📁 Répertoire script: {script_dir}")
    print(f"📁 Répertoire service: {service_dir}")
    if context == "local":
        print("💡 Assurez-vous d'exécuter ce script depuis le répertoire service-selection/")
        print("   cd service-selection && python scripts/init_ednet_dataset.py")
    else:
        print("💡 Problème d'import dans le conteneur Docker")
        print("   Vérifiez que les modules sont bien copiés dans l'image")
    sys.exit(1)

def init_ednet_dataset():
    """
    Initialise le dataset EdNet avec tous ses fichiers et colonnes.
    
    Supprime les données existantes et recrée tout.
    """
    
    # Configuration de la base de données
    try:
        database_url = DATABASE_URL
        print(f"🔌 Connexion à la base de données...")
    except Exception as e:
        print(f"❌ Erreur de configuration base de données: {e}")
        print("💡 Vérifiez que DATABASE_URL est définie dans l'environnement")
        sys.exit(1)
    
    # Créer l'engine et la session
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as session:
        try:
            print("🗑️  Suppression des données existantes du dataset EdNet...")
            
            # Supprimer le dataset EdNet s'il existe déjà (cascade supprimera fichiers et colonnes)
            existing_dataset = session.query(Dataset).filter(
                Dataset.dataset_name == "EdNet (Riiid Answer Correctness)"
            ).first()
            
            if existing_dataset:
                session.delete(existing_dataset)
                session.commit()
                print("✅ Données existantes supprimées")
            
            print("📊 Création du dataset EdNet...")
            
            # === CRÉATION DU DATASET PRINCIPAL ===
            dataset = Dataset(
                # UUID sera généré automatiquement
                
                # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
                dataset_name="EdNet (Riiid Answer Correctness)",
                year=2020,
                objective="Prédiction de la réussite aux exercices",
                access="public",
                availability="online_download",
                num_citations=50,
                citation_link="Riiid Answer Correctness Prediction | Kaggle",
                sources="Application Santa de Riiid",
                storage_uri=None,  # Vide pour le moment
                
                # === CARACTÉRISTIQUES TECHNIQUES ===
                instances_number=131000000,
                features_description="User ID, question ID, timestamp, correct, etc.",
                features_number=10,  # Colonnes principales dans train.csv
                domain=["éducation"],
                representativity_description="Large (plus de 700 000 élèves)",
                representativity_level="élevée",
                sample_balance_description=None,
                sample_balance_level=None,
                split=True,
                missing_values_description=None,
                has_missing_values=False,
                global_missing_percentage=0.0,
                missing_values_handling_method="none",
                temporal_factors=True,
                metadata_provided_with_dataset=True,
                external_documentation_available=True,
                documentation_link=None,
                task=["classification"],
                
                # === CRITÈRES ÉTHIQUES ===
                informed_consent=True,
                transparency=False,
                user_control=False,
                equity_non_discrimination=False,
                security_measures_in_place=True,
                data_quality_documented=True,
                data_errors_description=None,
                anonymization_applied=True,
                record_keeping_policy_exists=True,
                purpose_limitation_respected=True,
                accountability_defined=True
            )
            
            session.add(dataset)
            session.flush()  # Pour obtenir l'ID du dataset
            
            print(f"✅ Dataset créé avec ID: {dataset.id}")
            
            # === CRÉATION DES FICHIERS ===
            files_data = [
                {
                    "name": "train.csv",
                    "role": "training_data",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 5000000000,  # ~5GB d'après description
                    "row_count": 131000000,
                    "description": "Fichier principal d'entraînement contenant les interactions utilisateur-question",
                    "columns": [
                        {"name": "row_id", "type_orig": "int64", "type_interp": "numerical", "desc": "ID code for the row", "pos": 1, "is_pk": True, "is_null": False, "is_pii": False, "examples": ["0", "1", "2"]},
                        {"name": "timestamp", "type_orig": "int64", "type_interp": "temporal", "desc": "Time in milliseconds between user interaction and first event", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1500", "3200"]},
                        {"name": "user_id", "type_orig": "int32", "type_interp": "categorical", "desc": "ID code for the user", "pos": 3, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["115", "501", "1024"]},
                        {"name": "content_id", "type_orig": "int16", "type_interp": "categorical", "desc": "ID code for the user interaction", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["25", "128", "256"]},
                        {"name": "content_type_id", "type_orig": "int8", "type_interp": "categorical", "desc": "0 for question, 1 for lecture", "pos": 5, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1"]},
                        {"name": "task_container_id", "type_orig": "int16", "type_interp": "categorical", "desc": "ID for batch of questions or lectures", "pos": 6, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["1", "15", "32"]},
                        {"name": "user_answer", "type_orig": "int8", "type_interp": "categorical", "desc": "User's answer to question (-1 for null)", "pos": 7, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["0", "1", "2", "3", "-1"]},
                        {"name": "answered_correctly", "type_orig": "int8", "type_interp": "categorical", "desc": "Whether user responded correctly (-1 for null)", "pos": 8, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["0", "1", "-1"]},
                        {"name": "prior_question_elapsed_time", "type_orig": "float32", "type_interp": "numerical", "desc": "Average time in ms for previous question bundle", "pos": 9, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["1500.5", "2300.8", "null"]},
                        {"name": "prior_question_had_explanation", "type_orig": "bool", "type_interp": "categorical", "desc": "Whether user saw explanation after previous bundle", "pos": 10, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["true", "false", "null"]}
                    ]
                },
                {
                    "name": "questions.csv",
                    "role": "metadata",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 10000000,  # Estimation
                    "row_count": 13523,  # Estimation basée sur les IDs de questions
                    "description": "Métadonnées des questions posées aux utilisateurs",
                    "columns": [
                        {"name": "question_id", "type_orig": "int", "type_interp": "categorical", "desc": "Foreign key for content_id when content_type is question", "pos": 1, "is_pk": True, "is_null": False, "is_pii": False, "examples": ["25", "128", "256"]},
                        {"name": "bundle_id", "type_orig": "int", "type_interp": "categorical", "desc": "Code for which questions are served together", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["1", "15", "32"]},
                        {"name": "correct_answer", "type_orig": "int", "type_interp": "categorical", "desc": "The correct answer to the question", "pos": 3, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1", "2", "3"]},
                        {"name": "part", "type_orig": "int", "type_interp": "categorical", "desc": "The relevant section of the TOEIC test", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["1", "2", "3", "4", "5", "6", "7"]},
                        {"name": "tags", "type_orig": "string", "type_interp": "text", "desc": "Detailed tag codes for the question", "pos": 5, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["1 2 3", "4 5", "6"]}
                    ]
                },
                {
                    "name": "lectures.csv",
                    "role": "metadata",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 1000000,  # Estimation
                    "row_count": 418,  # Estimation basée sur les IDs de lectures
                    "description": "Métadonnées des cours regardés par les utilisateurs",
                    "columns": [
                        {"name": "lecture_id", "type_orig": "int", "type_interp": "categorical", "desc": "Foreign key for content_id when content_type is lecture", "pos": 1, "is_pk": True, "is_null": False, "is_pii": False, "examples": ["1", "15", "32"]},
                        {"name": "part", "type_orig": "int", "type_interp": "categorical", "desc": "Top level category code for the lecture", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["1", "2", "3", "4", "5", "6", "7"]},
                        {"name": "tag", "type_orig": "string", "type_interp": "text", "desc": "Tag code for the lecture", "pos": 3, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["1", "2", "3"]},
                        {"name": "type_of", "type_orig": "string", "type_interp": "text", "desc": "Brief description of the core purpose of the lecture", "pos": 4, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["solving question", "watching", "concept"]}
                    ]
                },
                {
                    "name": "example_test_rows.csv",
                    "role": "test_sample",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 1000000,  # Estimation
                    "row_count": 1000,  # Échantillon
                    "description": "Échantillon de données de test pour l'API time-series",
                    "columns": [
                        {"name": "row_id", "type_orig": "int64", "type_interp": "numerical", "desc": "ID code for the row", "pos": 1, "is_pk": True, "is_null": False, "is_pii": False, "examples": ["0", "1", "2"]},
                        {"name": "timestamp", "type_orig": "int64", "type_interp": "temporal", "desc": "Time in milliseconds between user interaction and first event", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1500", "3200"]},
                        {"name": "user_id", "type_orig": "int32", "type_interp": "categorical", "desc": "ID code for the user", "pos": 3, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["115", "501", "1024"]},
                        {"name": "content_id", "type_orig": "int16", "type_interp": "categorical", "desc": "ID code for the user interaction", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["25", "128", "256"]},
                        {"name": "content_type_id", "type_orig": "int8", "type_interp": "categorical", "desc": "0 for question, 1 for lecture", "pos": 5, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1"]},
                        {"name": "task_container_id", "type_orig": "int16", "type_interp": "categorical", "desc": "ID for batch of questions or lectures", "pos": 6, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["1", "15", "32"]},
                        {"name": "prior_group_responses", "type_orig": "string", "type_interp": "text", "desc": "User answers from previous group as string list", "pos": 7, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["[0, 1, 2]", "[1, 3]", "null"]},
                        {"name": "prior_group_answers_correct", "type_orig": "string", "type_interp": "text", "desc": "Correct answers from previous group as string list", "pos": 8, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["[1, 0, 1]", "[0, 1]", "null"]}
                    ]
                },
                {
                    "name": "example_sample_submission.csv",
                    "role": "submission_template",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 971,  # Taille exacte donnée
                    "row_count": 100,  # Estimation
                    "description": "Fichier d'exemple pour les soumissions de la compétition",
                    "columns": [
                        {"name": "row_id", "type_orig": "int64", "type_interp": "numerical", "desc": "ID code for the row", "pos": 1, "is_pk": True, "is_null": False, "is_pii": False, "examples": ["0", "1", "2"]},
                        {"name": "answered_correctly", "type_orig": "float", "type_interp": "numerical", "desc": "Predicted probability of correct answer", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0.5", "0.7", "0.3"]}
                    ]
                }
            ]
            
            # Créer les fichiers et leurs colonnes
            for file_info in files_data:
                print(f"📁 Création du fichier: {file_info['name']}")
                
                # Créer le fichier
                dataset_file = DatasetFile(
                    dataset_id=dataset.id,
                    file_name_in_storage=file_info["name"],
                    logical_role=file_info["role"],
                    format=file_info["format"],
                    mime_type=file_info["mime_type"],
                    size_bytes=file_info["size_bytes"],
                    row_count=file_info["row_count"],
                    description=file_info["description"]
                )
                
                session.add(dataset_file)
                session.flush()  # Pour obtenir l'ID du fichier
                
                # Créer les colonnes
                for col_info in file_info["columns"]:
                    file_column = FileColumn(
                        dataset_file_id=dataset_file.id,
                        column_name=col_info["name"],
                        data_type_original=col_info["type_orig"],
                        data_type_interpreted=col_info["type_interp"],
                        description=col_info["desc"],
                        is_primary_key_component=col_info["is_pk"],
                        is_nullable=col_info["is_null"],
                        is_pii=col_info["is_pii"],
                        example_values=col_info["examples"],
                        position=col_info["pos"],
                        stats=None  # Pas de statistiques pour le moment
                    )
                    session.add(file_column)
                
                print(f"  ✅ {len(file_info['columns'])} colonnes créées")
            
            # Valider toutes les modifications
            session.commit()
            
            print("\n🎉 Dataset EdNet initialisé avec succès !")
            print(f"📊 Dataset ID: {dataset.id}")
            print(f"📁 {len(files_data)} fichiers créés")
            
            total_columns = sum(len(f["columns"]) for f in files_data)
            print(f"📋 {total_columns} colonnes créées au total")
            
        except Exception as e:
            session.rollback()
            print(f"❌ Erreur lors de l'initialisation: {e}")
            raise
        finally:
            session.close()

def main():
    """Point d'entrée principal du script."""
    print("🚀 Initialisation du dataset EdNet (Riiid Answer Correctness)")
    print("=" * 60)
    
    try:
        init_ednet_dataset()
        print("\n✅ Initialisation terminée avec succès !")
        
    except Exception as e:
        print(f"\n❌ Échec de l'initialisation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 