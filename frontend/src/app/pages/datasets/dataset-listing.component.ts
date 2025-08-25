import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
// import { MatInputModule } from '@angular/material/input'; // Plus nécessaire avec composants custom
// import { MatFormFieldModule } from '@angular/material/form-field'; // Plus nécessaire avec composants custom
// import { MatSelectModule } from '@angular/material/select'; // Plus nécessaire avec composants custom
// import { MatButtonToggleModule } from '@angular/material/button-toggle'; // Plus nécessaire avec composant custom
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, Observable } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { DatasetService } from '../../services/dataset.service';
import { RoleService } from '../../services/role.service';
import { Dataset, DatasetFilterCriteria, PaginationParams } from '../../models/dataset.models';
import { DatasetCardComponent } from './components/dataset-card.component';
import { FiltersPanelComponent } from './components/modern-filters/filters-panel.component';
import { CustomViewToggleComponent, ViewMode } from './components/custom-view-toggle/custom-view-toggle.component';
import { CustomSearchFieldComponent } from './components/custom-search-field/custom-search-field.component';
import { CustomSortSelectComponent, SortOption } from './components/custom-sort-select/custom-sort-select.component';
import { CustomFilterButtonComponent } from './components/custom-filter-button/custom-filter-button.component';
import { CustomRefreshButtonComponent } from './components/custom-refresh-button/custom-refresh-button.component';

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
    MatCardModule,
    MatIconModule,
    // MatInputModule, // Plus nécessaire avec composants custom
    // MatFormFieldModule, // Plus nécessaire avec composants custom
    // MatSelectModule, // Plus nécessaire avec composants custom
    // MatButtonToggleModule, // Plus nécessaire avec composant custom
    MatChipsModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatTooltipModule,
    DatasetCardComponent,
    FiltersPanelComponent,
    CustomViewToggleComponent,
    CustomSearchFieldComponent,
    CustomSortSelectComponent,
    CustomFilterButtonComponent,
    CustomRefreshButtonComponent,
    TranslateModule
  ],
  templateUrl: './dataset-listing.component.html',
  styleUrls: ['./dataset-listing.component.scss']
})
export class DatasetListingComponent implements OnInit, OnDestroy {
  private datasetService = inject(DatasetService);
  private translateService = inject(TranslateService);
  private roleService = inject(RoleService);
  private router = inject(Router);
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
  viewMode: ViewMode = 'grid';

  // Options de tri pour le composant custom
  sortOptions: SortOption[] = [
    { value: 'dataset_name', label: 'Nom du dataset', translationKey: 'DATASETS.SORT.DATASET_NAME' },
    { value: 'year', label: 'Année', translationKey: 'DATASETS.SORT.YEAR' },
    { value: 'instances_number', label: 'Nombre d\'instances', translationKey: 'DATASETS.SORT.INSTANCES_NUMBER' },
    { value: 'features_number', label: 'Nombre de features', translationKey: 'DATASETS.SORT.FEATURES_NUMBER' },
    { value: 'num_citations', label: 'Nombre de citations', translationKey: 'DATASETS.SORT.NUM_CITATIONS' },
    { value: 'created_at', label: 'Date de création', translationKey: 'DATASETS.SORT.CREATED_AT' },
    { value: 'updated_at', label: 'Dernière mise à jour', translationKey: 'DATASETS.SORT.UPDATED_AT' }
  ];

  // Permissions
  canUploadDatasets$: Observable<boolean>;
  currentSort = 'dataset_name';

  ngOnInit(): void {
    // Initialiser les permissions
    this.canUploadDatasets$ = this.roleService.canUploadDatasets();
    
    // DEBUG: Vérifier les permissions
    this.canUploadDatasets$.subscribe(canUpload => {
      console.log('🔐 PERMISSIONS DEBUG - canUploadDatasets:', canUpload);
      console.log('🔐 BOUTON FAB devrait être', canUpload ? 'VISIBLE' : 'CACHÉ');
    });

    this.loadDatasets();

    // Plus besoin de forcer les dimensions avec les composants custom !
  }

    // ========================================
  // SUPPRIMÉ : Plus besoin de JavaScript sale !
  // Les composants custom gèrent leurs dimensions proprement
  // ========================================



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Nettoyage : retirer la classe modal-open et restaurer sidebar
    document.body.classList.remove('modal-open');

    // Retirer le CSS injecté
    this.removeHideSidebarCSS();

    // Restaurer les styles si nécessaire
    const sidebarSelectors = [
      '.mat-drawer-inner-container',
      '.mat-drawer-container .mat-drawer',
      '.mat-sidenav-container .mat-sidenav',
      '.mat-drawer',
      '.mat-sidenav',
      'app-sidebar',
      '.flex-layout',
      '.branding',
      '.mat-nav-list',
      '.sidebar-list',
      '.profile-bar'
    ];

    sidebarSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = '';
          el.style.visibility = '';
          el.style.opacity = '';
          el.style.zIndex = '';
          el.style.pointerEvents = '';
        }
      });
    });
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
    const newFilters = { ...this.currentFilters };

    switch (filter.key) {
      case 'search':
        this.quickSearchTerm = '';
        break;

      case 'domain':
        delete newFilters.domain;
        break;

      case 'task':
        delete newFilters.task;
        break;

      case 'instances':
        delete newFilters.instances_number_min;
        delete newFilters.instances_number_max;
        break;

      case 'features':
        delete newFilters.features_number_min;
        delete newFilters.features_number_max;
        break;

      case 'year':
        delete newFilters.year_min;
        delete newFilters.year_max;
        break;

      case 'ethical_score':
        delete newFilters.ethical_score_min;
        break;

      case 'representativity':
        delete newFilters.representativity_level;
        break;

      case 'is_split':
        delete newFilters.is_split;
        break;

      case 'is_anonymized':
        delete newFilters.is_anonymized;
        break;

      case 'has_temporal_factors':
        delete newFilters.has_temporal_factors;
        break;

      case 'is_public':
        delete newFilters.is_public;
        break;

      default:
        // Fallback pour les autres filtres
        delete (newFilters as any)[filter.key];
        break;
    }

    this.currentFilters = newFilters;
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
   * Changement de vue avec le composant custom
   */
  onCustomViewChange(viewMode: ViewMode): void {
    this.viewMode = viewMode;
    console.log('Vue changée vers:', viewMode);
  }

  /**
   * Changement de vue (ancienne méthode Material, gardée pour compatibilité)
   */
  onViewChange(view: any): void {
    this.viewMode = view.value;
    // Plus besoin de forcer les dimensions avec les composants custom !
  }

  /**
   * Changement de tri
   */
  onSortChange(event: any): void {
    this.currentSort = event.value;
    this.loadDatasets();
    // Plus besoin de forcer les dimensions avec les composants custom !
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
    console.log('Navigation vers ML Pipeline wizard...');

    // Navigation vers le wizard ML Pipeline avec le dataset sélectionné
    this.router.navigate(['/ml-pipeline-wizard'], {
      queryParams: {
        datasetId: dataset.id,
        datasetName: dataset.dataset_name
      }
    }).then(success => {
      if (success) {
        console.log('Navigation réussie vers ML Pipeline');
      } else {
        console.error('Échec de la navigation vers ML Pipeline');
        // Fallback : essayer une navigation alternative
        this.router.navigate(['/starter']).then(() => {
          alert(`Le module ML Pipeline sera bientôt disponible pour le dataset "${dataset.dataset_name}". Cette fonctionnalité est en cours de déploiement.`);
        });
      }
    }).catch(error => {
      console.error('Erreur de navigation:', error);
      alert(`Une erreur est survenue. Veuillez rafraîchir la page et réessayer.`);
    });
  }

  /**
   * Visualisation d'un dataset
   */
  onViewDataset(datasetId: string): void {
    this.router.navigate(['/datasets', datasetId]);
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

  /**
   * Tracking function pour les chips de filtres
   */
  trackByFilterChip(index: number, filter: FilterChip): string {
    return filter.key;
  }

  // === GESTION MODAL DE FILTRAGE ===

  /**
   * Injecte du CSS pour masquer le sidebar de force
   */
  private injectHideSidebarCSS(): void {
    // Supprimer le style existant s'il y en a un
    const existingStyle = document.getElementById('hide-sidebar-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Créer un nouveau style
    const style = document.createElement('style');
    style.id = 'hide-sidebar-style';
        style.innerHTML = `
      /* MASQUAGE SIDEBAR ULTRA-AGRESSIF SUR MOBILE/TABLETTE */
      @media (max-width: 992px) {
        body.modal-open .mat-drawer-inner-container,
        body.modal-open .mat-drawer-container .mat-drawer,
        body.modal-open .mat-sidenav-container .mat-sidenav,
        body.modal-open .mat-drawer,
        body.modal-open .mat-sidenav,
        body.modal-open app-sidebar,
        body.modal-open .flex-layout,
        body.modal-open .branding,
        body.modal-open .mat-nav-list,
        body.modal-open .sidebar-list,
        body.modal-open .profile-bar,
        body.modal-open [class*="ng-tns-c"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          z-index: -99999 !important;
          position: absolute !important;
          left: -9999px !important;
          width: 0 !important;
          height: 0 !important;
          pointer-events: none !important;
          transform: translateX(-200vw) !important;
        }
      }

      /* FORÇAGE GLOBAL POUR TOUS LES ÉCRANS SI NÉCESSAIRE */
      body.modal-open .mat-drawer-inner-container,
      body.modal-open .mat-drawer-container .mat-drawer {
        z-index: -99999 !important;
      }
    `;

    // Ajouter le style au head
    document.head.appendChild(style);
    console.log('🎨 CSS injecté pour masquer sidebar');
  }

  /**
   * Retire le CSS d'injection pour masquer le sidebar
   */
  private removeHideSidebarCSS(): void {
    const style = document.getElementById('hide-sidebar-style');
    if (style) {
      style.remove();
      console.log('🗑️ CSS de masquage sidebar retiré');
    }
  }

  /**
   * Ouvre la modal de filtrage
   */
  openFiltersModal(): void {
    this.tempFilters = { ...this.currentFilters };
    this.previewCount = null;
    this.showFiltersModal = true;

    // Ajouter classe pour masquer sidebar sur mobile
    document.body.classList.add('modal-open');

    // INJECTION CSS DIRECTE pour forcer le masquage
    this.injectHideSidebarCSS();

                // MASQUAGE JavaScript ULTRA-AGRESSIF SUR MOBILE
    const isMobile = window.innerWidth <= 992; // Élargi la détection mobile

    setTimeout(() => {
      console.log('🔥 MASQUAGE SIDEBAR - Largeur écran:', window.innerWidth, 'Mobile:', isMobile);

      const sidebarSelectors = [
        '.mat-drawer-inner-container',
        '.mat-drawer-container .mat-drawer',
        '.mat-sidenav-container .mat-sidenav',
        '.mat-drawer',
        '.mat-sidenav',
        'app-sidebar',
        '.flex-layout',
        '.branding',
        '.mat-nav-list',
        '.sidebar-list',
        '.profile-bar',
        '[class*="ng-tns-c"]'
      ];

      let hiddenCount = 0;
      sidebarSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el instanceof HTMLElement) {
            if (isMobile) {
              // MASQUAGE BRUTAL sur mobile
              el.style.display = 'none !important';
              el.style.visibility = 'hidden !important';
              el.style.opacity = '0 !important';
              el.style.zIndex = '-99999 !important';
              el.style.position = 'absolute !important';
              el.style.left = '-9999px !important';
              el.style.pointerEvents = 'none !important';
              el.style.width = '0 !important';
              el.style.height = '0 !important';
              el.style.transform = 'translateX(-200vw) !important';
              hiddenCount++;
              console.log('🚫 MASQUÉ:', selector, el);
            }
          }
        });
      });

      console.log('✅ Total éléments masqués:', hiddenCount);

      if (!isMobile) {
        console.log('🖥️ Grand écran - Sidebar préservé');
      }
    }, 100); // Délai plus long pour s'assurer que le DOM est prêt

    // Calculer le preview initial
    setTimeout(() => this.updatePreviewCount(), 100);
  }

  /**
   * Ferme la modal de filtrage
   */
  closeFiltersModal(): void {
    this.showFiltersModal = false;
    this.tempFilters = {};
    this.previewCount = null;

    // Retirer classe pour réafficher sidebar
    document.body.classList.remove('modal-open');

    // Retirer le CSS injecté
    this.removeHideSidebarCSS();

        // RESTAURATION : Réafficher les éléments sidebar (si masqués)
    const sidebarSelectors = [
      '.mat-drawer-inner-container',
      '.mat-drawer-container .mat-drawer',
      '.mat-sidenav-container .mat-sidenav',
      '.mat-drawer',
      '.mat-sidenav',
      'app-sidebar',
      '.mat-nav-list',
      '.sidebar-list',
      '.profile-bar'
    ];

    sidebarSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = '';
          el.style.visibility = '';
          el.style.opacity = '';
          el.style.zIndex = '';
          el.style.pointerEvents = '';
        }
      });
    });

    console.log('🔄 Sidebar restauré après fermeture modal');
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
   * Met à jour le compteur d'aperçu en temps réel via un appel API
   */
  private updatePreviewCount(): void {
    const hasFilters = Object.keys(this.tempFilters).length > 0;

    if (!hasFilters) {
      // Aucun filtre = nombre total actuel
      this.previewCount = this.totalDatasets || 0;
      return;
    }

    // Préparer les filtres temporaires pour le preview
    const previewFilters: DatasetFilterCriteria = { ...this.tempFilters };

    // Ajouter la recherche rapide si présente
    if (this.quickSearchTerm) {
      previewFilters.dataset_name = this.quickSearchTerm;
    }

    // Appel API pour obtenir le count réel avec les filtres temporaires
    const previewParams: PaginationParams = {
      page: 1,
      page_size: 1, // On veut juste le count, pas les données
      sort_by: this.currentSort,
      sort_order: 'desc'
    };

    this.datasetService.getDatasets(previewParams, previewFilters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.previewCount = response.total_count;
        },
        error: (error) => {
          console.warn('Erreur lors du calcul du preview:', error);
          // Fallback sur une estimation
          this.previewCount = Math.max(0, Math.floor((this.totalDatasets || 0) * 0.7));
        }
      });
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

    // DEBUG: Log des filtres transmis
    console.log('🔍 Filtres transmis au backend:', filters);
    console.log('📋 Paramètres de pagination:', params);

    this.datasetService.getDatasets(params, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Le filtrage est maintenant entièrement géré côté backend
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

  /**
   * Ouvre la page d'upload de datasets
   */
  uploadDataset(): void {
    console.log('🚀 BOUTON FAB CLIQUÉ - Navigation vers upload de datasets');
    this.router.navigate(['/datasets/upload']);
  }

  // Note: Le filtrage côté client a été supprimé.
  // Toute la logique de filtrage et de scoring est maintenant gérée côté backend
  // dans le service-selection via les endpoints /datasets et /datasets/score
}
