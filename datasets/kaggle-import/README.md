# 🚀 Système d'Import Kaggle EXAI

## Vue d'ensemble

Le système d'import Kaggle permet d'importer automatiquement des datasets depuis Kaggle vers la plateforme EXAI, résolvant le problème des datasets trop volumineux pour GitHub.

## Architecture

```
Kaggle API → Téléchargement → Conversion Parquet → Upload Stockage → BDD Métadonnées
```

**Avantages** :
- ✅ Pas de limite de taille
- ✅ Import automatique en production
- ✅ Cache intelligent (7 jours)
- ✅ Conversion Parquet optimisée
- ✅ Validation multi-niveaux

## Configuration Requise

### 1. Credentials Kaggle

Créez un compte Kaggle et téléchargez votre `kaggle.json` :

1. Allez sur https://www.kaggle.com/account
2. Cliquez sur "Create New API Token"
3. Téléchargez `kaggle.json`
4. Placez-le dans `~/.kaggle/kaggle.json` (Linux/Mac) ou `%USERPROFILE%\.kaggle\kaggle.json` (Windows)

```bash
# Linux/Mac
mkdir -p ~/.kaggle
mv ~/Downloads/kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json

# Ou via variables d'environnement
export KAGGLE_USERNAME="votre_username"
export KAGGLE_KEY="votre_api_key"
```

### 2. Variables d'Environnement

```bash
# Base de données
export DATABASE_URL="postgresql://user:pass@localhost:5432/exaidb"

# Stockage d'objets
export STORAGE_BACKEND="minio"  # ou "azure"
export MINIO_ENDPOINT="localhost:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
export MINIO_BUCKET="exai-datasets"
```

## Utilisation Locale

### Installation

```bash
cd datasets/kaggle-import
make install
```

### Test de Configuration

```bash
# Tester l'authentification Kaggle
make test-auth

# Vérifier la configuration
make check-config

# Tester les services
make test-services
```

### Import de Datasets

```bash
# Lister les datasets disponibles
make list-datasets

# Importer tous les datasets
make import-all

# Importer seulement les petits datasets (recommandé pour test)
make import-small

# Importer un dataset spécifique
make import-dataset DATASET=student_performance

# Forcer le re-téléchargement (ignore le cache)
make force-refresh
```

### Monitoring

```bash
# Afficher l'état des imports
make status

# Nettoyer les fichiers temporaires
make clean
```

## Utilisation en Production (Kubernetes)

### 1. Configuration des Secrets

```bash
# Encoder les credentials Kaggle en base64
echo -n "votre_username" | base64
echo -n "votre_api_key" | base64

# Éditer le secret Kaggle
kubectl edit secret kaggle-secrets -n exai
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kaggle-secrets
  namespace: exai
data:
  username: <KAGGLE_USERNAME_BASE64>
  key: <KAGGLE_API_KEY_BASE64>
```

### 2. Lancement du Job

```bash
# Créer le job
kubectl apply -f k8s/base/jobs/kaggle-dataset-import-job.yaml

# Suivre les logs
kubectl logs -f job/kaggle-dataset-import-job -n exai

# Vérifier le statut
kubectl get jobs -n exai
kubectl describe job kaggle-dataset-import-job -n exai
```

### 3. Job Récurrent (Optionnel)

Pour automatiser l'import quotidien :

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kaggle-import-cronjob
spec:
  schedule: "0 2 * * *"  # Tous les jours à 2h du matin
  jobTemplate:
    spec:
      template:
        # Copier le contenu du job kaggle-dataset-import-job
```

## Configuration des Datasets

### Fichier de Configuration

`kaggle_datasets_config.yaml` contient la liste des datasets à importer :

```yaml
datasets:
  student_performance:
    kaggle_ref: "spscientist/students-performance-in-exams"
    domain: "education"
    description: "Student performance analysis"
    ml_task: "classification"
    target_column: "math_score"
