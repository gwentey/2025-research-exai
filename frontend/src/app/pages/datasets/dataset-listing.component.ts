import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { DatasetService } from '../../services/dataset.service';
import { Dataset, DatasetFilterCriteria, PaginationParams } from '../../models/dataset.models';
import { DatasetCardComponent } from './components/dataset-card.component';
import { DatasetFiltersComponent } from './components/dataset-filters.component';

interface FilterChip {
  key: string;
  label: string;
  icon: string;
  tooltip: string;
  value: any;
}

@Component({
  selector: 'app-dataset-listing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatTooltipModule,
    DatasetCardComponent,
    DatasetFiltersComponent
  ],
  templateUrl: './dataset-listing.component.html',
  styleUrls: ['./dataset-listing.component.scss']
})
export class DatasetListingComponent implements OnInit, OnDestroy {
  private datasetService = inject(DatasetService);
  private destroy$ = new Subject<void>();

  // État du sidebar
  sidebarCollapsed = false;

  // Données
  datasets: Dataset[] = [];
  totalDatasets = 0;
  
  // État de chargement
  isLoading = false;
  error: string | null = null;

  // Filtrage et recherche
  currentFilters: DatasetFilterCriteria = {};
  quickSearchTerm = '';

  // Modal de filtrage
  showFiltersModal = false;
  tempFilters: DatasetFilterCriteria = {};
  previewCount: number | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 24;

  // Affichage
  viewMode: 'grid' | 'list' = 'grid';
  currentSort = 'relevance';

