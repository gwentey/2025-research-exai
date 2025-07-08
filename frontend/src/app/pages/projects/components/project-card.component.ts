import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { Project } from '../../../models/project.models';
import { ProjectService } from '../../../services/project.service';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './project-card.component.html'
})
export class ProjectCardComponent {
  @Input() project!: Project;
  
  @Output() onView = new EventEmitter<Project>();
  @Output() onEdit = new EventEmitter<Project>();
  @Output() onDelete = new EventEmitter<Project>();

  private projectService = inject(ProjectService);

  /**
   * Émet l'événement de visualisation du projet
   */
  viewProject(): void {
    this.onView.emit(this.project);
  }

  /**
   * Émet l'événement de modification du projet
   */
  editProject(): void {
    this.onEdit.emit(this.project);
  }

  /**
   * Émet l'événement de suppression du projet
   */
  deleteProject(): void {
    this.onDelete.emit(this.project);
  }

  /**
   * Récupère la description tronquée
   */
  getTruncatedDescription(): string {
    if (!this.project.description) return 'Aucune description disponible';
    return this.project.description.length > 120 
      ? this.project.description.substring(0, 120) + '...'
      : this.project.description;
  }

  /**
   * Compte le nombre de critères configurés
   */
  getCriteriaCount(): number {
    return this.projectService.calculateCriteriaCount(this.project.criteria || {});
  }

  /**
   * Récupère le nombre de poids configurés
   */
  getWeightsCount(): number {
    return this.project.weights ? this.project.weights.length : 0;
  }

  /**
   * Formate la date de création
   */
  getCreatedDate(): string {
    const date = new Date(this.project.created_at);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Formate la date de dernière modification
   */
  getUpdatedDate(): string {
    const date = new Date(this.project.updated_at);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Vérifie si le projet a été modifié récemment (dernières 24h)
   */
  isRecentlyUpdated(): boolean {
    const now = new Date();
    const updated = new Date(this.project.updated_at);
    const diffInHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
    return diffInHours < 24;
  }

  /**
   * Récupère un résumé des critères configurés
   */
  getCriteriaSummary(): string {
    if (!this.project.criteria) {
      return 'Aucun critère défini';
    }

    const summary = this.projectService.formatCriteriaDisplay(this.project.criteria);
    return summary.length > 80 ? summary.substring(0, 80) + '...' : summary;
  }

  /**
   * Vérifie si le projet est complet (a des critères et des poids)
   */
  isProjectComplete(): boolean {
    return this.getCriteriaCount() > 0 && this.getWeightsCount() > 0;
  }

  /**
   * Récupère la classe CSS selon l'état du projet
   */
  getProjectStatusClass(): string {
    if (this.isProjectComplete()) {
      return 'complete';
    } else if (this.getCriteriaCount() > 0) {
      return 'partial';
    }
    return 'empty';
  }

  /**
   * Récupère l'icône selon l'état du projet
   */
  getProjectStatusIcon(): string {
    if (this.isProjectComplete()) {
      return 'check_circle';
    } else if (this.getCriteriaCount() > 0) {
      return 'schedule';
    }
    return 'radio_button_unchecked';
  }

  /**
   * Récupère le texte de statut du projet
   */
  getProjectStatusText(): string {
    if (this.isProjectComplete()) {
      return 'Projet configuré';
    } else if (this.getCriteriaCount() > 0) {
      return 'Configuration partielle';
    }
    return 'Configuration requise';
  }
} 