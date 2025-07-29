# 🏭 Scripts Production IBIS-X

Scripts dédiés au déploiement et à la gestion de la production Azure.

## 🎯 Scripts Disponibles

### ⭐ `deploy-to-azure.sh` - **SCRIPT PRINCIPAL**
**Le script à utiliser pour 99% des déploiements production**

```bash
# Déploiement automatique complet
./scripts/deploy-to-azure.sh

# Avec données d'exemple
WITH_DATA=true ./scripts/deploy-to-azure.sh
```

**Ce qu'il fait automatiquement :**
- ✅ Vérifie et crée l'infrastructure Azure si nécessaire
- ✅ Configure le frontend Angular en mode production
- ✅ Build et push les images Docker vers ACR
- ✅ Gère automatiquement l'IP statique NGINX
- ✅ Déploie l'application complète sur Kubernetes
- ✅ Corrige automatiquement les problèmes courants
- ✅ Valide le bon fonctionnement final

---

### 🔧 `fix-nginx-static-ip.sh` - **CORRECTION RAPIDE**
**Pour corriger uniquement les problèmes d'IP statique NGINX**

```bash
# Correction rapide (2-3 minutes)
./scripts/production/fix-nginx-static-ip.sh
```

**Utiliser quand :**
- ❌ Site inaccessible avec erreur de connexion
- ❌ NGINX utilise une IP dynamique au lieu de statique
- ⚡ Plus rapide qu'un redéploiement complet

**Ce qu'il fait :**
1. Détecte l'IP statique configurée dans Azure
2. Vérifie l'IP actuelle de NGINX
3. Corrige automatiquement si nécessaire
4. Valide le bon fonctionnement

---

### 🗑️ `destroy-azure-infrastructure.sh` - **NETTOYAGE COMPLET**
**⚠️ DANGER : Supprime TOUTE l'infrastructure Azure !**

```bash
# ATTENTION : Destruction complète !
./scripts/production/destroy-azure-infrastructure.sh
```

**⚠️ Utiliser seulement si :**
- 🔄 Vous voulez recommencer complètement
- 🧹 Nettoyage avant refactoring majeur
- 💰 Économie de coûts Azure (développement)

**Ce qu'il supprime :**
- 🗑️ Cluster AKS et tous les pods
- 🗑️ Azure Container Registry et images
- 🗑️ Compte de stockage et données
- 🗑️ Réseau virtuel et configurations
- 🗑️ Toutes les ressources du groupe

## 🚨 Règles de Sécurité

### ✅ **À FAIRE**
- Utilisez `deploy-to-azure.sh` pour les déploiements normaux
- Testez d'abord avec `fix-nginx-static-ip.sh` si problème réseau
- Lisez la documentation avant utilisation
- Vérifiez l'état après chaque opération

### ❌ **À NE PAS FAIRE**
- **NE PAS** utiliser ces scripts pour le développement local
- **NE PAS** exécuter `destroy-azure-infrastructure.sh` sans confirmation
- **NE PAS** interrompre `deploy-to-azure.sh` en cours d'exécution
- **NE PAS** modifier les scripts sans comprendre les conséquences

## 🔍 Dépannage

### Problème : Site inaccessible
```bash
# 1. Vérifier l'IP statique
./scripts/production/fix-nginx-static-ip.sh

# 2. Si toujours problématique, redéploiement complet
./scripts/deploy-to-azure.sh
```

### Problème : Erreur de build Docker
```bash
# Redéploiement complet (corrige automatiquement)
./scripts/deploy-to-azure.sh
```

### Problème : Frontend en mode développement
```bash
# Le script principal corrige automatiquement
./scripts/deploy-to-azure.sh
```

## 📞 Support

- **Documentation complète :** `../README-deployment.md`
- **Guide développeur :** `docs/modules/ROOT/pages/dev-guide/`
- **Architecture :** `memory-bank/architecture.md`

---

**💡 Conseil :** Pour la plupart des cas, utilisez simplement `./scripts/deploy-to-azure.sh` 