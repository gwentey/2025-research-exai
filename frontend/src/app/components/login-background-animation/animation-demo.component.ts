import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { LoginBackgroundAnimationComponent } from './login-background-animation.component';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Composant de démonstration pour les animations de fond de connexion
 * Utile pour tester et ajuster les paramètres d'animation
 * 
 * Usage: Ajouter temporairement dans une route pour tester les animations
 */
@Component({
  selector: 'app-animation-demo',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    TranslateModule,
    LoginBackgroundAnimationComponent
  ],
  template: `
    <div class="demo-container">
      <div class="demo-header">
        <h2>🚀 Animation de Fond de Connexion - Démo</h2>
        <p>Testez et ajustez les différents types d'animation</p>
      </div>

      <div class="demo-controls">
        <mat-card class="control-card">
          <mat-card-header>
            <mat-card-title>Paramètres</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            
            <!-- Type d'animation -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Type d'animation</mat-label>
              <mat-select [(value)]="selectedType">
                <mat-option value="neural-network">
                  {{ 'ANIMATION.LOGIN_BACKGROUND.NEURAL_NETWORK' | translate }}
                </mat-option>
                <mat-option value="particle-wave">
                  {{ 'ANIMATION.LOGIN_BACKGROUND.PARTICLE_WAVE' | translate }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Dimensions -->
            <div class="dimension-controls">
              <mat-form-field appearance="outline">
                <mat-label>Largeur max (px)</mat-label>
                <input matInput type="number" [(ngModel)]="maxWidth" min="200" max="800" step="50">
              </mat-form-field>
              
              <mat-form-field appearance="outline">
                <mat-label>Hauteur (px)</mat-label>
                <input matInput type="number" [(ngModel)]="height" min="200" max="600" step="50">
              </mat-form-field>
            </div>

            <!-- Informations -->
            <div class="info-section">
              <h4>Information sur l'animation actuelle</h4>
              <p class="animation-description">
                <ng-container [ngSwitch]="selectedType">
                  <span *ngSwitchCase="'neural-network'">
                    {{ 'ANIMATION.LOGIN_BACKGROUND.DESCRIPTION_NEURAL' | translate }}
                  </span>
                  <span *ngSwitchCase="'particle-wave'">
                    {{ 'ANIMATION.LOGIN_BACKGROUND.DESCRIPTION_WAVE' | translate }}
                  </span>
                </ng-container>
              </p>
            </div>

          </mat-card-content>
        </mat-card>
      </div>

      <!-- Aperçu de l'animation -->
      <div class="demo-preview">
        <mat-card class="preview-card">
          <mat-card-header>
            <mat-card-title>Aperçu</mat-card-title>
            <mat-card-subtitle>
              {{ selectedType === 'neural-network' ? 'Réseau Neuronal' : 'Vague de Particules' }}
              - {{ maxWidth }}x{{ height }}px
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="preview-container">
              <app-login-background-animation
                [animationType]="selectedType"
                [maxWidth]="maxWidth"
                [height]="height">
              </app-login-background-animation>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Spécifications techniques -->
      <div class="demo-specs">
        <mat-card class="specs-card">
          <mat-card-header>
            <mat-card-title>Spécifications Techniques</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="specs-grid">
              <div class="spec-item">
                <strong>Performance :</strong> 
                Canvas 2D optimisé GPU
              </div>
              <div class="spec-item">
                <strong>Particules :</strong>
                {{ selectedType === 'neural-network' ? '40 connectées' : '60 en flux' }}
              </div>
              <div class="spec-item">
                <strong>Couleurs :</strong>
                Palette Sorbonne (#242e54)
              </div>
              <div class="spec-item">
                <strong>Responsive :</strong>
                Fallback mobile automatique
              </div>
              <div class="spec-item">
                <strong>Accessibilité :</strong>
                Respect prefers-reduced-motion
              </div>
              <div class="spec-item">
                <strong>Taille :</strong>
                ~15ko (JS + CSS)
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Code d'utilisation -->
      <div class="demo-code">
        <mat-card class="code-card">
          <mat-card-header>
            <mat-card-title>Code d'utilisation</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <pre class="code-block"><code>&lt;app-login-background-animation
  [animationType]="'{{ selectedType }}'"
  [maxWidth]="{{ maxWidth }}"
  [height]="{{ height }}"&gt;
&lt;/app-login-background-animation&gt;</code></pre>
          </mat-card-content>
        </mat-card>
      </div>

    </div>
  `,
  styleUrls: ['./animation-demo.component.scss']
})
export class AnimationDemoComponent {
  selectedType: 'neural-network' | 'particle-wave' = 'neural-network';
  maxWidth = 500;
  height = 400;
}