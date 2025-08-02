# ML Pipeline Wizard - Architecture Refactorisée

Ce composant guide l'utilisateur à travers les étapes de création d'une expérience ML avec une nouvelle approche modulaire et claire.

## 🎯 Nouvelle Structure des Étapes

### Étape 1: Sélection du Dataset
- **Responsabilité unique**: Confirmer le choix du dataset
- **Pas de configuration**: Juste validation et aperçu

### Étape 2: Nettoyage des Données ⭐ NOUVEAU
- **Composant dédié**: `DataCleaningComponent`
- **Fonctionnalités**:
  - Analyse automatique avec cache en DB
  - Vue d'ensemble avec score de qualité
  - Analyse détaillée par colonne
  - Bouton "Auto-Fix Magique" 
  - Personnalisation manuelle des stratégies
  - 3 vues: Overview, Colonnes, Stratégies

### Étape 3: Configuration du Modèle
- **Anciennement**: Mélangé avec le nettoyage
- **Maintenant**: Focus sur:
  - Choix de la variable cible
  - Type de tâche (classification/régression)
  - Split train/test
  - Scaling et encoding (appliqués APRÈS le nettoyage)

### Étape 4: Choix de l'Algorithme
- Inchangé

### Étape 5: Hyperparamètres
- Inchangé

### Étape 6: Entraînement
- Inchangé

## 🏗️ Architecture Technique

### Frontend
```typescript
// Nouveau composant autonome
<app-data-cleaning
  [datasetId]="datasetId"
  [analysisData]="dataQualityAnalysis"
  (cleaningConfigChanged)="onCleaningConfigChanged($event)"
  (autoApplyRequested)="onAutoApplyRequested()">
</app-data-cleaning>
```

### Backend
```python
# Analyse avec cache
POST /data-quality/analyze
{
  "dataset_id": "uuid",
  "force_refresh": false  # Utilise le cache par défaut
}

# Table de cache
data_quality_analyses (
  id, dataset_id, analysis_data, 
  quality_score, expires_at
)
```

## 📊 Bénéfices de la Refactorisation

1. **Clarté**: Une étape = une responsabilité
2. **Performance**: Cache des analyses (7 jours)
3. **UX**: Interface guidée pour non-experts
4. **Flexibilité**: Auto-fix ou personnalisation manuelle
5. **Maintenabilité**: Composants découplés

## 🚀 Utilisation

1. L'utilisateur arrive à l'étape 2
2. Lance l'analyse (utilise le cache si disponible)
3. Voit les résultats dans 3 vues différentes
4. Peut appliquer l'auto-fix ou personnaliser
5. Valide et passe à la configuration du modèle

## 🎨 Design System

### Couleurs
- **Excellent** (80-100): #4caf50 (vert)
- **Bon** (60-79): #2196f3 (bleu)
- **Moyen** (40-59): #ff9800 (orange)
- **Faible** (0-39): #f44336 (rouge)

### Complexité des stratégies
- **Simple**: Badge primary
- **Intermédiaire**: Badge accent
- **Avancé**: Badge warn

### Animations
- `fadeIn`: Apparition douce
- `slideIn`: Glissement latéral
- Transitions de 300ms

## 📝 Stratégies de Nettoyage Disponibles

### Valeurs Manquantes
| Stratégie | Complexité | Cas d'usage |
|-----------|------------|-------------|
| drop | Simple | >75% manquant |
| mean/median | Simple | Numérique standard |
| mode | Simple | Catégorielle |
| forward/backward_fill | Intermédiaire | Séries temporelles |
| interpolate | Avancé | Données séquentielles |
| knn | Avancé | Relations complexes |
| iterative | Avancé | Dépendances multiples |

### Outliers
- **keep**: Conservation
- **cap**: Plafonnement IQR
- **remove**: Suppression
- **transform**: Transformation log/sqrt

## 🔧 Configuration

```typescript
// Structure de la configuration de nettoyage
interface CleaningConfig {
  global: {
    cleaningStrategy: 'auto' | 'manual' | 'skip';
    dropThreshold: number;
    enableAdvanced: boolean;
  };
  columns: {
    [columnName: string]: {
      strategy: string;
      dataType: string;
      missingPercentage: number;
    };
  };
}
```

## 📈 Métriques

- **Score de qualité**: 0-100
- **Temps d'analyse**: ~2-5 secondes (10k lignes)
- **Cache hit rate**: >90% attendu
- **Performance gain**: 3-5x avec cache