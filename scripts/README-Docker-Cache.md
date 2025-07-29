# 🐳 Solutions au Problème de Cache Docker

## 🚨 Le Problème

Kubernetes peut utiliser des **images en cache** au lieu de télécharger les nouvelles versions avec le tag `latest`, causant des déploiements avec du code obsolète.

### Symptômes observés :
- ✅ Docker build/push réussi
- ❌ Les changements de code n'apparaissent pas en production
- 🔄 Nécessité de forcer les redémarrages manuellement

---

## ✅ Solutions Implémentées

### 1. **Configuration Kubernetes Permanente**

**Fichiers modifiés :**
- `k8s/base/api-gateway/deployment.yaml`
- `k8s/base/service-selection/deployment.yaml` 
- `k8s/base/frontend/deployment.yaml`

**Changement :**
```yaml
# Avant (problématique)
imagePullPolicy: IfNotPresent

# Après (corrigé)
imagePullPolicy: Always
```

**Avantages :**
- ✅ Solution permanente
- ✅ Fonctionne avec `latest`
- ✅ Aucun changement de workflow requis

**Inconvénients :**
- ⚠️ Plus de bande passante (re-téléchargement systématique)

---

### 2. ~~**Scripts de Déploiement avec Tags Uniques**~~ *(SUPPRIMÉS)*

**Fichiers ~~créés~~ SUPPRIMÉS :**
- ~~`scripts/quick-deploy.sh`~~ *(plus nécessaire)*
- ~~`scripts/quick-deploy.ps1`~~ *(plus nécessaire)*

**Raison de la suppression :**
- ✅ Solution 1 (`imagePullPolicy: Always`) résout le problème de façon permanente
- ✅ Scripts redondants avec `deploy-to-azure.sh`
- ✅ Simplicité : un seul script de déploiement

---

## 🎯 Recommandations d'Usage

### **Solution unique et simplifiée :**
✅ **Utilisez uniquement `./scripts/deploy-to-azure.sh`**
   - ✅ Fonctionne parfaitement grâce à `imagePullPolicy: Always`
   - ✅ Gère l'infrastructure ET les applications
   - ✅ Vérifications automatiques incluses
   - ✅ IP statique gérée automatiquement
   - ✅ Plus de problèmes de cache Docker

---

## 🔧 Dépannage

### Si le problème persiste :

**Vérifier la configuration :**
```bash
kubectl get deployment api-gateway -n ibis-x -o yaml | grep imagePullPolicy
# Doit afficher: imagePullPolicy: Always
```

**Forcer un redéploiement :**
```bash
kubectl rollout restart deployment/api-gateway -n ibis-x
```

**Vérifier les tags d'images :**
```bash
kubectl describe pod -n ibis-x -l app=api-gateway | grep Image:
```

---

## 💡 Bonnes Pratiques

1. **Utilisez `imagePullPolicy: Always` en production** pour les images avec `latest`
2. **Préférez des tags uniques** pour les déploiements critiques
3. **Testez toujours** après un déploiement
4. **Gardez `latest` à jour** pour la compatibilité

---

*Cette documentation couvre les solutions mises en place le 29/07/2025 pour résoudre les problèmes de cache Docker rencontrés lors du déploiement OAuth.* 