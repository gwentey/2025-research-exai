# Module de Filtres Modernes - Guide de Styles et Documentation

## Vue d'ensemble

Le module de filtres modernes pour la page Datasets d'IBIS-X offre une expérience utilisateur repensée, moderne et accessible, tout en conservant la fonctionnalité existante.

## Architecture des Composants

### 1. FiltersPanelComponent (Principal)
- **Rôle** : Composant conteneur principal
- **Responsabilités** : Gestion du formulaire, état global, communication avec le parent
- **API** :
  ```typescript
  @Input() initialFilters: DatasetFilterCriteria
  @Input() autoApply: boolean = true
  @Input() showApplyButton: boolean = true
  @Input() collapsible: boolean = true
  @Input() layout: 'vertical' | 'horizontal' = 'vertical'
  
  @Output() filtersChange: EventEmitter<DatasetFilterCriteria>
  @Output() filtersApply: EventEmitter<DatasetFilterCriteria>
  @Output() filtersReset: EventEmitter<void>
  ```

### 2. FilterChipBarComponent
- **Rôle** : Affichage des filtres actifs sous forme de chips
- **Responsabilités** : Visualisation claire, suppression rapide des filtres
- **Fonctionnalités** : Chips fermables, limitation d'affichage, tooltip pour les cachées

### 3. FilterGroupComponent
- **Rôle** : Groupe de filtres repliable (accordéon)
- **Responsabilités** : Organisation thématique, expansion/réduction, validation
- **Types de groupes** :
  - Recherche textuelle (nom, objectif)
  - Domaines et tâches ML
  - Caractéristiques numériques (plages)
  - Critères de qualité (score éthique, options booléennes)

## Design System

### Palette de Couleurs
Basée sur l'identité Sorbonne existante :

```scss
// Couleurs principales
--filters-primary: #242e54;      // Bleu Sorbonne (identité uniquement)
--filters-accent: #4ecdc4;       // Teal moderne (interactions)
--filters-text-primary: #1a1a17; // Contraste AA (16.74:1)
--filters-text-secondary: #57574f; // Contraste AA (7.45:1)
```

### Typographie
```scss
// Hiérarchie claire
--filters-font-size-xs: 0.75rem;    // 12px - Hints, badges
--filters-font-size-sm: 0.875rem;   // 14px - Labels, descriptions
--filters-font-size-base: 1rem;     // 16px - Contenu principal
--filters-font-size-lg: 1.125rem;   // 18px - Titres de sections
--filters-font-size-xl: 1.25rem;    // 20px - Titre principal

// Poids
--filters-font-weight-normal: 400;
--filters-font-weight-medium: 500;
--filters-font-weight-semibold: 600;
```

### Espacements (Échelle 8px)
```scss
--filters-space-xs: 4px;   // Espacement minimal
--filters-space-sm: 8px;   // Espacement petit
--filters-space-md: 16px;  // Espacement standard
--filters-space-lg: 24px;  // Espacement large
--filters-space-xl: 32px;  // Espacement extra-large
```

### Radius et Ombres
```scss
// Radius cohérent
--filters-radius-sm: 6px;   // Petits éléments
--filters-radius-md: 8px;   // Éléments standard
--filters-radius-lg: 12px;  // Cartes, groupes
--filters-radius-full: 9999px; // Chips, badges

// Ombres subtiles
--filters-shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
--filters-shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.12);
--filters-shadow-focus: 0 0 0 3px rgba(36, 46, 84, 0.1);
```

## Responsive Design

### Breakpoints
```scss
$filters-breakpoint-mobile: 375px;
$filters-breakpoint-tablet: 768px;
$filters-breakpoint-laptop: 1024px;
$filters-breakpoint-desktop: 1280px;
$filters-breakpoint-wide: 1440px;
```

