# 📊 Métadonnées Enrichies par Dataset

Ce répertoire contient les métadonnées spécifiques pour chaque dataset, remplaçant l'ancien système de templates génériques.

## 🏗️ Structure

```
enriched_metadata/
├── README.md                    # Ce fichier
├── schema.json                  # Schéma de validation JSON
├── datasets/
│   ├── student_performance.json # Métadonnées spécifiques au dataset
│   ├── academic_performance.json
│   ├── student_stress.json
│   └── ...
└── templates/
    ├── education_template.json  # Template de base pour domaine éducation
    ├── healthcare_template.json
    └── default_template.json    # Template par défaut
```

## 📋 Format des Fichiers de Métadonnées

Chaque fichier `datasets/{dataset_name}.json` contient TOUTES les métadonnées enrichies pour un dataset spécifique :

```json
{
  "metadata_version": "1.0",
  "dataset_info": {
    "name": "student_performance",
    "source": "kaggle",
    "kaggle_ref": "spscientist/students-performance-in-exams"
  },
  "enriched_metadata": {
    // Tous les 39+ champs du modèle Dataset
    "dataset_name": "Student Performance in Exams",
    "year": 2023,
    "objective": "Analyze factors affecting student performance in exams",
    // ... tous les autres champs
  }
}
```

## ✅ Validation

Toutes les métadonnées sont validées contre :
1. **schema.json** : Structure et types de données
2. **Modèle SQLAlchemy Dataset** : Cohérence avec la base de données
3. **Règles métier** : Logique spécifique (ex: année valide, pourcentages 0-100)

## 🔄 Utilisation

```python
from metadata_loader import DatasetMetadataLoader

# Charger les métadonnées d'un dataset
loader = DatasetMetadataLoader()
metadata = loader.load_dataset_metadata("student_performance")

# Les métadonnées sont prêtes pour l'insertion en base
dataset = Dataset(**metadata)
```

## 🛠️ Maintenance

- **Ajout d'un nouveau dataset** : Créer `datasets/{name}.json`
- **Validation** : `python metadata_manager.py validate`
- **Génération de templates** : `python metadata_manager.py generate-template --domain education`

## 🎯 Avantages

- ✅ **Spécifique** : Chaque dataset a ses propres métadonnées exactes
- ✅ **Modulaire** : Facile d'ajouter/modifier un dataset
- ✅ **Validé** : Contrôle de cohérence automatique
- ✅ **Scalable** : Support de centaines de datasets
- ✅ **Traçable** : Historique des modifications via Git