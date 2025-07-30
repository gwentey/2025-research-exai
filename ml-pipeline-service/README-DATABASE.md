# Base de Données ML Pipeline - Configuration Complète

## 🎯 Vue d'Ensemble

Ce document résume la configuration de la base de données pour le service ML Pipeline d'IBIS-X, suivant l'architecture de base de données partagée avec des migrations indépendantes par service.

## 🏗️ Architecture

### Base de Données Partagée
- **Base** : `ibis_x_db` (PostgreSQL)
- **Table** : `experiments`
- **Version Alembic** : `alembic_version_ml_pipeline`

### Connexion
```python
DATABASE_URL = "postgresql://ibis_x_user:password@postgresql-service:5432/ibis_x_db"
```

## 📊 Structure de Table

### Table `experiments`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Clé primaire |
| `user_id` | UUID | ID de l'utilisateur |
| `project_id` | UUID | ID du projet |
| `dataset_id` | UUID | ID du dataset |
| `algorithm` | VARCHAR(50) | Algorithme ML |
| `hyperparameters` | JSONB | Hyperparamètres |
| `preprocessing_config` | JSONB | Configuration préprocessing |
| `status` | VARCHAR(20) | Statut ('pending', 'running', 'completed', 'failed') |
| `progress` | INTEGER | Progression (0-100) |
| `task_id` | VARCHAR(100) | ID tâche Celery |
| `error_message` | TEXT | Message d'erreur |
| `metrics` | JSONB | Métriques de performance |
| `model_uri` | VARCHAR(500) | URI du modèle sauvegardé |
| `visualizations` | JSONB | URLs des visualisations |
| `feature_importance` | JSONB | Importance des features |
| `created_at` | TIMESTAMPTZ | Date de création |
| `updated_at` | TIMESTAMPTZ | Date de modification |

### Index de Performance

```sql
CREATE INDEX ix_experiments_user_id ON experiments(user_id);
CREATE INDEX ix_experiments_project_id ON experiments(project_id);
CREATE INDEX ix_experiments_dataset_id ON experiments(dataset_id);
CREATE INDEX ix_experiments_status ON experiments(status);
CREATE INDEX ix_experiments_created_at ON experiments(created_at);
```

## 📁 Fichiers de Configuration

### Structure
```
ml-pipeline-service/
├── app/
│   ├── database.py      # Configuration connexion
│   ├── models.py        # Modèles SQLAlchemy
│   └── schemas.py       # Validation Pydantic
├── alembic/
│   ├── alembic.ini     # Config Alembic
│   ├── env.py          # Environnement
│   └── versions/
│       └── 001_initial_migration.py
└── README-DATABASE.md   # Ce fichier
```

### Configuration Alembic (`alembic.ini`)
```ini
[alembic]
script_location = alembic
version_table = alembic_version_ml_pipeline
sqlalchemy.url = ${DATABASE_URL}
```

## 🚀 Utilisation

### Développement Local

1. **Port forwarding** :
```bash
kubectl port-forward service/postgresql-service -n ibis-x 5432:5432
```

2. **Variables d'environnement** :
```bash
export DATABASE_URL="postgresql://ibis_x_user:password@localhost:5432/ibis_x_db"
```

3. **Migrations** :
```bash
cd ml-pipeline-service
alembic upgrade head
```

### Production (Kubernetes)

Les migrations sont automatiquement appliquées via le job `ml-pipeline-migration-job`.

## 📝 Schémas Pydantic

### Création d'Expérience
```python
class ExperimentCreate(BaseModel):
    user_id: UUID
    project_id: UUID
    dataset_id: UUID
    algorithm: str
    hyperparameters: Dict[str, Any]
    preprocessing_config: Dict[str, Any]
```

### Lecture d'Expérience
```python
class ExperimentRead(BaseModel):
    id: UUID
    user_id: UUID
    project_id: UUID
    dataset_id: UUID
    algorithm: str
    hyperparameters: Dict[str, Any]
    preprocessing_config: Dict[str, Any]
    status: str
    progress: Optional[int]
    task_id: Optional[str]
    error_message: Optional[str]
    metrics: Optional[Dict[str, Any]]
    model_uri: Optional[str]
    visualizations: Optional[Dict[str, Any]]
    feature_importance: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
```

## 🔄 Statuts d'Expérience

| Statut | Description |
|--------|-------------|
| `pending` | En attente d'exécution |
| `running` | Entraînement en cours |
| `completed` | Terminé avec succès |
| `failed` | Erreur durant l'entraînement |
| `cancelled` | Annulé par l'utilisateur |

## 📊 Exemples de Données JSONB

### Hyperparamètres
```json
{
  "max_depth": 5,
  "min_samples_split": 2,
  "criterion": "gini"
}
```

### Configuration Préprocessing
```json
{
  "target_column": "target",
  "task_type": "classification",
  "missing_values": {"strategy": "mean"},
  "scaling": true,
  "encoding": "onehot",
  "test_size": 0.2
}
```

### Métriques
```json
{
  "accuracy": 0.92,
  "precision": 0.89,
  "recall": 0.94,
  "f1_score": 0.91,
  "confusion_matrix": [[100, 5], [3, 92]]
}
```

### Visualisations
```json
{
  "confusion_matrix": "ibis-x-models/project-id/experiment-id/confusion_matrix.png",
  "feature_importance": "ibis-x-models/project-id/experiment-id/feature_importance.png"
}
```

## ✅ Tests de Validation

### Import des Modèles
```bash
python -c "from app.models import Experiment; print('✅ Modèles OK')"
```

### Import des Schémas
```bash
python -c "from app.schemas import ExperimentCreate; print('✅ Schémas OK')"
```

### Structure de Table
```bash
python -c "from app.models import Experiment; print(list(Experiment.__table__.columns.keys()))"
```

## 🔗 Documentation Complète

Pour plus de détails, consultez :
- [Documentation Antora ML Pipeline Database](../docs/modules/ROOT/pages/dev-guide/ml-pipeline-database-setup.adoc)
- [Documentation Service ML Pipeline](../docs/modules/ROOT/pages/dev-guide/ml-pipeline-service.adoc)
- [Guide Migrations Database](../docs/modules/ROOT/pages/development/database-migrations.adoc)

## 🏁 Statut

✅ **CONFIGURATION TERMINÉE** - La base de données ML Pipeline est entièrement configurée et opérationnelle. 