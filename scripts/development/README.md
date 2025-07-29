# 🛠️ Scripts Développement IBIS-X

Scripts utilitaires pour le développement local et la gestion des secrets.

## 🎯 Scripts Disponibles

### 🔄 `reset-placeholders.py` - **NETTOYAGE AVANT COMMIT**
**Remet les placeholders dans les fichiers secrets avant commit Git**

```bash
# Nettoyer tous les secrets avant commit
python scripts/development/reset-placeholders.py
```

**Utiliser quand :**
- 🔒 Avant chaque commit Git
- 🧹 Pour nettoyer les secrets accidentellement remplis
- 🔄 Après avoir testé avec de vrais secrets

**Ce qu'il fait :**
- 🔍 Trouve tous les fichiers `*secrets*.yaml`
- 🔄 Remplace les vraies valeurs par des placeholders
- ✅ Évite de committer des secrets sensibles

**Exemple :**
```yaml
# AVANT (dangereux pour Git)
secret-key: ma-vraie-cle-secrete-123
google-client-id: 123456789-abc.apps.googleusercontent.com

# APRÈS (sûr pour Git)
secret-key: REPLACE_WITH_SECRET_KEY
google-client-id: REPLACE_WITH_GOOGLE_CLIENT_ID
```

---

### 🔐 `update-local-secrets.py` - **CONFIGURATION LOCALE**
**Met à jour les secrets depuis un fichier .env pour le développement local**

```bash
# Après avoir créé votre fichier .env
python scripts/development/update-local-secrets.py
```

**Utiliser quand :**
- 🆕 Premier setup du développement local
- 🔄 Mise à jour des credentials locaux
- 🔧 Configuration des secrets Google, Kaggle, etc.

**Ce qu'il fait :**
- 📖 Lit les variables depuis `.env`
- 🔐 Encode automatiquement en base64
- 📝 Met à jour les fichiers YAML secrets
- ✅ Prépare pour `make dev`

**Fichier .env requis :**
```bash
# Exemple de fichier .env (à créer à la racine)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ibis_x_dev
JWT_SECRET_KEY=dev-secret-key-12345
GOOGLE_CLIENT_ID=votre-google-client-id
GOOGLE_CLIENT_SECRET=votre-google-client-secret
OAUTH_REDIRECT_URL=http://localhost:4200/auth/callback
KAGGLE_USERNAME=votre-username-kaggle
KAGGLE_KEY=votre-cle-kaggle
```

## 🔄 Workflow Développement

### 📋 **Setup Initial**
```bash
# 1. Créer le fichier .env avec vos credentials
cp .env.example .env
# Éditer .env avec vos vraies valeurs

# 2. Configurer les secrets
python scripts/development/update-local-secrets.py

# 3. Lancer le développement local
make dev
```

### 🔒 **Avant Chaque Commit**
```bash
# Nettoyer les secrets
python scripts/development/reset-placeholders.py

# Commit sécurisé
git add .
git commit -m "votre message"
```

### 🆕 **Après Pull/Merge**
```bash
# Reconfigurer les secrets locaux
python scripts/development/update-local-secrets.py
```

## 🚨 Règles de Sécurité

### ✅ **À FAIRE**
- **TOUJOURS** exécuter `reset-placeholders.py` avant commit
- Garder le fichier `.env` en local uniquement
- Utiliser des credentials de développement/test
- Vérifier que `.env` est dans `.gitignore`

### ❌ **À NE JAMAIS FAIRE**
- **JAMAIS** committer le fichier `.env`
- **JAMAIS** committer des secrets réels dans les YAML
- **JAMAIS** utiliser des credentials de production en local
- **JAMAIS** partager le fichier `.env` publiquement

## 🔍 Dépannage

### Problème : "Variables manquantes dans .env"
```bash
# Vérifier votre fichier .env
cat .env

# Copier depuis l'exemple
cp .env.example .env
# Puis éditer avec vos valeurs
```

### Problème : "Fichiers secrets non trouvés"
```bash
# Vérifier la structure
ls -la k8s/base/*/secrets*.yaml
ls -la k8s/overlays/*/secrets*.yaml
```

### Problème : Secrets non appliqués en local
```bash
# Re-exécuter la configuration
python scripts/development/update-local-secrets.py

# Relancer le développement
make dev-clean  # si nécessaire
make dev
```

## 📁 Fichiers Gérés

Ces scripts modifient automatiquement :
- `k8s/base/api-gateway/gateway-secrets.yaml`
- `k8s/base/service-selection/kaggle-secrets.yaml`
- `k8s/overlays/azure/oauth-redirect-patch.yaml`

## 📞 Support

- **Guide développement local :** `../README-deployment.md`
- **Documentation Make :** `README.md` (racine)
- **Architecture :** `memory-bank/architecture.md`

---

**💡 Conseil :** Automatisez avec un hook Git pour exécuter `reset-placeholders.py` avant chaque commit ! 