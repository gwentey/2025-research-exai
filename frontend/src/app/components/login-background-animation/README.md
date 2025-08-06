# LoginBackgroundAnimationComponent

Animation de fond moderne et intelligente pour les pages de connexion et d'inscription d'IBIS-X.

## Vue d'ensemble

Ce composant remplace l'image statique des pages d'authentification par une animation dynamique inspirée de l'intelligence artificielle, optimisée pour les performances et l'accessibilité.

## Types d'animation

### 1. Réseau Neuronal (`neural-network`)
- Particules interconnectées simulant un réseau de neurones
- Lignes dynamiques entre particules proches
- Parfait pour la page de connexion

### 2. Vague de Particules (`particle-wave`)
- Flux de données ondulatoire et fluide
- Mouvement en vague sinusoïdale
- Idéal pour la page d'inscription

## Utilisation

```typescript
<app-login-background-animation
  [animationType]="'neural-network'"
  [maxWidth]="500"
  [height]="400">
</app-login-background-animation>
```

## Propriétés

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `animationType` | `'neural-network' \| 'particle-wave'` | `'neural-network'` | Type d'animation |
| `maxWidth` | `number` | `500` | Largeur maximale en pixels |
| `height` | `number` | `400` | Hauteur de l'animation |

## Fonctionnalités

- ✅ **Performance optimisée** : Canvas 2D, <500ko
- ✅ **Responsive** : Adaptation mobile automatique
- ✅ **Accessibilité** : Respect des préférences utilisateur
- ✅ **Fallback robuste** : Gradient statique en cas d'erreur
- ✅ **GPU-friendly** : Optimisations pour l'accélération matérielle

## Palette de couleurs

- **Principal** : `#242e54` (Bleu Sorbonne)
- **Secondaire** : `#3b4b8c` (Bleu moderne)
- **Accent** : `#d4a574` (Or chaleureux)

## Architecture

```
login-background-animation/
├── login-background-animation.component.ts    # Logique principale et gestion Canvas
├── login-background-animation.component.scss  # Styles responsive et fallback
└── README.md                                  # Cette documentation
```

## Optimisations

- **requestAnimationFrame** pour la fluidité
- **Zone.runOutsideAngular** pour les performances Angular
- **ResizeObserver** pour l'adaptation responsive
- **will-change CSS** pour l'accélération GPU
- **Cleanup automatique** pour éviter les fuites mémoire

## Support navigateurs

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile (avec fallback optimisé)

## Développement

### Tests locaux
```bash
ng serve
# Naviguer vers /authentication/login ou /authentication/register
```

### Debug
Activer le mode debug dans le composant :
```typescript
private debug = true; // Affiche métriques de performance
```

## Documentation complète

Voir la documentation Antora complète : `docs/modules/frontend/pages/login-background-animation.adoc`