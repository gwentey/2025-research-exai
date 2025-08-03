# 🎨 Guide des Templates Éthiques - Interface Web

Ce système permet de gérer les templates éthiques **entièrement via l'interface web**, sans aucun script manuel.

## 🔄 **Fonctionnement Automatique**

### **1. Initialisation Automatique**
- Les templates sont créés automatiquement au premier lancement
- Aucune intervention manuelle requise
- Valeurs par défaut sécurisées appliquées

### **2. Import Kaggle Enrichi**
```bash
make dev  # Les templates sont appliqués automatiquement
```

**Ce qui se passe :**
- ✅ Templates chargés automatiquement
- ✅ 31 champs remplis selon le domaine
- ✅ Métadonnées éthiques intelligentes

### **3. Gestion via Interface Web**
**Accès :** `/admin/ethical-templates`

**Fonctionnalités :**
- 📝 **Modification** des templates par domaine
- ➕ **Ajout** de nouveaux domaines
- ✅ **Validation** automatique
- 🔄 **Restauration** par défaut
- 💾 **Sauvegarde** automatique

## 🎯 **Workflow Utilisateur**

### **Administrateur (Occasionnel)**
1. **Accès :** `/admin/ethical-templates`
2. **Modification :** Ajuster les valeurs selon l'organisation
3. **Sauvegarde :** Clic sur "Sauvegarder" → Automatique

### **Utilisateur Final (Quotidien)**
1. **Import :** `make dev` → Templates appliqués automatiquement
2. **Complétion :** `/datasets/{id}/complete-metadata` → Ajustements finaux
3. **Validation :** Critères éthiques vérifiés → Dataset prêt

## 📊 **Templates par Domaine**

| Domaine | Consentement | Anonymisation | Utilisation |
|---------|-------------|---------------|-------------|
| **default** | ❌ | ❌ | Fallback sécurisé |
| **education** | ✅ | ✅ | Recherche académique |
| **healthcare** | ✅ | ✅ | Données médicales |
| **business** | ❌ | ❌ | Données commerciales |

## 🔧 **Personnalisation**

### **Modifier un Template**
1. Aller sur `/admin/ethical-templates`
2. Déplier le domaine souhaité
3. Ajuster les critères éthiques et techniques
4. Cliquer "Sauvegarder"

### **Ajouter un Domaine**
1. Cliquer "Ajouter un nouveau domaine"
2. Choisir le nom du domaine
3. Configurer les critères
4. Sauvegarder

### **Restaurer par Défaut**
1. Cliquer "Par défaut"
2. Confirmer → Tous les templates sont restaurés

## ✅ **Avantages**

- **🚫 Aucun script** à exécuter manuellement
- **🖥️ Interface graphique** intuitive
- **🔄 Auto-initialisation** complète
- **💾 Sauvegarde automatique** dans le fichier YAML
- **✅ Validation** en temps réel
- **🎯 Application automatique** lors des imports

## 🔗 **Intégration Complète**

Le système s'intègre parfaitement avec :
- **Import Kaggle** → Application automatique des templates
- **Interface métadonnées** → Completion manuelle possible
- **API REST** → Gestion programmatique
- **Système de navigation** → Accès via menu admin

## 🚀 **Mise en Route**

1. **Démarrer l'application** → Templates créés automatiquement
2. **Personnaliser si nécessaire** → `/admin/ethical-templates`
3. **Importer des datasets** → `make dev` → Templates appliqués
4. **Finaliser** → Interface de completion des métadonnées

**Aucune action manuelle requise pour l'utilisation quotidienne !** 🎉