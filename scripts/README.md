# 🚀 Scripts IBIS-X - Organisation et Utilisation

Ce dossier contient tous les scripts utiles pour le projet IBIS-X, organisés de manière claire et logique.

## 📁 Structure des Scripts

```
scripts/
├── 🏭 PRODUCTION/              # Scripts pour la production
│   ├── deploy-to-azure.sh      # 🎯 SCRIPT PRINCIPAL - Déploiement production
│   ├── fix-nginx-static-ip.sh  # 🔧 Correction rapide IP statique NGINX
│   └── destroy-azure-infrastructure.sh  # 🗑️ Suppression infrastructure
│
├── 🛠️ DEVELOPMENT/             # Scripts pour le développement
│   ├── reset-placeholders.py   # 🔄 Remet les placeholders dans les secrets
│   └── update-local-secrets.py # 🔐 Met à jour les secrets depuis .env
│
├── 📖 DOCUMENTATION/           # Documentation et guides
│   ├── README-deployment.md    # 📚 Guide complet de déploiement
│   └── README.md              # 📋 Ce fichier (organisation)
│
└── utils/                     # (Réservé pour futurs scripts utilitaires)
```

## 🎯 Scripts Principaux (À Utiliser)

### 🏭 **PRODUCTION**

#### `deploy-to-azure.sh` ⭐ **SCRIPT PRINCIPAL**
**Utilisation :** Déploiement complet en production
```bash
# Déploiement automatique (recommandé)
./scripts/deploy-to-azure.sh

# Avec données d'exemple
WITH_DATA=true ./scripts/deploy-to-azure.sh
```

**Fonctionnalités :**
- ✅ Création automatique infrastructure Azure (si manquante)
- ✅ Build et push automatique des images Docker
- ✅ Configuration automatique frontend production
- ✅ Gestion automatique IP statique NGINX
- ✅ Déploiement Kubernetes complet
- ✅ Correction automatique des problèmes courants

---

#### `fix-nginx-static-ip.sh` 🔧 **CORRECTION RAPIDE**
**Utilisation :** Corriger uniquement l'IP statique NGINX
```bash
# Correction rapide (2 minutes)
./scripts/fix-nginx-static-ip.sh
```

**Quand l'utiliser :**
- ❌ Site inaccessible (IP dynamique détectée)
- ❌ NGINX utilise une mauvaise IP
- ⚡ Plus rapide que le redéploiement complet

---

#### `destroy-azure-infrastructure.sh` 🗑️ **NETTOYAGE COMPLET**
**Utilisation :** Supprimer toute l'infrastructure Azure
```bash
# ATTENTION : Supprime TOUT !
./scripts/destroy-azure-infrastructure.sh
```

**⚠️ ATTENTION :** Supprime définitivement toutes les ressources Azure !

### 🛠️ **DÉVELOPPEMENT**

#### `reset-placeholders.py` 🔄 **NETTOYAGE SECRETS**
**Utilisation :** Remettre les placeholders avant commit Git
```bash
# Nettoyer les secrets avant commit
python scripts/development/reset-placeholders.py
```

#### `update-local-secrets.py` 🔐 **CONFIGURATION LOCALE**
**Utilisation :** Configurer les secrets depuis fichier .env
```bash
# Après avoir créé votre .env
python scripts/development/update-local-secrets.py
```

## 🚫 Ce Qu'il NE FAUT PAS Utiliser

### ❌ **Scripts OBSOLÈTES (Supprimés)**
- `test-placeholder-replacement.sh` - Script de test obsolète
- `validate-acr-protection.sh` - Validation obsolète (bug corrigé)
- `validate-production-fix.sh` - Validation obsolète (corrections en place)

Ces scripts ont été **supprimés** car ils encombraient et ne servent plus.

## 🎯 Workflow Recommandé

### 🚀 **Déploiement Production Simple**
```bash
# Une seule commande pour tout !
./scripts/deploy-to-azure.sh
```

### 🔧 **Problème IP Statique**
```bash
# Correction rapide sans redéploiement
./scripts/production/fix-nginx-static-ip.sh
```

### 🛠️ **Développement Local**
```bash
# Utilisez le Makefile (pas les scripts Azure !)
make dev                    # Développement local
make dev-with-data         # Avec données
```

### 🧹 **Nettoyage Complet**
```bash
# Si vous voulez tout recommencer
./scripts/production/destroy-azure-infrastructure.sh
```

## 📚 Documentation Détaillée

- **Guide complet :** `scripts/README-deployment.md`
- **Documentation Antora :** `docs/modules/ROOT/pages/dev-guide/`

## 🔍 Dépannage Rapide

### ❌ **Site inaccessible**
```bash
./scripts/production/fix-nginx-static-ip.sh
```

### ❌ **Erreur de déploiement**
```bash
# Redéploiement complet
./scripts/deploy-to-azure.sh
```

### ❌ **Frontend en mode développement**
```bash
# Le script corrige automatiquement
./scripts/deploy-to-azure.sh
```

## 💡 Conseils

1. **Production :** Utilisez UNIQUEMENT `deploy-to-azure.sh`
2. **Développement local :** Utilisez UNIQUEMENT `make dev`
3. **Correction rapide :** Utilisez `scripts/production/fix-nginx-static-ip.sh`
4. **Nettoyage :** Utilisez `scripts/production/destroy-azure-infrastructure.sh`

## 🚨 Règles Importantes

- ❌ **Ne PAS** utiliser les scripts Azure pour le développement local
- ❌ **Ne PAS** committer les fichiers .env ou secrets remplis
- ✅ **Toujours** utiliser `scripts/development/reset-placeholders.py` avant commit
- ✅ **Toujours** lire la documentation avant utilisation

---

**🎯 Pour 99% des cas, utilisez simplement :** `./scripts/deploy-to-azure.sh` 