```

### Ajouter un Nouveau Dataset

1. **Trouver la référence Kaggle** :
   ```
   URL: https://www.kaggle.com/datasets/USERNAME/DATASET-NAME
   Référence: "USERNAME/DATASET-NAME"
   ```

2. **Ajouter à la configuration** :
   ```yaml
   nouveau_dataset:
     kaggle_ref: "username/dataset-name"
     domain: "votre_domaine"
     description: "Description du dataset"
     ml_task: "classification"  # ou "regression"
     target_column: "colonne_cible"
   ```

3. **Importer** :
   ```bash
   make import-dataset DATASET=nouveau_dataset
   ```

## Fonctionnalités Avancées

### Cache Intelligent

- Cache de 7 jours par défaut
- Évite les re-téléchargements inutiles
- Fichiers cache dans `cache/`

### Gestion des Gros Datasets

Pour les datasets > 1GB :

```yaml
large_dataset: true  # Active la gestion spéciale
chunk_size: 50000   # Traitement par chunks
```

### Multi-fichiers

Pour les datasets avec plusieurs CSV :

```yaml
multi_file: true  # Gère automatiquement les fichiers multiples
```

### Conversion Parquet

- Compression Snappy par défaut
- Optimisation automatique des types
- Gains de performance 10-50x

## Dépannage

### Erreurs Courantes

**❌ Erreur d'authentification Kaggle**
```bash
# Vérifier les credentials
make test-auth

# Vérifier le fichier kaggle.json
cat ~/.kaggle/kaggle.json
```

**❌ Erreur de connexion stockage**
```bash
# Vérifier MinIO
docker ps | grep minio

# Tester la connexion
make test-services
```

**❌ Dataset introuvable**
```bash
# Vérifier la référence Kaggle
kaggle datasets list -s "nom_dataset"

# Vérifier la configuration
make check-config
```

### Logs Détaillés

```bash
# Logs locaux
tail -f kaggle_import.log

# Logs Kubernetes
kubectl logs -f job/kaggle-dataset-import-job -n exai
```

### Nettoyage en Cas de Problème

```bash
# Local
make clean

# Kubernetes
kubectl delete job kaggle-dataset-import-job -n exai
```

## Monitoring et Métriques

### Statut des Imports

```bash
# Local
make status

# Kubernetes
kubectl get jobs -n exai
kubectl describe job kaggle-dataset-import-job -n exai
```

### Métriques Importantes

- **Temps d'import** : Visible dans les logs
- **Taille des fichiers** : Avant/après conversion Parquet
- **Succès/échecs** : Résumé final dans les logs
- **Utilisation cache** : Datasets ignorés car cache valide

## Sécurité

### Credentials

- Kaggle API key stocké en secret Kubernetes
- Pas de credentials en dur dans le code
- Rotation recommandée tous les 90 jours

### Données

- Pas de stockage local permanent
- Upload direct vers stockage sécurisé
- Nettoyage automatique des fichiers temporaires

## Évolutions Futures

### Prévues

- [ ] Support d'autres sources (GitHub, URLs directes)
- [ ] Interface web pour la gestion
- [ ] Notifications Slack/Teams
- [ ] Métriques Prometheus

### Possibles

- [ ] Import incrémental
- [ ] Compression avancée
- [ ] Validation de qualité des données
- [ ] Export vers d'autres formats

## Support

### Documentation

- [Guide Architecture](../../docs/modules/ROOT/pages/dev-guide/batch-dataset-import-system.adoc)
- [Configuration Stockage](../../docs/modules/ROOT/pages/dev-guide/object-storage-implementation.adoc)

### Commandes d'Aide

```bash
# Aide générale
make help

# Lister les datasets
make list-datasets

# Vérifier la configuration
make check-config
```

---

**🎉 Le système d'import Kaggle EXAI permet maintenant d'importer facilement des datasets de toute taille sans limitations GitHub !** 