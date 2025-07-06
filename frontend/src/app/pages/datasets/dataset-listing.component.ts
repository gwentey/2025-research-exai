import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs';

import { 
  Dataset, 
  DatasetListResponse, 
  DatasetFilterCriteria, 
  PaginationParams, 
  SORT_OPTIONS,
  SortOption 
} from '../../models/dataset.models';
import { DatasetService } from '../../services/dataset.service';
import { DatasetCardComponent } from './components/dataset-card.component';
import { DatasetFiltersComponent } from './components/dataset-filters.component';

@Component({
  selector: 'app-dataset-listing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatSidenavModule,
    MatBadgeModule,
    MatMenuModule,
    MatDividerModule,
    RouterModule,
    DatasetCardComponent,
    DatasetFiltersComponent
  ],
  templateUrl: './dataset-listing.component.html',
  styleUrls: ['./dataset-listing.component.scss']
})
export class DatasetListingComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  
  private datasetService = inject(DatasetService);
  private destroy$ = new Subject<void>();

  // État de chargement et données
  isLoading = false;
  datasets: Dataset[] = [];
  totalCount = 0;
  hasError = false;
  errorMessage = '';

  // Contrôles de recherche et filtrage
  searchControl = new FormControl('');
  currentFilters: DatasetFilterCriteria = {};
  
  // Paramètres de pagination et tri
  currentPage = 0;
  pageSize = 12;
  availablePageSizes = [6, 12, 24, 48];
  
  // Tri
  sortOptions = SORT_OPTIONS;
  currentSort: SortOption = this.sortOptions[0];
  currentSortOrder: 'asc' | 'desc' = 'asc';
  
  // Interface utilisateur
  sidenavOpened = false;
  viewMode: 'grid' | 'list' = 'grid';
  showFilters = true;
  compactCards = false;

  ngOnInit(): void {
    this.setupSearchSubscription();
    this.loadDatasets();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Configure la souscription pour la recherche
   */
  private setupSearchSubscription(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.performSearch(searchTerm || '');
      });
  }

  /**
   * Charge les datasets avec les paramètres actuels
   */
  private loadDatasets(): void {
    this.isLoading = true;
    this.hasError = false;

    const params: PaginationParams = {
      page: this.currentPage + 1, // API utilise 1-based indexing
      page_size: this.pageSize,
      sort_by: this.currentSort.key,
      sort_order: this.currentSortOrder
    };

    this.datasetService.getDatasets(params, this.currentFilters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response: DatasetListResponse) => {
          this.datasets = response.datasets;
          this.totalCount = response.total_count;
          this.hasError = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des datasets:', error);
          this.hasError = true;
          this.errorMessage = error.message || 'Erreur lors du chargement des datasets';
          this.datasets = [];
          this.totalCount = 0;
        }
      });
  }

  /**
   * Effectue une recherche textuelle
   */
  private performSearch(searchTerm: string): void {
    if (searchTerm.trim()) {
      this.currentFilters = {
        ...this.currentFilters,
        dataset_name: searchTerm,
        objective: searchTerm
      };
    } else {
      // Supprimer les filtres de recherche textuelle
      const { dataset_name, objective, ...otherFilters } = this.currentFilters;
      this.currentFilters = otherFilters;
    }
    
    this.currentPage = 0;
    this.loadDatasets();
  }

  /**
   * Gère les changements de pagination
   */
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadDatasets();
  }

  /**
   * Gère les changements de tri
   */
  onSortChange(sortOption: SortOption): void {
    if (this.currentSort.key === sortOption.key) {
      // Inverser l'ordre si même critère
      this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Nouveau critère, utiliser l'ordre par défaut
      this.currentSort = sortOption;
      this.currentSortOrder = sortOption.default_order;
    }
    
    this.currentPage = 0;
    this.loadDatasets();
  }

  /**
   * Gère les changements de filtres
   */
  onFiltersChange(filters: DatasetFilterCriteria): void {
    this.currentFilters = { ...filters };
    this.currentPage = 0;
    this.loadDatasets();
  }

  /**
   * Gère la réinitialisation des filtres
   */
  onFiltersReset(): void {
    this.currentFilters = {};
    this.searchControl.setValue('');
    this.currentPage = 0;
    this.loadDatasets();
  }

  /**
   * Gère la visualisation d'un dataset
   */
  onViewDataset(datasetId: string): void {
    // Navigation vers la page de détail du dataset
    console.log('Visualiser dataset:', datasetId);
    // TODO: Implémenter la navigation
  }

  /**
   * Gère la sélection d'un dataset
   */
  onSelectDataset(dataset: Dataset): void {
    console.log('Dataset sélectionné:', dataset);
    // TODO: Implémenter la logique de sélection
  }

  /**
   * Gère l'ajout aux favoris
   */
  onFavoriteDataset(dataset: Dataset): void {
    console.log('Ajouter aux favoris:', dataset);
    // TODO: Implémenter la logique des favoris
  }

  /**
   * Bascule l'affichage des filtres
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  /**
   * Bascule le sidenav
   */
  toggleSidenav(): void {
    this.sidenavOpened = !this.sidenavOpened;
  }

  /**
   * Change le mode d'affichage
   */
  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
    this.compactCards = mode === 'list';
  }

  /**
   * Actualise la liste des datasets
   */
  refreshDatasets(): void {
    this.loadDatasets();
  }

  /**
   * Récupère le nombre de filtres actifs
   */
  getActiveFiltersCount(): number {
    return Object.keys(this.currentFilters).length;
  }

  /**
   * Vérifie si des filtres sont actifs
   */
  hasActiveFilters(): boolean {
    return this.getActiveFiltersCount() > 0;
  }

  /**
   * Récupère le texte de recherche actuel
   */
  getCurrentSearchTerm(): string {
    return this.searchControl.value || '';
  }

  /**
   * Efface la recherche
   */
  clearSearch(): void {
    this.searchControl.setValue('');
  }

  /**
   * Récupère l'icône pour le tri actuel
   */
  getSortIcon(): string {
    return this.currentSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  /**
   * Récupère la description du tri actuel
   */
  getSortDescription(): string {
    const order = this.currentSortOrder === 'asc' ? 'croissant' : 'décroissant';
    return `${this.currentSort.label} (${order})`;
  }

  /**
   * Vérifie si c'est le tri actuel
   */
  isCurrentSort(sortOption: SortOption): boolean {
    return this.currentSort.key === sortOption.key;
  }

  /**
   * Calcule le range d'éléments affichés
   */
  getDisplayRange(): string {
    const start = this.currentPage * this.pageSize + 1;
    const end = Math.min((this.currentPage + 1) * this.pageSize, this.totalCount);
    return `${start}-${end}`;
  }

  /**
   * Récupère des datasets recommandés si aucun résultat
   */
  loadRecommendedDatasets(): void {
    this.isLoading = true;
    
    this.datasetService.getRecommendedDatasets(this.pageSize)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (datasets) => {
          this.datasets = datasets;
          this.totalCount = datasets.length;
          this.hasError = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des datasets recommandés:', error);
          this.hasError = true;
          this.errorMessage = 'Impossible de charger les datasets recommandés';
        }
      });
  }

  /**
   * Exporte les résultats actuels
   */
  exportResults(): void {
    // TODO: Implémenter l'export
    console.log('Export des résultats:', this.datasets.length, 'datasets');
  }

  /**
   * Ouvre les paramètres d'affichage
   */
  openDisplaySettings(): void {
    // TODO: Implémenter les paramètres d'affichage
    console.log('Ouvrir les paramètres d\'affichage');
  }

  /**
   * Supprime le filtre de domaine
   */
  removeDomainFilter(): void {
    const newFilters = { ...this.currentFilters };
    delete newFilters.domain;
    this.onFiltersChange(newFilters);
  }

  /**
   * Supprime le filtre de tâche
   */
  removeTaskFilter(): void {
    const newFilters = { ...this.currentFilters };
    delete newFilters.task;
    this.onFiltersChange(newFilters);
  }

  /**
   * Obtient le nombre de domaines sélectionnés
   */
  getDomainCount(): number {
    return this.currentFilters.domain?.length || 0;
  }

  /**
   * Obtient le nombre de tâches sélectionnées
   */
  getTaskCount(): number {
    return this.currentFilters.task?.length || 0;
  }

  /**
   * Vérifie si le filtre de domaine est actif
   */
  hasDomainFilter(): boolean {
    return !!(this.currentFilters.domain?.length);
  }

  /**
   * Vérifie si le filtre de tâche est actif
   */
  hasTaskFilter(): boolean {
    return !!(this.currentFilters.task?.length);
  }

  /**
   * Fonction de tracking pour le ngFor
   */
  trackByDatasetId(index: number, dataset: Dataset): string {
    return dataset.id;
  }
} 