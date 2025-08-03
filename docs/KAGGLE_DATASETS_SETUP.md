# 🚀 Configuration des Vrais Datasets Kaggle pour IBIS-X

## ⚠️ IMPORTANT : Utilisation OBLIGATOIRE des Vrais Datasets

IBIS-X utilise **UNIQUEMENT** des vrais datasets provenant de Kaggle. Les fausses données ne sont plus autorisées, même en développement.

## 📋 Prérequis

### 1. Compte Kaggle (OBLIGATOIRE)

1. Créez un compte sur [Kaggle](https://www.kaggle.com) si vous n'en avez pas
2. Allez sur https://www.kaggle.com/account
3. Cliquez sur **"Create New API Token"**
4. Un fichier `kaggle.json` sera téléchargé

### 2. Configuration des Credentials

Ajoutez vos credentials Kaggle dans le fichier `.env` :

```bash
# Credentials Kaggle (OBLIGATOIRE pour le développement)
KAGGLE_USERNAME=votre_username_kaggle
KAGGLE_KEY=votre_api_key_kaggle
```

Vous trouverez ces valeurs dans le fichier `kaggle.json` téléchargé :
```json
{
  "username": "votre_username_kaggle",
  "key": "votre_api_key_kaggle"
}
```

## 🎯 Nouveau Workflow de Développement

### Démarrage Standard

```bash
make dev
```

Ce qui se passe maintenant :
1. ✅ Vérifie que les credentials Kaggle sont configurés
2. ✅ Démarre tous les services
3. ✅ Lance le job `kaggle-dataset-import-job`
4. ✅ Télécharge les VRAIS datasets depuis Kaggle
5. ✅ Stocke les datasets avec des UUIDs dans MinIO
6. ✅ Import automatique des métadonnées en base

**⏱️ Temps estimé : 5-15 minutes** selon votre connexion internet

### Validation des Datasets

Pour vérifier que les vrais datasets sont importés :

```bash
make validate-datasets
```

Ce script vérifie :
- ✅ Les datasets sont stockés avec des UUIDs
- ✅ Les fichiers sont au format Parquet
- ✅ Aucune fausse donnée n'existe
- ✅ Les tailles correspondent aux vrais datasets

## 📊 Datasets Importés

Les vrais datasets Kaggle importés sont :

1. **Students Performance in Exams** (`spscientist/students-performance-in-exams`)
2. **Student Stress Factors** (`samyakb/student-stress-factors`)
3. **Student Depression Dataset** (`adilshamim8/student-depression-dataset`)
4. **Social Media Addiction** (`adilshamim8/social-media-addiction-vs-relationships`)
5. **Riiid Answer Correctness** (`c/riiid-test-answer-prediction`)
6. **OULAD Dataset** (`vjcalling/ouladdata`)
7. **Student Academic Performance** (`nikhil7280/student-performance-multiple-linear-regression`)

## 🔧 Dépannage

### Erreur : "KAGGLE_USERNAME manquant dans .env"

```bash
❌ ERREUR: KAGGLE_USERNAME manquant dans .env
```

**Solution** : Ajoutez vos credentials Kaggle dans `.env` (voir section Configuration)

### Erreur : Import Kaggle échoué

```bash
❌ ECHEC: Import Kaggle echoue !
```

**Solutions possibles** :
1. Vérifiez votre connexion internet
2. Vérifiez que vos credentials Kaggle sont valides
3. Consultez les logs : `kubectl logs -n ibis-x job/kaggle-dataset-import-job`

### Erreur : Validation échouée (fausses données détectées)

```bash
❌ VALIDATION ÉCHOUÉE
Des fausses données ont été détectées !
```

**Solution** :
1. Nettoyez complètement : `make clean`
2. Redémarrez avec les vrais datasets : `make dev`

## 📝 Notes Importantes

1. **Le script `init_datasets.py` est OBSOLÈTE** et ne doit plus être utilisé
2. **Les datasets sont stockés avec des UUIDs** dans MinIO (ex: `1bde81b1-2ac8-4681-aa96-4de9b04e42e8/`)
3. **Le premier démarrage est plus long** mais garantit l'utilisation de vraies données
4. **Les datasets sont mis en cache** pendant 7 jours pour éviter les re-téléchargements

## 🚨 Changements par rapport à l'ancien système

| Ancien Système | Nouveau Système |
|----------------|-----------------|
| Fausses données générées | ✅ Vrais datasets Kaggle |
| Dossiers nommés (`academic_performance/`) | ✅ UUIDs (`1bde81b1-2ac8-4681-aa96-4de9b04e42e8/`) |
| Démarrage rapide | ✅ Démarrage plus long mais données réelles |
| Script `init_datasets.py` | ✅ Job `kaggle-dataset-import-job` |

## 💡 Pour les Développeurs

Si vous devez débugger le processus d'import :

```bash
# Voir les logs du job Kaggle
kubectl logs -n ibis-x job/kaggle-dataset-import-job

# Relancer manuellement l'import
kubectl delete job kaggle-dataset-import-job -n ibis-x
kubectl apply -f k8s/base/jobs/kaggle-dataset-import-job.yaml -n ibis-x

# Vérifier le contenu de MinIO
kubectl port-forward -n ibis-x service/minio-service 6701:6701
# Puis allez sur http://localhost:6701 (minioadmin/minioadmin)
```

---

**🎯 Objectif : 100% de vrais datasets, 0% de fausses données !**