### Adaptations par Écran
- **Mobile (< 768px)** : 1 colonne, labels au-dessus, touch-friendly
- **Tablette (768-1024px)** : 1-2 colonnes, espacement optimisé
- **Laptop (1024-1280px)** : 2 colonnes, layout compact
- **Desktop (1280-1440px)** : 2-3 colonnes, layout étendu
- **Wide (> 1440px)** : 3-4 colonnes, espacement généreux

## Accessibilité

### Contrastes (WCAG AA)
- Texte principal : 16.74:1 (AAA)
- Texte secondaire : 7.45:1 (AA)
- Placeholders : 6.26:1 (AA)
- Bordures de focus : 3:1 minimum

### Navigation Clavier
- **Tab** : Navigation séquentielle
- **Enter/Space** : Activation des boutons/accordéons
- **Escape** : Fermeture de la modal
- **Flèches** : Navigation dans les listes déroulantes

### ARIA et Sémantique
```html
<!-- Exemples d'implémentation -->
<button [attr.aria-expanded]="expanded"
        [attr.aria-controls]="'group-content-' + groupId">
<div [attr.aria-hidden]="!expanded" role="region">
<input [attr.aria-describedby]="'field-hint'">
<div role="alert" *ngIf="hasError">
```

## Micro-interactions

### Animations (250ms max)
```scss
// Transitions fluides
--filters-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--filters-transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);

// Respecte prefers-reduced-motion
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

### États Interactifs
- **Hover** : Élévation subtile (+1px), changement de couleur
- **Focus** : Ring de focus visible (2px)
- **Active** : Légère compression (-1px)
- **Loading** : Spinner discret, opacité réduite

## Performance

### Optimisations Implémentées
- **Debounce** : 300ms sur les inputs de recherche
- **TrackBy** : Functions pour les listes dynamiques
- **OnPush** : Strategy pour les composants enfants (futur)
- **Virtual Scroll** : Préparé pour les longues listes d'options

### Métriques Cibles
- **First Paint** : < 200ms
- **Interaction** : < 100ms
- **Animation** : 60fps constant

## Utilisation

### Intégration Basique
```html
<app-filters-panel
  [initialFilters]="currentFilters"
  [autoApply]="true"
  [showActiveFiltersBar]="true"
  (filtersChange)="onFiltersChange($event)"
  (filtersApply)="onFiltersApply($event)">
</app-filters-panel>
```

### Configuration Modal
```html
<app-filters-panel
  [initialFilters]="tempFilters"
  [autoApply]="false"
  [showApplyButton]="false"
  [collapsible]="false"
  [layout]="'vertical'"
  (filtersChange)="onFiltersPreview($event)">
</app-filters-panel>
```

## Maintenance

### Tests à Effectuer
1. **Fonctionnels** : Tous les filtres produisent les mêmes requêtes API
2. **Visuels** : Rendu correct sur tous les breakpoints
3. **Accessibilité** : Navigation clavier, lecteurs d'écran
4. **Performance** : Temps de réponse, fluidité des animations

### Points d'Attention
- Conserver le libellé "X dataset trouvé" (contrainte métier)
- Maintenir la compatibilité avec l'API existante
- Respecter la palette Sorbonne (pas de couleurs hors thème)
- Tester les contrastes sur tous les éléments

## Migration

### Étapes de Migration
1. **Phase 1** : Nouveau composant en parallèle (✅)
2. **Phase 2** : Intégration dans DatasetListingComponent (✅)
3. **Phase 3** : Tests et validation (En cours)
4. **Phase 4** : Suppression de l'ancien composant (À venir)

### Compatibilité
- **API** : 100% compatible avec l'existant
- **Fonctionnalités** : Toutes conservées
- **Données** : Aucune modification requise

## Support

### Navigateurs Supportés
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Résolution d'Écran
- Minimum : 320px de largeur
- Optimal : 1280px et plus
- Maximum testé : 2560px

---

*Documentation générée pour IBIS-X v2.0 - Module Filtres Modernes*
