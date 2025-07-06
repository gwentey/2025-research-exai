# Scripts du Service Selection

Ce dossier contient les scripts d'initialisation et de maintenance pour le service `service-selection`.

## 📋 Scripts Disponibles

### `init_ednet_dataset.py`

**Description :** Script d'initialisation pour insérer le dataset EdNet (Riiid Answer Correctness) dans la base de données normalisée.

**Fonctionnalités :**
- ✅ Supprime les données existantes du dataset EdNet
- ✅ Crée le dataset complet avec ~40 critères éthiques
- ✅ Insère 5 fichiers de données avec leurs métadonnées
- ✅ Crée 29 colonnes avec types, descriptions et marquage PII
- ✅ Gestion complète des erreurs et transactions

**Usage :**
```bash
# Depuis le répertoire service-selection/
cd service-selection
python scripts/init_ednet_dataset.py
```

**Prérequis :**
- Base de données PostgreSQL accessible
- Variable d'environnement `DATABASE_URL` définie
- Migrations Alembic appliquées (`alembic upgrade head`)

**Exemple de sortie :**
```
🚀 Initialisation du dataset EdNet (Riiid Answer Correctness)
============================================================
🔌 Connexion à la base de données...
🗑️  Suppression des données existantes du dataset EdNet...
📊 Création du dataset EdNet...
✅ Dataset créé avec ID: 550e8400-e29b-41d4-a716-446655440000
📁 Création du fichier: train.csv
  ✅ 10 colonnes créées
📁 Création du fichier: questions.csv
  ✅ 5 colonnes créées
[...]
🎉 Dataset EdNet initialisé avec succès !
📊 Dataset ID: 550e8400-e29b-41d4-a716-446655440000
📁 5 fichiers créés
📋 29 colonnes créées au total
```

## 🔧 Développement

### Ajouter un nouveau script

1. Créer le fichier Python dans ce dossier
2. Ajouter le shebang `#!/usr/bin/env python3` 
3. Importer les modules nécessaires depuis `../app/`
4. Documenter le script dans ce README

### Structure d'import recommandée

```python
import os
import sys

# Ajouter le répertoire app au path
script_dir = os.path.dirname(os.path.abspath(__file__))
service_dir = os.path.dirname(script_dir)
app_dir = os.path.join(service_dir, 'app')
sys.path.insert(0, app_dir)

# Importer les modules de l'app
from models import Dataset, DatasetFile, FileColumn
from database import get_database_url
```

## 📝 Notes

- Les scripts doivent être exécutés depuis le répertoire `service-selection/`
- Ils utilisent les mêmes modèles et configuration que l'application principale
- La gestion des erreurs doit être robuste (rollback des transactions)
- Pensez à documenter les nouveaux scripts dans ce README 