  ngOnInit(): void {
    this.loadDatasets();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Toggle du sidebar
   */
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  /**
   * Vérifie s'il y a des filtres actifs
   */
  hasActiveFilters(): boolean {
    return Object.keys(this.currentFilters).length > 0 || !!this.quickSearchTerm;
  }

  /**
   * Compte le nombre de filtres actifs
   */
  getActiveFiltersCount(): number {
    let count = Object.keys(this.currentFilters).length;
    if (this.quickSearchTerm) count++;
    return count;
  }

  /**
   * Récupère les chips des filtres actifs
   */
  getActiveFiltersChips(): FilterChip[] {
    const chips: FilterChip[] = [];

    // Recherche rapide
    if (this.quickSearchTerm) {
      chips.push({
        key: 'search',
        label: `"${this.quickSearchTerm}"`,
        icon: 'search',
        tooltip: 'Recherche textuelle',
        value: this.quickSearchTerm
      });
    }

    // Domaines
    if (this.currentFilters.domain?.length) {
      chips.push({
        key: 'domain',
        label: `${this.currentFilters.domain.length} domaine${this.currentFilters.domain.length > 1 ? 's' : ''}`,
        icon: 'domain',
        tooltip: this.currentFilters.domain.join(', '),
        value: this.currentFilters.domain
      });
    }

    // Tâches
    if (this.currentFilters.task?.length) {
      chips.push({
        key: 'task',
        label: `${this.currentFilters.task.length} tâche${this.currentFilters.task.length > 1 ? 's' : ''}`,
        icon: 'psychology',
        tooltip: this.currentFilters.task.join(', '),
        value: this.currentFilters.task
      });
    }

    // Instances
    if (this.currentFilters.instances_number_min || this.currentFilters.instances_number_max) {
      const min = this.currentFilters.instances_number_min || 0;
      const max = this.currentFilters.instances_number_max || '∞';
      chips.push({
        key: 'instances',
        label: `${min} - ${max} instances`,
        icon: 'storage',
        tooltip: `Nombre d'instances entre ${min} et ${max}`,
        value: { min, max }
      });
    }

    // Features
    if (this.currentFilters.features_number_min || this.currentFilters.features_number_max) {
      const min = this.currentFilters.features_number_min || 0;
      const max = this.currentFilters.features_number_max || '∞';
      chips.push({
        key: 'features',
        label: `${min} - ${max} features`,
        icon: 'view_column',
        tooltip: `Nombre de features entre ${min} et ${max}`,
        value: { min, max }
      });
    }

    // Année
    if (this.currentFilters.year_min || this.currentFilters.year_max) {
      const min = this.currentFilters.year_min || 1990;
      const max = this.currentFilters.year_max || new Date().getFullYear();
      chips.push({
        key: 'year',
        label: `${min} - ${max}`,
        icon: 'calendar_today',
        tooltip: `Année entre ${min} et ${max}`,
        value: { min, max }
      });
    }

    // Score éthique
    if (this.currentFilters.ethical_score_min) {
      chips.push({
        key: 'ethical_score',
        label: `Éthique ≥ ${this.currentFilters.ethical_score_min}%`,
        icon: 'security',
        tooltip: `Score éthique minimum de ${this.currentFilters.ethical_score_min}%`,
        value: this.currentFilters.ethical_score_min
      });
    }

    // Représentativité
    if (this.currentFilters.representativity_level) {
      chips.push({
        key: 'representativity',
        label: `Rep. ${this.currentFilters.representativity_level}`,
        icon: 'analytics',
        tooltip: `Représentativité ${this.currentFilters.representativity_level}`,
        value: this.currentFilters.representativity_level
      });
    }

    // Filtres booléens
    if (this.currentFilters.is_split) {
      chips.push({
        key: 'is_split',
        label: 'Divisé',
        icon: 'call_split',
        tooltip: 'Dataset déjà divisé (train/test)',
        value: true
      });
    }

    if (this.currentFilters.is_anonymized) {
      chips.push({
        key: 'is_anonymized',
        label: 'Anonymisé',
        icon: 'verified_user',
        tooltip: 'Données anonymisées',
        value: true
      });
    }

    if (this.currentFilters.has_temporal_factors) {
      chips.push({
        key: 'has_temporal_factors',
        label: 'Temporel',
        icon: 'schedule',
        tooltip: 'Facteurs temporels présents',
        value: true
      });
    }

    if (this.currentFilters.is_public) {
      chips.push({
        key: 'is_public',
        label: 'Public',
        icon: 'public',
        tooltip: 'Accès public uniquement',
        value: true
      });
    }

    return chips;
  }

  /**
   * Supprime un filtre spécifique
   */
  removeFilter(filter: FilterChip): void {
    if (filter.key === 'search') {
      this.quickSearchTerm = '';
    } else {
      const newFilters = { ...this.currentFilters };
      delete (newFilters as any)[filter.key];
      this.currentFilters = newFilters;
    }
    this.loadDatasets();
  }

  /**
   * Efface tous les filtres
   */
  clearAllFilters(): void {
    this.currentFilters = {};
    this.quickSearchTerm = '';
    this.loadDatasets();
  }

  /**
   * Recherche rapide
   */
  onQuickSearch(event: any): void {
    const searchTerm = event.target.value;
    this.quickSearchTerm = searchTerm;
    
    // Debounce la recherche
    setTimeout(() => {
      if (this.quickSearchTerm === searchTerm) {
        this.loadDatasets();
      }
    }, 300);
  }

  /**
   * Efface la recherche rapide
   */
  clearQuickSearch(): void {
    this.quickSearchTerm = '';
    this.loadDatasets();
  }

  /**
   * Changement de vue
   */
  onViewChange(view: any): void {
    this.viewMode = view.value;
  }

  /**
   * Changement de tri
   */
  onSortChange(event: any): void {
    this.currentSort = event.value;
    this.loadDatasets();
  }

  /**
   * Changement de filtres
   */
  onFiltersChange(filters: DatasetFilterCriteria): void {
    this.currentFilters = filters;
    this.currentPage = 0; // Reset pagination
    this.loadDatasets();
  }

  /**
   * Changement de page
   */
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadDatasets();
  }

