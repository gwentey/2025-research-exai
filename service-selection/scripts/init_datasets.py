#!/usr/bin/env python3
"""
Script d'initialisation pour insérer les datasets dans la base de données normalisée.

Datasets supportés:
- EdNet (Riiid Answer Correctness): Dataset de prédiction de réussite aux exercices
- OULAD: Open University Learning Analytics Dataset pour l'analyse d'apprentissage en ligne
- Students Performance in Exams: Dataset sur l'impact des facteurs socio-éducatifs sur les scores aux examens
- Students' Social Media Addiction: Dataset sur l'usage des réseaux sociaux et impact académique/relationnel

Ce script peut être exécuté pour réinsérer les données de test à chaque fois.

Usage:
    cd service-selection
    python scripts/init_datasets.py [ednet|oulad|students|social|all]
    
    Exemples:
    python scripts/init_datasets.py ednet     # Initialise seulement EdNet
    python scripts/init_datasets.py oulad     # Initialise seulement OULAD
    python scripts/init_datasets.py students  # Initialise seulement Students Performance
    python scripts/init_datasets.py social    # Initialise seulement Social Media Addiction
    python scripts/init_datasets.py all       # Initialise tous les datasets
    python scripts/init_datasets.py           # Initialise tous les datasets (défaut)

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

def init_oulad_dataset():
    """
    Initialise le dataset OULAD avec tous ses fichiers et colonnes.
    
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
            print("🗑️  Suppression des données existantes du dataset OULAD...")
            
            # Supprimer le dataset OULAD s'il existe déjà (cascade supprimera fichiers et colonnes)
            existing_dataset = session.query(Dataset).filter(
                Dataset.dataset_name == "OULAD"
            ).first()
            
            if existing_dataset:
                session.delete(existing_dataset)
                session.commit()
                print("✅ Données existantes supprimées")
            
            print("📊 Création du dataset OULAD...")
            
            # === CRÉATION DU DATASET PRINCIPAL ===
            dataset = Dataset(
                # UUID sera généré automatiquement
                
                # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
                dataset_name="OULAD",
                year=2014,
                objective="Analyse de l'apprentissage en ligne dans l'enseignement supérieur",
                access="public",
                availability="online_download",
                num_citations=1800,
                citation_link="OULAD: Open University Learning Analytics Dataset",
                sources="Open University",
                storage_uri=None,  # Vide pour le moment
                
                # === CARACTÉRISTIQUES TECHNIQUES ===
                instances_number=32593,
                features_description="données démographiques, interactions VLE, scores",
                features_number=25,
                domain=["éducation"],
                representativity_description="Université UK à distance",
                representativity_level="moyenne",
                sample_balance_description=None,
                sample_balance_level=None,
                split=True,
                missing_values_description="Quelques valeurs manquantes sur les scores finaux",
                has_missing_values=True,
                global_missing_percentage=0.5,
                missing_values_handling_method="row_deletion",
                temporal_factors=True,
                metadata_provided_with_dataset=True,
                external_documentation_available=True,
                documentation_link=None,
                task=["classification"],
                
                # === CRITÈRES ÉTHIQUES ===
                informed_consent=True,
                transparency=True,
                user_control=False,
                equity_non_discrimination=True,
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
                    "name": "assessments.csv",
                    "role": "metadata",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 8200,  # 8.2 kB
                    "row_count": 206,  # Estimation basée sur les données
                    "description": "Informations sur les évaluations (TMA, CMA, Exam) pour chaque module",
                    "columns": [
                        {"name": "code_module", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification du module", "pos": 1, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["AAA", "BBB", "CCC"]},
                        {"name": "code_presentation", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification de la présentation", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["2013J", "2014B", "2014J"]},
                        {"name": "id_assessment", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique de l'évaluation", "pos": 3, "is_pk": True, "is_null": False, "is_pii": False, "examples": ["1752", "1753", "14991"]},
                        {"name": "assessment_type", "type_orig": "string", "type_interp": "categorical", "desc": "Type d'évaluation", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["TMA", "CMA", "Exam"]},
                        {"name": "date", "type_orig": "int", "type_interp": "temporal", "desc": "Date de l'évaluation", "pos": 5, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["19", "54", "100"]},
                        {"name": "weight", "type_orig": "float", "type_interp": "numerical", "desc": "Poids de l'évaluation dans la note finale", "pos": 6, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["10", "20", "100"]}
                    ]
                },
                {
                    "name": "courses.csv",
                    "role": "metadata",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 526,  # 526 B
                    "row_count": 22,  # Estimation basée sur les modules et présentations
                    "description": "Informations sur les cours/modules et leurs présentations",
                    "columns": [
                        {"name": "code_module", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification du module", "pos": 1, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["AAA", "BBB", "CCC"]},
                        {"name": "code_presentation", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification de la présentation", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["2013J", "2014B", "2014J"]},
                        {"name": "module_presentation_length", "type_orig": "int", "type_interp": "numerical", "desc": "Durée de la présentation du module", "pos": 3, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["268", "269", "237"]}
                    ]
                },
                {
                    "name": "studentAssessment.csv",
                    "role": "assessment_data",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 5690000,  # 5.69 MB
                    "row_count": 173912,  # Estimation basée sur les données
                    "description": "Résultats des étudiants aux évaluations",
                    "columns": [
                        {"name": "id_assessment", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique de l'évaluation", "pos": 1, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["1752", "1753", "14991"]},
                        {"name": "id_student", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique de l'étudiant", "pos": 2, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["11391", "28400", "30268"]},
                        {"name": "date_submitted", "type_orig": "int", "type_interp": "temporal", "desc": "Date de soumission de l'évaluation", "pos": 3, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["18", "19", "20"]},
                        {"name": "is_banked", "type_orig": "bool", "type_interp": "categorical", "desc": "Indique si l'évaluation est mise en banque", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1"]},
                        {"name": "score", "type_orig": "float", "type_interp": "numerical", "desc": "Score obtenu à l'évaluation", "pos": 5, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["78", "85", "92"]}
                    ]
                },
                {
                    "name": "studentInfo.csv",
                    "role": "student_data",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 3460000,  # 3.46 MB
                    "row_count": 32593,
                    "description": "Informations démographiques et académiques des étudiants",
                    "columns": [
                        {"name": "code_module", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification du module", "pos": 1, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["AAA", "BBB", "CCC"]},
                        {"name": "code_presentation", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification de la présentation", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["2013J", "2014B", "2014J"]},
                        {"name": "id_student", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique de l'étudiant", "pos": 3, "is_pk": True, "is_null": False, "is_pii": True, "examples": ["11391", "28400", "30268"]},
                        {"name": "gender", "type_orig": "string", "type_interp": "categorical", "desc": "Genre de l'étudiant", "pos": 4, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["M", "F"]},
                        {"name": "region", "type_orig": "string", "type_interp": "categorical", "desc": "Région de résidence de l'étudiant", "pos": 5, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["Scotland", "East Anglian Region", "North Western Region"]},
                        {"name": "highest_education", "type_orig": "string", "type_interp": "categorical", "desc": "Plus haut niveau d'éducation", "pos": 6, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["HE Qualification", "A Level or Equivalent", "Lower Than A Level"]},
                        {"name": "imd_band", "type_orig": "string", "type_interp": "categorical", "desc": "Bande d'indice de défavorisation", "pos": 7, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["90-100%", "20-30%", "30-40%"]},
                        {"name": "age_band", "type_orig": "string", "type_interp": "categorical", "desc": "Tranche d'âge", "pos": 8, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["55<=", "35-55", "0-35"]},
                        {"name": "num_of_prev_attempts", "type_orig": "int", "type_interp": "numerical", "desc": "Nombre de tentatives précédentes", "pos": 9, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1", "2"]},
                        {"name": "studied_credits", "type_orig": "int", "type_interp": "numerical", "desc": "Nombre de crédits étudiés", "pos": 10, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["240", "60", "120"]},
                        {"name": "disability", "type_orig": "string", "type_interp": "categorical", "desc": "Statut de handicap", "pos": 11, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["N", "Y"]},
                        {"name": "final_result", "type_orig": "string", "type_interp": "categorical", "desc": "Résultat final du cours", "pos": 12, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["Pass", "Withdrawn", "Fail", "Distinction"]}
                    ]
                },
                {
                    "name": "studentRegistration.csv",
                    "role": "registration_data",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 1110000,  # 1.11 MB
                    "row_count": 32593,
                    "description": "Informations d'inscription et de désinscription des étudiants",
                    "columns": [
                        {"name": "code_module", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification du module", "pos": 1, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["AAA", "BBB", "CCC"]},
                        {"name": "code_presentation", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification de la présentation", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["2013J", "2014B", "2014J"]},
                        {"name": "id_student", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique de l'étudiant", "pos": 3, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["11391", "28400", "30268"]},
                        {"name": "date_registration", "type_orig": "int", "type_interp": "temporal", "desc": "Date d'inscription", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["-150", "-100", "-50"]},
                        {"name": "date_unregistration", "type_orig": "int", "type_interp": "temporal", "desc": "Date de désinscription", "pos": 5, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["50", "100", "null"]}
                    ]
                },
                {
                    "name": "vle.csv",
                    "role": "metadata",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 260130,  # 260.13 kB
                    "row_count": 6364,  # Estimation
                    "description": "Informations sur les activités du VLE (Virtual Learning Environment)",
                    "columns": [
                        {"name": "id_site", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique du site/activité VLE", "pos": 1, "is_pk": True, "is_null": False, "is_pii": False, "examples": ["546943", "547217", "547447"]},
                        {"name": "code_module", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification du module", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["AAA", "BBB", "CCC"]},
                        {"name": "code_presentation", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification de la présentation", "pos": 3, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["2013J", "2014B", "2014J"]},
                        {"name": "activity_type", "type_orig": "string", "type_interp": "categorical", "desc": "Type d'activité VLE", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["resource", "subpage", "homepage"]},
                        {"name": "week_from", "type_orig": "int", "type_interp": "temporal", "desc": "Semaine de début d'activité", "pos": 5, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["0", "1", "5"]},
                        {"name": "week_to", "type_orig": "int", "type_interp": "temporal", "desc": "Semaine de fin d'activité", "pos": 6, "is_pk": False, "is_null": True, "is_pii": False, "examples": ["5", "10", "29"]}
                    ]
                }
            ]
            
            # Ajouter les fichiers studentVle_0.csv à studentVle_7.csv
            for i in range(8):
                studentVle_file = {
                    "name": f"studentVle_{i}.csv",
                    "role": "interaction_data",
                    "format": "csv",
                    "mime_type": "text/csv",
                    "size_bytes": 57000000,  # ~57 MB chacun (estimation)
                    "row_count": 1500000,  # ~1.5M lignes chacun (estimation)
                    "description": f"Interactions des étudiants avec le VLE - partie {i+1}/8",
                    "columns": [
                        {"name": "code_module", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification du module", "pos": 1, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["AAA", "BBB", "CCC"]},
                        {"name": "code_presentation", "type_orig": "string", "type_interp": "categorical", "desc": "Code identification de la présentation", "pos": 2, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["2013J", "2014B", "2014J"]},
                        {"name": "id_student", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique de l'étudiant", "pos": 3, "is_pk": False, "is_null": False, "is_pii": True, "examples": ["11391", "28400", "30268"]},
                        {"name": "id_site", "type_orig": "int", "type_interp": "categorical", "desc": "Identifiant unique du site/activité VLE", "pos": 4, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["546943", "547217", "547447"]},
                        {"name": "date", "type_orig": "int", "type_interp": "temporal", "desc": "Date de l'interaction (jour relatif)", "pos": 5, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["-24", "0", "50"]},
                        {"name": "sum_click", "type_orig": "int", "type_interp": "numerical", "desc": "Nombre total de clics sur le site ce jour-là", "pos": 6, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["1", "5", "20"]},
                        {"name": "week", "type_orig": "int", "type_interp": "temporal", "desc": "Semaine relative du cours", "pos": 7, "is_pk": False, "is_null": False, "is_pii": False, "examples": ["0", "1", "10"]}
                    ]
                }
                files_data.append(studentVle_file)
            
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
            
            print("\n🎉 Dataset OULAD initialisé avec succès !")
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

def init_students_performance_dataset():
    """
    Initialise le dataset Students Performance in Exams avec son fichier et colonnes.
    
    Supprime les données existantes et recrée tout.
    """
    
    # Configuration de la base de données
    try:
        database_url = DATABASE_URL
        print(f"🔌 Connexion à la base de données...")
    except Exception as e:
        print(f"❌ Erreur de configuration base de données: {e}")
        print("💡 Vérifiez que DATABASE_URL est définie dans les variables d'environnement")
        sys.exit(1)
    
    # Créer l'engine et la session
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as session:
        try:
            # === SUPPRESSION DES DONNÉES EXISTANTES ===
            print("🗑️  Suppression des données existantes pour 'Students Performance in Exams'...")
            
            # Supprimer le dataset Students Performance s'il existe déjà (cascade supprimera fichiers et colonnes)
            existing_dataset = session.query(Dataset).filter(
                Dataset.dataset_name == 'Students Performance in Exams'
            ).first()
            
            if existing_dataset:
                session.delete(existing_dataset)
                session.commit()
                print("✅ Données existantes supprimées")
            
            # === CRÉATION DU DATASET ===
            print("📊 Création du dataset Students Performance in Exams...")
            
            dataset = Dataset(
                # UUID sera généré automatiquement
                
                # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
                dataset_name='Students Performance in Exams',
                year=2018,
                objective='Analyser les effets des facteurs socio-éducatifs sur les scores aux examens',
                access='public',
                availability='online_download',
                num_citations=250,
                citation_link='https://www.kaggle.com/datasets/spscientist/students-performance-in-exams',
                sources='US educational sample',
                storage_uri=None,  # Vide pour le moment
                
                # === CARACTÉRISTIQUES TECHNIQUES ===
                instances_number=1000,
                features_description='Genre, origine, repas, éducation parents, scores',
                features_number=8,
                domain=['éducation'],
                representativity_description='Échantillon US',
                representativity_level='moyenne',
                sample_balance_description=None,
                sample_balance_level=None,
                split=False,
                missing_values_description='Non',
                has_missing_values=False,
                global_missing_percentage=0.0,
                missing_values_handling_method='none',
                temporal_factors=False,
                metadata_provided_with_dataset=False,
                external_documentation_available=True,
                documentation_link=None,
                task=['regression', 'classification'],
                
                # === CRITÈRES ÉTHIQUES ===
                informed_consent=False,
                transparency=False,
                user_control=False,
                equity_non_discrimination=False,
                security_measures_in_place=True,
                data_quality_documented=True,
                data_errors_description=None,
                anonymization_applied=True,
                record_keeping_policy_exists=False,
                purpose_limitation_respected=True,
                accountability_defined=True
            )
            
            session.add(dataset)
            session.flush()  # Pour obtenir l'ID du dataset
            
            print(f"✅ Dataset créé avec ID: {dataset.id}")
            
            # === CRÉATION DU FICHIER ===
            print("📁 Création du fichier StudentsPerformance.csv...")
            
            dataset_file = DatasetFile(
                dataset_id=dataset.id,
                file_name_in_storage='StudentsPerformance.csv',
                logical_role='main_data',
                format='csv',
                mime_type='text/csv',
                size_bytes=73788,  # 72.04 kB
                row_count=1000,
                description='Scores obtenus par des étudiants du secondaire aux États-Unis'
            )
            
            session.add(dataset_file)
            session.flush()  # Pour obtenir l'ID du fichier
            
            print(f"✅ Fichier créé avec ID: {dataset_file.id}")
            
            # === CRÉATION DES COLONNES ===
            print("🔢 Création des 8 colonnes...")
            
            columns_data = [
                # Colonnes démographiques et socio-économiques
                {
                    'name': 'gender', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Genre de l\'étudiant', 'pos': 1, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['female', 'male']
                },
                {
                    'name': 'race/ethnicity', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Groupe ethnique de l\'étudiant', 'pos': 2, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['group A', 'group B', 'group C', 'group D', 'group E']
                },
                {
                    'name': 'parental level of education', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Niveau d\'éducation des parents', 'pos': 3, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['some high school', 'high school', 'some college', 'associate\'s degree', 'bachelor\'s degree', 'master\'s degree']
                },
                {
                    'name': 'lunch', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Type de repas (indicateur socio-économique)', 'pos': 4, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['standard', 'free/reduced']
                },
                {
                    'name': 'test preparation course', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Préparation aux examens suivie', 'pos': 5, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['none', 'completed']
                },
                
                # Colonnes de scores (variables cibles)
                {
                    'name': 'math score', 'type_orig': 'int', 'type_interp': 'numerical', 
                    'desc': 'Score en mathématiques (0-100)', 'pos': 6, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['0', '50', '72', '100']
                },
                {
                    'name': 'reading score', 'type_orig': 'int', 'type_interp': 'numerical', 
                    'desc': 'Score en lecture (17-100)', 'pos': 7, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['17', '55', '72', '100']
                },
                {
                    'name': 'writing score', 'type_orig': 'int', 'type_interp': 'numerical', 
                    'desc': 'Score en écriture (10-100)', 'pos': 8, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['10', '55', '74', '100']
                }
            ]
            
            # Créer les colonnes
            for col_info in columns_data:
                file_column = FileColumn(
                    dataset_file_id=dataset_file.id,
                    column_name=col_info['name'],
                    data_type_original=col_info['type_orig'],
                    data_type_interpreted=col_info['type_interp'],
                    description=col_info['desc'],
                    is_primary_key_component=col_info['is_pk'],
                    is_nullable=col_info['is_null'],
                    is_pii=col_info['is_pii'],
                    example_values=col_info['examples'],
                    position=col_info['pos'],
                    stats=None  # Pas de statistiques pour le moment
                )
                session.add(file_column)
                print(f"   ✓ Colonne {col_info['pos']}/8: {col_info['name']}")
            
            # Valider toutes les modifications
            session.commit()
            
            print("\n🎉 Dataset 'Students Performance in Exams' initialisé avec succès !")
            print(f"📊 Dataset ID: {dataset.id}")
            print(f"📁 1 fichier créé")
            print(f"📋 8 colonnes créées")
            
        except Exception as e:
            session.rollback()
            print(f"❌ Erreur lors de l'initialisation: {e}")
            raise
        finally:
            session.close()


def init_social_media_addiction_dataset():
    """
    Initialise le dataset Students' Social Media Addiction avec son fichier et colonnes.
    
    Supprime les données existantes et recrée tout.
    """
    
    # Configuration de la base de données
    try:
        database_url = DATABASE_URL
        print(f"🔌 Connexion à la base de données...")
    except Exception as e:
        print(f"❌ Erreur de configuration base de données: {e}")
        print("💡 Vérifiez que DATABASE_URL est définie dans les variables d'environnement")
        sys.exit(1)
    
    # Créer l'engine et la session
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as session:
        try:
            # === SUPPRESSION DES DONNÉES EXISTANTES ===
            print("🗑️  Suppression des données existantes pour 'Students' Social Media Addiction'...")
            
            # Supprimer le dataset Social Media Addiction s'il existe déjà (cascade supprimera fichiers et colonnes)
            existing_dataset = session.query(Dataset).filter(
                Dataset.dataset_name == "Students' Social Media Addiction"
            ).first()
            
            if existing_dataset:
                session.delete(existing_dataset)
                session.commit()
                print("✅ Données existantes supprimées")
            
            # === CRÉATION DU DATASET ===
            print("📊 Création du dataset Students' Social Media Addiction...")
            
            dataset = Dataset(
                # UUID sera généré automatiquement
                
                # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
                dataset_name="Students' Social Media Addiction",
                year=2025,
                objective="Analyze cross-country patterns of social media usage, academic impact, and relationships",
                access="public",
                availability="public",
                num_citations=None,  # Pas de nombre spécifique donné
                citation_link="https://www.kaggle.com/datasets/adilshamim8/social-media-addiction-vs-relationships",
                sources="University surveys, online social media recruitment",
                storage_uri=None,  # Vide pour le moment
                
                # === CARACTÉRISTIQUES TECHNIQUES ===
                instances_number=705,
                features_description="Age, Gender, Academic Level, Usage, Mental health, etc.",
                features_number=13,
                domain=["éducation"],
                representativity_description="Multi-country student sample (ages 16–25, diverse education)",
                representativity_level="moyenne",
                sample_balance_description=None,
                sample_balance_level=None,
                split=False,
                missing_values_description="Quelques valeurs manquantes sur les scores finaux",
                has_missing_values=False,
                global_missing_percentage=0.0,
                missing_values_handling_method="none",
                temporal_factors=True,  # Q1 2025
                metadata_provided_with_dataset=True,
                external_documentation_available=True,
                documentation_link=None,
                task=["classification", "clustering", "regression"],
                
                # === CRITÈRES ÉTHIQUES ===
                informed_consent=True,
                transparency=True,
                user_control=False,
                equity_non_discrimination=False,
                security_measures_in_place=True,
                data_quality_documented=True,
                data_errors_description=None,
                anonymization_applied=True,
                record_keeping_policy_exists=False,
                purpose_limitation_respected=True,
                accountability_defined=True
            )
            
            session.add(dataset)
            session.flush()  # Pour obtenir l'ID du dataset
            
            print(f"✅ Dataset créé avec ID: {dataset.id}")
            
            # === CRÉATION DU FICHIER ===
            print("📁 Création du fichier Students Social Media Addiction.csv...")
            
            dataset_file = DatasetFile(
                dataset_id=dataset.id,
                file_name_in_storage='Students Social Media Addiction.csv',
                logical_role='main_data',
                format='csv',
                mime_type='text/csv',
                size_bytes=49820,  # 49.82 kB
                row_count=705,
                description='Survey responses from students aged 16–25 across multiple countries, capturing social media usage patterns and life outcomes'
            )
            
            session.add(dataset_file)
            session.flush()  # Pour obtenir l'ID du fichier
            
            print(f"✅ Fichier créé avec ID: {dataset_file.id}")
            
            # === CRÉATION DES COLONNES ===
            print("🔢 Création des 13 colonnes...")
            
            columns_data = [
                # Identifiant et données démographiques
                {
                    'name': 'Student_ID', 'type_orig': 'int', 'type_interp': 'categorical', 
                    'desc': 'Unique identifier assigned to each survey respondent', 'pos': 1, 'is_pk': True, 'is_null': False, 
                    'is_pii': False, 'examples': ['1', '2', '3', '705']
                },
                {
                    'name': 'Age', 'type_orig': 'int', 'type_interp': 'numerical', 
                    'desc': 'Student age in completed years at time of survey', 'pos': 2, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['18', '19', '20', '21', '22', '23', '24']
                },
                {
                    'name': 'Gender', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Self-reported gender for demographic analysis', 'pos': 3, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['Male', 'Female']
                },
                {
                    'name': 'Academic_Level', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Highest education level currently enrolled in', 'pos': 4, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['High School', 'Undergraduate', 'Graduate']
                },
                {
                    'name': 'Country', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Country of residence where survey was completed', 'pos': 5, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['Bangladesh', 'India', 'USA', 'UK', 'Canada', 'Australia', 'Germany']
                },
                
                # Usage et comportement sur les réseaux sociaux
                {
                    'name': 'Avg_Daily_Usage_Hours', 'type_orig': 'float', 'type_interp': 'numerical', 
                    'desc': 'Average hours per day spent on social media platforms', 'pos': 6, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['1.5', '3.0', '4.5', '6.0', '7.2', '8.5']
                },
                {
                    'name': 'Most_Used_Platform', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Social media platform where student spends most time', 'pos': 7, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'Twitter', 'Snapchat', 'LinkedIn']
                },
                {
                    'name': 'Affects_Academic_Performance', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Whether student perceives social media use impacts academics negatively', 'pos': 8, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['Yes', 'No']
                },
                
                # Bien-être et santé
                {
                    'name': 'Sleep_Hours_Per_Night', 'type_orig': 'float', 'type_interp': 'numerical', 
                    'desc': 'Average nightly sleep duration in hours', 'pos': 9, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['3.8', '5.0', '6.5', '7.0', '8.0', '9.6']
                },
                {
                    'name': 'Mental_Health_Score', 'type_orig': 'int', 'type_interp': 'numerical', 
                    'desc': 'Self-rated mental well-being (1=poor to 10=excellent)', 'pos': 10, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['4', '5', '6', '7', '8', '9']
                },
                
                # Relations et conflits
                {
                    'name': 'Relationship_Status', 'type_orig': 'string', 'type_interp': 'categorical', 
                    'desc': 'Current romantic relationship status', 'pos': 11, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['Single', 'In Relationship', 'Complicated']
                },
                {
                    'name': 'Conflicts_Over_Social_Media', 'type_orig': 'int', 'type_interp': 'numerical', 
                    'desc': 'Number of arguments/disagreements due to social media use', 'pos': 12, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['0', '1', '2', '3', '4', '5']
                },
                
                # Score d'addiction (variable cible principale)
                {
                    'name': 'Addicted_Score', 'type_orig': 'int', 'type_interp': 'numerical', 
                    'desc': 'Social Media Addiction Score (1=low to 10=high addiction)', 'pos': 13, 'is_pk': False, 'is_null': False, 
                    'is_pii': False, 'examples': ['1', '3', '5', '7', '8', '10']
                }
            ]
            
            # Créer les colonnes
            for col_info in columns_data:
                file_column = FileColumn(
                    dataset_file_id=dataset_file.id,
                    column_name=col_info['name'],
                    data_type_original=col_info['type_orig'],
                    data_type_interpreted=col_info['type_interp'],
                    description=col_info['desc'],
                    is_primary_key_component=col_info['is_pk'],
                    is_nullable=col_info['is_null'],
                    is_pii=col_info['is_pii'],
                    example_values=col_info['examples'],
                    position=col_info['pos'],
                    stats=None  # Pas de statistiques pour le moment
                )
                session.add(file_column)
                print(f"   ✓ Colonne {col_info['pos']}/13: {col_info['name']}")
            
            # Valider toutes les modifications
            session.commit()
            
            print("\n🎉 Dataset 'Students' Social Media Addiction' initialisé avec succès !")
            print(f"📊 Dataset ID: {dataset.id}")
            print(f"📁 1 fichier créé")
            print(f"📋 13 colonnes créées")
            
        except Exception as e:
            session.rollback()
            print(f"❌ Erreur lors de l'initialisation: {e}")
            raise
        finally:
            session.close()


def main():
    """Point d'entrée principal du script."""
    print("🚀 Initialisation des datasets")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        dataset_name = sys.argv[1].lower()
        if dataset_name == "ednet":
            print("📊 Initialisation du dataset EdNet uniquement")
            try:
                init_ednet_dataset()
                print("\n✅ Dataset EdNet initialisé avec succès !")
            except Exception as e:
                print(f"\n❌ Échec de l'initialisation EdNet: {e}")
                sys.exit(1)
        elif dataset_name == "oulad":
            print("📊 Initialisation du dataset OULAD uniquement")
            try:
                init_oulad_dataset()
                print("\n✅ Dataset OULAD initialisé avec succès !")
            except Exception as e:
                print(f"\n❌ Échec de l'initialisation OULAD: {e}")
                sys.exit(1)
        elif dataset_name == "students":
            print("📊 Initialisation du dataset Students Performance uniquement")
            try:
                init_students_performance_dataset()
                print("\n✅ Dataset Students Performance initialisé avec succès !")
            except Exception as e:
                print(f"\n❌ Échec de l'initialisation Students Performance: {e}")
                sys.exit(1)
        elif dataset_name == "social":
            print("📊 Initialisation du dataset Social Media Addiction uniquement")
            try:
                init_social_media_addiction_dataset()
                print("\n✅ Dataset Social Media Addiction initialisé avec succès !")
            except Exception as e:
                print(f"\n❌ Échec de l'initialisation Social Media Addiction: {e}")
                sys.exit(1)
        elif dataset_name == "all":
            print("📊 Initialisation de tous les datasets")
            try:
                init_ednet_dataset()
                print("\n✅ Dataset EdNet initialisé avec succès !")
                init_oulad_dataset()
                print("\n✅ Dataset OULAD initialisé avec succès !")
                init_students_performance_dataset()
                print("\n✅ Dataset Students Performance initialisé avec succès !")
                init_social_media_addiction_dataset()
                print("\n✅ Dataset Social Media Addiction initialisé avec succès !")
                print("\n🎉 Tous les datasets ont été initialisés avec succès !")
            except Exception as e:
                print(f"\n❌ Échec de l'initialisation: {e}")
                sys.exit(1)
        else:
            print(f"❌ Dataset inconnu: {dataset_name}")
            print("💡 Usage: python scripts/init_datasets.py [ednet|oulad|students|social|all]")
            sys.exit(1)
    else:
        # Par défaut, initialiser tous les datasets
        print("📊 Initialisation de tous les datasets (par défaut)")
        try:
            init_ednet_dataset()
            print("\n✅ Dataset EdNet initialisé avec succès !")
            init_oulad_dataset()
            print("\n✅ Dataset OULAD initialisé avec succès !")
            init_students_performance_dataset()
            print("\n✅ Dataset Students Performance initialisé avec succès !")
            init_social_media_addiction_dataset()
            print("\n✅ Dataset Social Media Addiction initialisé avec succès !")
            print("\n🎉 Tous les datasets ont été initialisés avec succès !")
        except Exception as e:
            print(f"\n❌ Échec de l'initialisation: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main() 