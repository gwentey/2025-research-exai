# UserNameDisplayComponent

Composant Angular réutilisable pour la troncature intelligente de texte (noms d'utilisateur, emails, etc.).

## Utilisation

### Import
```typescript
import { UserNameDisplayComponent } from 'src/app/components/user-name-display';
```

### Template - Nom d'utilisateur (menu latéral)
```html
<app-user-name-display 
  [displayName]="userDisplayName"
  [maxWidth]="126"
  baseClass="f-w-600">
</app-user-name-display>
```

### Template - Email (profil header) avec affichage conditionnel
```html
<span class="d-flex align-items-center" *ngIf="shouldShowEmail()">
  <i-tabler name="mail" class="icon-15 m-r-4"></i-tabler>
  <app-user-name-display 
    [displayName]="userEmail"
    [maxWidth]="165"
    baseClass="f-s-14 f-w-400"
    referenceText="anthonyoutub@gmail.com">
  </app-user-name-display>
</span>
```

## Propriétés

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `displayName` | `string` | `''` | Texte à afficher |
| `maxWidth` | `number` | `126` | Largeur max en pixels |
| `baseClass` | `string` | `'f-w-600'` | Classes CSS de base |
| `referenceText` | `string` | `''` | Texte de référence - si displayName est plus large, cacher complètement |

## Fonctionnalités

- ✅ Réduction automatique de la taille de police (16px → 14px → 12px)
- ✅ Troncature avec ellipsis en dernier recours
- ✅ Affichage conditionnel basé sur un texte de référence
- ✅ Tooltip au survol pour afficher le texte complet
- ✅ Mesure précise avec Canvas API
- ✅ Responsive et accessible

## Comportement de l'affichage conditionnel

Quand `referenceText` est fourni :
- **Si displayName ≤ largeur de referenceText** → Affichage normal avec troncature intelligente
- **Si displayName > largeur de referenceText** → Composant complètement caché (`*ngIf="false"`)

Exemple avec emails :
- `"test@gmail.com"` ≤ `"anthonyoutub@gmail.com"` → ✅ Affiché
- `"utilisateur.avec.nom.tres.long@domaine.fr"` > `"anthonyoutub@gmail.com"` → ❌ Complètement caché

## Algorithme

1. Test avec f-s-16 (16px)
2. Si trop large → Test avec f-s-14 (14px)  
3. Si trop large → Test avec f-s-12 (12px)
4. Si trop large → Troncature avec ellipsis + tooltip