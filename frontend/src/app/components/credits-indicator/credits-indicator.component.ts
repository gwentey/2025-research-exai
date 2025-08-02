import { Component, Input, OnInit, OnChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Composant réutilisable pour afficher les crédits avec un indicateur circulaire
 * style Leonardo AI avec animation fluide et design responsive
 */
@Component({
  selector: 'app-credits-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './credits-indicator.component.html',
  styleUrls: ['./credits-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditsIndicatorComponent implements OnInit, OnChanges {
  @Input() remaining: number = 0;
  @Input() total: number = 10;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showInfo: boolean = true;
  @Input() showLabel: boolean = true;

  public percentage: number = 0;
  public circumference: number = 0;
  public strokeDashoffset: number = 0;
  public radius: number = 45; // Rayon par défaut pour medium
  public isInitialized: boolean = false; // Pour éviter les rechargements multiples
  private hasAnimated: boolean = false; // Pour ne jamais animer plus d'une fois

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.calculateProgress();
    this.isInitialized = true;
    // Pas d'animation du tout au chargement - affichage direct
  }

  ngOnChanges(): void {
    if (this.isInitialized) {
      this.calculateProgress();
    }
  }

  private calculateProgress(): void {
    // Calculer le pourcentage
    this.percentage = this.total > 0 ? Math.min((this.remaining / this.total) * 100, 100) : 0;
    
    // Ajuster le rayon selon la taille (cercles vides plus gros)
    switch (this.size) {
      case 'small':
        this.radius = 14; // Container 40px = (14+6)*2
        break;
      case 'large':
        this.radius = 22; // Container 56px = (22+6)*2
        break;
      default: // medium
        this.radius = 18; // Container 48px = (18+6)*2
        break;
    }
    
    // Calculer la circonférence du cercle
    this.circumference = 2 * Math.PI * this.radius;
    
    // Calculer l'offset pour l'animation
    this.strokeDashoffset = this.circumference - (this.percentage / 100) * this.circumference;
  }

  /**
   * Retourne la classe CSS pour la couleur selon le niveau de crédits
   */
  public getColorClass(): string {
    if (this.percentage >= 70) return 'high';
    if (this.percentage >= 30) return 'medium';
    return 'low';
  }

  /**
   * Retourne le message d'info tooltip
   */
  public getTooltipMessage(): string {
    return `Vous avez ${this.remaining} crédits sur ${this.total}. Les crédits sont utilisés pour l'entraînement des modèles ML.`;
  }
}