  /**
   * Actualisation des datasets
   */
  refreshDatasets(): void {
    this.loadDatasets();
  }

  /**
   * Sélection d'un dataset
   */
  onSelectDataset(dataset: Dataset): void {
    console.log('Dataset sélectionné:', dataset);
    // TODO: Navigation vers la page de configuration du pipeline
  }

  /**
   * Visualisation d'un dataset
   */
  onViewDataset(datasetId: string): void {
    console.log('Visualisation du dataset:', datasetId);
    // TODO: Ouvrir modal ou page de prévisualisation
  }

  /**
   * Toggle favoris
   */
  onToggleFavorite(dataset: Dataset): void {
    console.log('Toggle favoris pour:', dataset);
    // TODO: Gérer les favoris
  }

  /**
   * Tracking function pour ngFor
   */
  trackByDataset(index: number, dataset: Dataset): string {
    return dataset.id;
  }

  // === GESTION MODAL DE FILTRAGE ===

  /**
   * Ouvre la modal de filtrage
   */
  openFiltersModal(): void {
    this.tempFilters = { ...this.currentFilters };
    this.previewCount = null;
    this.showFiltersModal = true;
  }

  /**
   * Ferme la modal de filtrage
   */
  closeFiltersModal(): void {
    this.showFiltersModal = false;
    this.tempFilters = {};
    this.previewCount = null;
  }

  /**
   * Applique les filtres de la modal
   */
  applyFiltersModal(): void {
    this.currentFilters = { ...this.tempFilters };
    this.currentPage = 0; // Reset pagination
    this.loadDatasets();
    this.closeFiltersModal();
  }

  /**
   * Reset les filtres dans la modal
   */
  resetFiltersModal(): void {
    this.tempFilters = {};
    this.updatePreviewCount();
  }

  /**
   * Gestion des changements de filtres dans la modal (preview)
   */
  onFiltersPreview(filters: DatasetFilterCriteria): void {
    this.tempFilters = filters;
    this.updatePreviewCount();
  }

  /**
   * Vérifie s'il y a des changements dans les filtres
   */
  hasFilterChanges(): boolean {
    return JSON.stringify(this.currentFilters) !== JSON.stringify(this.tempFilters);
  }

  /**
   * Met à jour le compteur d'aperçu en temps réel
   */
  private updatePreviewCount(): void {
    // Simule un appel API pour compter les résultats
    // En production, ceci devrait être un appel au service
    const hasFilters = Object.keys(this.tempFilters).length > 0;
    const baseCount = this.totalDatasets || this.datasets.length || 24; // Nombre de base réaliste
    
    if (!hasFilters) {
      this.previewCount = baseCount;
    } else {
      // Simulation réaliste - filtre réduit le nombre
      setTimeout(() => {
        const reduction = Math.random() * 0.7 + 0.1; // Réduit de 10% à 80%
        this.previewCount = Math.max(1, Math.floor(baseCount * reduction));
      }, 200);
    }
  }

  /**
   * Charge les datasets depuis l'API
   */
  private loadDatasets(): void {
    this.isLoading = true;
    this.error = null;

    // Paramètres de pagination
    const params: PaginationParams = {
      page: this.currentPage + 1, // API utilise 1-based indexing
      page_size: this.pageSize,
      sort_by: this.currentSort,
      sort_order: 'desc'
    };

    // Préparer les filtres
    const filters: DatasetFilterCriteria = { ...this.currentFilters };
    
    // Ajouter la recherche rapide si présente
    if (this.quickSearchTerm) {
      filters.dataset_name = this.quickSearchTerm;
    }

    this.datasetService.getDatasets(params, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.datasets = response.datasets;
          this.totalDatasets = response.total_count;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des datasets:', error);
          this.error = 'Erreur lors du chargement des datasets. Veuillez réessayer.';
          this.isLoading = false;
          this.datasets = [];
          this.totalDatasets = 0;
        }
      });
  }
} 