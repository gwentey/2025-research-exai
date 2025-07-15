# Scripts du Service Selection

Ce dossier contient les scripts d'initialisation et de maintenance pour le service `service-selection`.

## 📋 Scripts Disponibles


**Prérequis :**
- Base de données PostgreSQL accessible
- Variable d'environnement `DATABASE_URL` définie
- Migrations Alembic appliquées (`alembic upgrade head`)


## 🔧 Développement

### Ajouter un nouveau script

1. Créer le fichier Python dans ce dossier
2. Ajouter le shebang `#!/usr/bin/env python3` 
3. Importer les modules nécessaires depuis `../app/`
4. Documenter le script dans ce README

