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
  @Input() modern: boolean = true;
  
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
    const count = this.dataset.instances_number || 0;
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  /**
   * Récupère les domaines à afficher (maximum 3)
   */
  getDisplayedDomains(): string[] {
    const domains = this.dataset.domain || [];
    return domains.slice(0, 2);
  }

  /**
   * Récupère les domaines restants
   */
  getRemainingDomainsCount(): number {
    const domains = this.dataset.domain || [];
    return Math.max(0, domains.length - 2);
  }

  /**
   * Récupère les tâches à afficher (maximum 3)
   */
  getDisplayedTasks(): string[] {
    const tasks = this.dataset.task || [];
    return tasks.slice(0, 2);
  }

  /**
   * Récupère les tâches restantes
   */
  getRemainingTasksCount(): number {
    const tasks = this.dataset.task || [];
    return Math.max(0, tasks.length - 2);
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
  getTruncatedDescription(): string {
    if (!this.dataset.objective) return '';
    return this.dataset.objective.length > 150 
      ? this.dataset.objective.substring(0, 150) + '...'
      : this.dataset.objective;
  }

  /**
   * Récupère l'année ou 'N/A'
   */
  getYear(): string {
    if (!this.dataset.year) return '2024';
    return this.dataset.year.toString();
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
  getFeaturesCount(): number {
    return this.dataset.features_number || 0;
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
    return Math.round(this.dataset.global_missing_percentage || 0);
  }

  /**
   * Récupère le niveau de représentativité
   */
  getRepresentativityLevel(): string {
    return this.dataset.representativity_level || 'élevée';
  }

  /**
   * Récupère la classe CSS pour le niveau de représentativité
   */
  getRepresentativityClass(): string {
    const level = this.getRepresentativityLevel().toLowerCase();
    if (level === 'élevée' || level === 'high') return 'high';
    if (level === 'moyenne' || level === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Récupère le score éthique basé sur les critères
   */
  getEthicalScore(): number {
    // Calculer le score éthique à partir des critères booléens
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
    if (definedCriteria.length === 0) return 67; // Score par défaut
    
    const trueCriteria = definedCriteria.filter(c => c === true);
    return Math.round((trueCriteria.length / definedCriteria.length) * 100);
  }

  /**
   * Récupère la classe CSS pour le score éthique
   */
  getEthicalScoreClass(): string {
    const score = this.getEthicalScore();
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
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
    if (!this.dataset.updated_at) return 'Récemment';
    const date = new Date(this.dataset.updated_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.ceil(diffDays / 7)} semaines`;
    return `Il y a ${Math.ceil(diffDays / 30)} mois`;
  }
} 
