# Guide de Test - Animation de Fond de Connexion

## Tests Rapides

### 1. Test Fonctionnel de Base

```bash
# Démarrer l'application
ng serve

# Naviguer vers les pages de test
# Page de connexion (Neural Network): http://localhost:4200/authentication/login
# Page d'inscription (Particle Wave): http://localhost:4200/authentication/register
```

### 2. Vérifications Visuelles

#### ✅ Page de Login (Réseau Neuronal)
- [ ] Animation avec particules connectées par des lignes
- [ ] Mouvement brownien fluide
- [ ] Couleurs palette Sorbonne (#242e54, #3b4b8c, #d4a574)
- [ ] Transition douce vers l'animation (opacity)

#### ✅ Page d'Inscription (Vague de Particules)
- [ ] Particules en mouvement ondulatoire
- [ ] Effet de flux horizontal
- [ ] Variation d'opacité créant la profondeur
- [ ] Animation fluide sans saccades

### 3. Tests Responsive

#### Desktop (>768px)
- [ ] Animation complète visible
- [ ] Canvas correctement dimensionné (max 500px)
- [ ] Performance fluide (60fps)

#### Mobile (≤768px)
- [ ] Fallback gradient statique affiché
- [ ] Animation Canvas masquée (opacity: 0)
- [ ] Interface responsive preserved

### 4. Tests Performance

#### Outils de Debug
```javascript
// Dans la console développeur
console.log('Animation FPS:', performance.now());

// Observer la mémoire (Chrome DevTools > Performance)
// Vérifier: usage mémoire stable < 5Mo
```

#### Métriques à vérifier
- [ ] Temps de chargement initial < 2s
- [ ] FPS stable autour de 60
- [ ] Usage CPU < 10%
- [ ] Mémoire stable (pas de fuite)

### 5. Tests d'Accessibilité

#### Préférences utilisateur
```css
/* Tester avec ces réglages navigateur */
/* prefers-reduced-motion: reduce */
/* prefers-color-scheme: dark */
```

- [ ] Animation désactivée si mouvement réduit préféré
- [ ] Adaptation couleurs en mode sombre
- [ ] Contraste suffisant pour les textes

### 6. Tests de Compatibilité

#### Navigateurs supportés
- [ ] Chrome 60+ ✅
- [ ] Firefox 55+ ✅
- [ ] Safari 12+ ✅
- [ ] Edge 79+ ✅

#### Fallback automatique
- [ ] Canvas non supporté → gradient statique
- [ ] WebGL manquant → fonctionne (Canvas 2D)
- [ ] JavaScript désactivé → image de base

## Composant de Démonstration

Pour des tests approfondis, utiliser le composant de démonstration :

```typescript
// Ajouter temporairement dans app.routes.ts
{
  path: 'animation-demo',
  loadComponent: () => 
    import('./components/login-background-animation/animation-demo.component')
      .then(m => m.AnimationDemoComponent)
}
```

Puis naviguer vers `/animation-demo` pour tester interactivement.

## Debugging

### Activation du mode debug

```typescript
// Dans login-background-animation.component.ts
private debug = true; // Ligne ~25
```

### Console logs utiles
```javascript
// Surveillance performance
console.log('Particles count:', this.particles.length);
console.log('Animation running:', this.isAnimating);
console.log('Canvas dimensions:', this.canvas.width, this.canvas.height);
```

### Inspection visuelle
```css
/* Ajouter temporairement pour debug */
.animation-canvas {
  border: 2px solid red !important; /* Voir les limites */
}
```

## Résolution de Problèmes

### Animation ne s'affiche pas
1. Vérifier console erreurs JavaScript
2. Confirmer que Canvas 2D est supporté
3. Vérifier les dimensions du conteneur parent

### Performance dégradée
1. Réduire `particleCount` dans la config
2. Augmenter `connectionDistance` pour moins de connexions
3. Basculer vers fallback sur appareils faibles

### Affichage incorrect mobile
1. Vérifier media queries CSS
2. Confirmer détection mobile JavaScript
3. Tester sur vrais appareils (pas seulement émulation)

## Validation Finale

### Checklist complète
- [ ] Animations fluides sur desktop
- [ ] Fallback correct mobile
- [ ] Performance acceptable
- [ ] Accessibilité respectée
- [ ] Compatibilité navigateurs
- [ ] Pas d'erreurs console
- [ ] Design cohérent avec charte Sorbonne

### Signaler un problème
En cas de bug, inclure :
- Navigateur et version
- Taille écran / résolution
- Messages d'erreur console
- Étapes pour reproduire
- Capture d'écran si pertinente