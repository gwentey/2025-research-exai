import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';

import { Dataset } from '../../../models/dataset.models';
import { DatasetService } from '../../../services/dataset.service';

@Component({
  selector: 'app-dataset-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatProgressBarModule,
    RouterModule
  ],
  templateUrl: './dataset-card.component.html',
  styleUrls: ['./dataset-card.component.scss']
})
export class DatasetCardComponent {
  @Input() dataset!: Dataset;
  @Input() showActions: boolean = true;
  @Input() compact: boolean = false;
  
  @Output() onView = new EventEmitter<string>();
  @Output() onSelect = new EventEmitter<Dataset>();
  @Output() onFavorite = new EventEmitter<Dataset>();

  private datasetService = inject(DatasetService);

  /**
   * Émet l'événement de visualisation du dataset
   */
  viewDataset(): void {
    this.onView.emit(this.dataset.id);
  }

  /**
   * Émet l'événement de sélection du dataset
   */
  selectDataset(): void {
    this.onSelect.emit(this.dataset);
  }

  /**
   * Émet l'événement de mise en favoris
   */
  toggleFavorite(): void {
    this.onFavorite.emit(this.dataset);
  }

  /**
   * Formate le nombre d'instances
   */
  getFormattedInstancesCount(): string {
    if (!this.dataset.instances_number) return 'N/A';
    return this.datasetService.formatInstancesCount(this.dataset.instances_number);
  }

  /**
   * Récupère les domaines à afficher (maximum 3)
   */
  getDisplayedDomains(): string[] {
    if (!this.dataset.domain) return [];
    return this.dataset.domain.slice(0, 3);
  }

  /**
   * Récupère les domaines restants
   */
  getRemainingDomainsCount(): number {
    if (!this.dataset.domain) return 0;
    return Math.max(0, this.dataset.domain.length - 3);
  }

  /**
   * Récupère les tâches à afficher (maximum 3)
   */
  getDisplayedTasks(): string[] {
    if (!this.dataset.task) return [];
    return this.dataset.task.slice(0, 3);
  }

  /**
   * Récupère les tâches restantes
   */
  getRemainingTasksCount(): number {
    if (!this.dataset.task) return 0;
    return Math.max(0, this.dataset.task.length - 3);
  }

  /**
   * Récupère la couleur du domaine
   */
  getDomainColor(domain: string): string {
    return this.datasetService.getDomainColor(domain);
  }

  /**
   * Récupère l'icône de la tâche
   */
  getTaskIcon(task: string): string {
    return this.datasetService.getTaskIcon(task);
  }

  /**
   * Récupère la description tronquée
   */
  getTruncatedDescription(maxLength: number = 150): string {
    if (!this.dataset.objective) return 'Aucune description disponible';
    
    if (this.dataset.objective.length <= maxLength) {
      return this.dataset.objective;
    }
    
    return this.dataset.objective.substring(0, maxLength) + '...';
  }

  /**
   * Récupère l'année ou 'N/A'
   */
  getYear(): string {
    return this.dataset.year ? this.dataset.year.toString() : 'N/A';
  }

  /**
   * Récupère le nombre de citations ou 0
   */
  getCitations(): number {
    return this.dataset.num_citations || 0;
  }

  /**
   * Récupère le nombre de features ou 'N/A'
   */
  getFeaturesCount(): string {
    return this.dataset.features_number ? this.dataset.features_number.toString() : 'N/A';
  }

  /**
   * Vérifie si le dataset est public
   */
  isPublic(): boolean {
    return this.dataset.access === 'public';
  }

  /**
   * Vérifie si le dataset a des valeurs manquantes
   */
  hasMissingValues(): boolean {
    return this.dataset.has_missing_values || false;
  }

  /**
   * Vérifie si le dataset est déjà divisé
   */
  isSplit(): boolean {
    return this.dataset.split || false;
  }

  /**
   * Vérifie si le dataset est anonymisé
   */
  isAnonymized(): boolean {
    return this.dataset.anonymization_applied || false;
  }

  /**
   * Vérifie si le dataset a des facteurs temporels
   */
  hasTemporalFactors(): boolean {
    return this.dataset.temporal_factors || false;
  }

  /**
   * Récupère le pourcentage de valeurs manquantes
   */
  getMissingPercentage(): number {
    return this.dataset.global_missing_percentage || 0;
  }

  /**
   * Récupère le niveau de représentativité
   */
  getRepresentativityLevel(): string {
    return this.dataset.representativity_level || 'Non spécifié';
  }

  /**
   * Récupère la classe CSS pour le niveau de représentativité
   */
  getRepresentativityClass(): string {
    const level = this.dataset.representativity_level?.toLowerCase();
    switch (level) {
      case 'élevée':
        return 'high-repr';
      case 'moyenne':
        return 'medium-repr';
      case 'faible':
        return 'low-repr';
      default:
        return 'unknown-repr';
    }
  }

  /**
   * Récupère le score éthique basé sur les critères
   */
  getEthicalScore(): number {
    const criteria = [
      this.dataset.informed_consent,
      this.dataset.transparency,
      this.dataset.user_control,
      this.dataset.equity_non_discrimination,
      this.dataset.security_measures_in_place,
      this.dataset.anonymization_applied,
      this.dataset.record_keeping_policy_exists,
      this.dataset.purpose_limitation_respected,
      this.dataset.accountability_defined
    ];
    
    const definedCriteria = criteria.filter(c => c !== undefined);
    if (definedCriteria.length === 0) return 0;
    
    const trueCriteria = definedCriteria.filter(c => c === true);
    return Math.round((trueCriteria.length / definedCriteria.length) * 100);
  }

  /**
   * Récupère la classe CSS pour le score éthique
   */
  getEthicalScoreClass(): string {
    const score = this.getEthicalScore();
    if (score >= 80) return 'high-ethical';
    if (score >= 60) return 'medium-ethical';
    if (score >= 40) return 'low-ethical';
    return 'poor-ethical';
  }

  /**
   * Récupère la date de création formatée
   */
  getCreatedDate(): string {
    return new Date(this.dataset.created_at).toLocaleDateString('fr-FR');
  }

  /**
   * Récupère la date de mise à jour formatée
   */
  getUpdatedDate(): string {
    return new Date(this.dataset.updated_at).toLocaleDateString('fr-FR');
  }
} 