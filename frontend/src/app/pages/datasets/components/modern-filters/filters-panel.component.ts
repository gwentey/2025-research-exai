import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { DatasetFilterCriteria } from '../../../../models/dataset.models';
import { FilterChipBarComponent } from './filter-chip-bar.component';
import { FilterGroupComponent } from './filter-group.component';

/**
 * Composant principal du panel de filtres moderne
 * Architecture modulaire et responsive avec design system aligné sur Sorbonne
 */
@Component({
  selector: 'app-filters-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranslateModule,
    FilterChipBarComponent,
    FilterGroupComponent
  ],
  templateUrl: './filters-panel.component.html',
  styleUrls: ['./filters-panel.component.scss'],
  animations: [
    // Animation slide down révolutionnaire
    trigger('slideDown', [
      transition(':enter', [
        style({
          opacity: 0,
          height: '0px',
          overflow: 'hidden',
          transform: 'translateY(-12px) scale(0.95)',
          filter: 'blur(2px)'
        }),
        animate('350ms cubic-bezier(0.16, 1, 0.3, 1)', style({
          opacity: 1,
          height: '*',
          transform: 'translateY(0) scale(1)',
          filter: 'blur(0)'
        }))
      ]),
      transition(':leave', [
        style({
          opacity: 1,
          height: '*',
          overflow: 'hidden',
          transform: 'translateY(0) scale(1)'
        }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({
          opacity: 0,
          height: '0px',
          transform: 'translateY(-8px) scale(0.98)'
        }))
      ])
    ]),

    // Animation slide up pour footer
    trigger('slideUp', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(20px) scale(0.95)',
          filter: 'blur(1px)'
        }),
        animate('300ms cubic-bezier(0.25, 1, 0.5, 1)', style({
          opacity: 1,
          transform: 'translateY(0) scale(1)',
          filter: 'blur(0)'
        }))
      ]),
      transition(':leave', [
        style({
          opacity: 1,
          transform: 'translateY(0) scale(1)'
        }),
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)', style({
          opacity: 0,
          transform: 'translateY(12px) scale(0.98)'
        }))
      ])
    ]),

    // Animation fade in révolutionnaire
    trigger('fadeIn', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'scale(0.95)',
          filter: 'blur(4px)'
        }),
        animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({
          opacity: 1,
          transform: 'scale(1)',
          filter: 'blur(0)'
        }))
      ]),
      transition(':leave', [
        style({
          opacity: 1,
          transform: 'scale(1)'
        }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({
          opacity: 0,
          transform: 'scale(0.98)'
        }))
      ])
    ])
  ]
})
export class FiltersPanelComponent implements OnInit, OnDestroy {
  @Input() initialFilters: DatasetFilterCriteria = {};
  @Input() showApplyButton: boolean = true;
  @Input() autoApply: boolean = true;
  @Input() collapsible: boolean = true;
  @Input() layout: 'vertical' | 'horizontal' = 'vertical';
  @Input() showActiveFiltersBar: boolean = true;
  @Input() debounceTime: number = 300;

  @Output() filtersChange = new EventEmitter<DatasetFilterCriteria>();
  @Output() filtersApply = new EventEmitter<DatasetFilterCriteria>();
  @Output() filtersReset = new EventEmitter<void>();
  @Output() filtersClear = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // Form group principal
  filterForm!: FormGroup;

  // État du panel
  isExpanded = true;
  isLoading = false;

  // Configuration des groupes de filtres - TOUS EXPANDED POUR UNE EXPÉRIENCE MODERNE
  filterGroups = [
    {
      id: 'text-search',
      titleKey: 'DATASETS.FILTERS.GROUPS.TEXT_SEARCH.TITLE',
      descriptionKey: 'DATASETS.FILTERS.GROUPS.TEXT_SEARCH.DESCRIPTION',
      icon: 'search',
      expanded: true,
      fields: ['dataset_name', 'objective']
    },
    {
      id: 'categories',
      titleKey: 'DATASETS.FILTERS.GROUPS.CATEGORIES.TITLE',
      descriptionKey: 'DATASETS.FILTERS.GROUPS.CATEGORIES.DESCRIPTION',
      icon: 'category',
      expanded: true, // RÉVOLUTIONNAIRE : Toujours visible
      fields: ['domain', 'task']
    },
    {
      id: 'numerical',
      titleKey: 'DATASETS.FILTERS.GROUPS.NUMERICAL.TITLE',
      descriptionKey: 'DATASETS.FILTERS.GROUPS.NUMERICAL.DESCRIPTION',
      icon: 'analytics',
      expanded: true, // RÉVOLUTIONNAIRE : Toujours visible
      fields: ['instances_number_min', 'instances_number_max', 'features_number_min', 'features_number_max', 'year_min', 'year_max']
    },
    {
      id: 'quality',
      titleKey: 'DATASETS.FILTERS.GROUPS.QUALITY.TITLE',
      descriptionKey: 'DATASETS.FILTERS.GROUPS.QUALITY.DESCRIPTION',
      icon: 'verified',
      expanded: true, // RÉVOLUTIONNAIRE : Toujours visible
      fields: ['ethical_score_min', 'representativity_level', 'is_split', 'is_anonymized', 'has_temporal_factors', 'is_public']
    }
  ];

  ngOnInit(): void {
    this.initializeForm();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialise le formulaire avec les filtres initiaux
   */
  private initializeForm(): void {
    this.filterForm = this.fb.group({
      // Recherche textuelle
      dataset_name: [this.initialFilters.dataset_name || ''],
      objective: [this.initialFilters.objective || ''],

      // Domaines et tâches
      domain: [this.initialFilters.domain || []],
      task: [this.initialFilters.task || []],

      // Caractéristiques numériques
      instances_number_min: [this.initialFilters.instances_number_min || null],
      instances_number_max: [this.initialFilters.instances_number_max || null],
      features_number_min: [this.initialFilters.features_number_min || null],
      features_number_max: [this.initialFilters.features_number_max || null],
      year_min: [this.initialFilters.year_min || null],
      year_max: [this.initialFilters.year_max || null],

      // Critères de qualité
      ethical_score_min: [this.initialFilters.ethical_score_min || null],
      representativity_level: [this.initialFilters.representativity_level || null],
      is_split: [this.initialFilters.is_split || false],
      is_anonymized: [this.initialFilters.is_anonymized || false],
      has_temporal_factors: [this.initialFilters.has_temporal_factors || false],
      is_public: [this.initialFilters.is_public || false]
    });
  }

  /**
   * Configure les souscriptions aux changements du formulaire
   */
  private setupFormSubscriptions(): void {
    this.filterForm.valueChanges
      .pipe(
        debounceTime(this.debounceTime),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        const filters = this.buildFiltersFromForm(value);
        this.filtersChange.emit(filters);

        if (this.autoApply) {
          this.filtersApply.emit(filters);
        }
      });
  }

  /**
   * Construit l'objet de filtres depuis les valeurs du formulaire
   */
  private buildFiltersFromForm(formValue: any): DatasetFilterCriteria {
    const filters: DatasetFilterCriteria = {};

    // Filtrer les valeurs vides et construire l'objet de critères
    Object.keys(formValue).forEach(key => {
      const value = formValue[key];

      if (value !== null && value !== undefined && value !== '' &&
          !(Array.isArray(value) && value.length === 0)) {
        (filters as any)[key] = value;
      }
    });

    return filters;
  }

  /**
   * Vérifie si des filtres sont actifs
   */
  hasActiveFilters(): boolean {
    const currentFilters = this.buildFiltersFromForm(this.filterForm.value);
    return Object.keys(currentFilters).length > 0;
  }

  /**
   * Compte le nombre de filtres actifs
   */
  getActiveFiltersCount(): number {
    const currentFilters = this.buildFiltersFromForm(this.filterForm.value);
    return Object.keys(currentFilters).length;
  }

  /**
   * Obtient les filtres actifs pour l'affichage en chips
   */
  getActiveFiltersForChips(): Array<{key: string, label: string, value: any}> {
    const currentFilters = this.buildFiltersFromForm(this.filterForm.value);
    const chips: Array<{key: string, label: string, value: any}> = [];

    Object.entries(currentFilters).forEach(([key, value]) => {
      // Générer le label basé sur la clé et la valeur
      let label = this.generateFilterLabel(key, value);

      if (label) {
        chips.push({ key, label, value });
      }
    });

    return chips;
  }

  /**
   * Génère un label lisible pour un filtre
   */
  private generateFilterLabel(key: string, value: any): string {
    switch (key) {
      case 'dataset_name':
        return `Nom: "${value}"`;
      case 'objective':
        return `Objectif: "${value}"`;
      case 'domain':
        return Array.isArray(value) ? `Domaines (${value.length})` : `Domaine: ${value}`;
      case 'task':
        return Array.isArray(value) ? `Tâches (${value.length})` : `Tâche: ${value}`;
      case 'instances_number_min':
        return `Instances ≥ ${value.toLocaleString()}`;
      case 'instances_number_max':
        return `Instances ≤ ${value.toLocaleString()}`;
      case 'features_number_min':
        return `Features ≥ ${value}`;
      case 'features_number_max':
        return `Features ≤ ${value}`;
      case 'year_min':
        return `Depuis ${value}`;
      case 'year_max':
        return `Jusqu'à ${value}`;
      case 'ethical_score_min':
        return `Score éthique ≥ ${value}%`;
      case 'representativity_level':
        return `Représentativité: ${value}`;
      case 'is_split':
        return 'Dataset divisé';
      case 'is_anonymized':
        return 'Données anonymisées';
      case 'has_temporal_factors':
        return 'Facteurs temporels';
      case 'is_public':
        return 'Accès public';
      default:
        return '';
    }
  }

  /**
   * Supprime un filtre spécifique
   */
  removeFilter(filterKey: string): void {
    if (this.filterForm.contains(filterKey)) {
      const control = this.filterForm.get(filterKey);
      if (control) {
        // Réinitialiser à la valeur par défaut selon le type
        if (Array.isArray(control.value)) {
          control.setValue([]);
        } else if (typeof control.value === 'boolean') {
          control.setValue(false);
        } else {
          control.setValue(null);
        }
      }
    }
  }

  /**
   * Réinitialise tous les filtres
   */
  resetAllFilters(): void {
    this.filterForm.reset();

    // Réinitialiser explicitement les valeurs par défaut
    this.filterForm.patchValue({
      dataset_name: '',
      objective: '',
      domain: [],
      task: [],
      instances_number_min: null,
      instances_number_max: null,
      features_number_min: null,
      features_number_max: null,
      year_min: null,
      year_max: null,
      ethical_score_min: null,
      representativity_level: null,
      is_split: false,
      is_anonymized: false,
      has_temporal_factors: false,
      is_public: false
    });

    this.filtersReset.emit();
    this.filtersClear.emit();
  }

  /**
   * Applique les filtres manuellement
   */
  applyFilters(): void {
    const filters = this.buildFiltersFromForm(this.filterForm.value);
    this.filtersApply.emit(filters);
  }

  /**
   * Réinitialise une section spécifique de filtres
   */
  resetFilterGroup(groupId: string): void {
    const group = this.filterGroups.find(g => g.id === groupId);
    if (group) {
      const resetValues: any = {};

      group.fields.forEach(field => {
        const control = this.filterForm.get(field);
        if (control) {
          if (Array.isArray(control.value)) {
            resetValues[field] = [];
          } else if (typeof control.value === 'boolean') {
            resetValues[field] = false;
          } else {
            resetValues[field] = null;
          }
        }
      });

      this.filterForm.patchValue(resetValues);
    }
  }

  /**
   * Vérifie si un groupe de filtres a des valeurs actives
   */
  hasActiveFiltersInGroup(groupId: string): boolean {
    const group = this.filterGroups.find(g => g.id === groupId);
    if (!group) return false;

    return group.fields.some(field => {
      const control = this.filterForm.get(field);
      if (!control) return false;

      const value = control.value;
      return value !== null && value !== undefined && value !== '' &&
             !(Array.isArray(value) && value.length === 0) &&
             !(typeof value === 'boolean' && value === false);
    });
  }

  /**
   * Toggle l'expansion du panel principal
   */
  toggleExpansion(): void {
    this.isExpanded = !this.isExpanded;
  }

  /**
   * Toggle l'expansion d'un groupe de filtres
   */
  toggleGroupExpansion(groupId: string): void {
    const group = this.filterGroups.find(g => g.id === groupId);
    if (group) {
      group.expanded = !group.expanded;
    }
  }

  /**
   * Track by function pour optimiser le rendu des groupes
   */
  trackByGroupId(index: number, group: any): string {
    return group.id;
  }

  /**
   * Calcule le pourcentage de complétion des filtres
   */
  getFilterCompletionPercentage(): number {
    const totalPossibleFilters = this.filterGroups.reduce((sum, group) => sum + group.fields.length, 0);
    const activeFiltersCount = this.getActiveFiltersCount();

    if (totalPossibleFilters === 0) return 0;

    const percentage = Math.round((activeFiltersCount / totalPossibleFilters) * 100);
    return Math.min(percentage, 100);
  }

  /**
   * Obtient une estimation intelligente du nombre de résultats
   */
  getEstimatedResultsCount(): number {
    // Logique d'estimation basée sur les filtres actifs
    const baseCount = 100; // Nombre de base hypothétique
    const reductionFactor = Math.max(0.1, 1 - (this.getActiveFiltersCount() * 0.15));
    return Math.round(baseCount * reductionFactor);
  }

  /**
   * Vérifie si le formulaire est dans un état valide
   */
  isFormValid(): boolean {
    return this.filterForm.valid;
  }

  /**
   * Obtient l'état de progression visuel
   */
  getProgressState(): 'empty' | 'minimal' | 'moderate' | 'complete' {
    const percentage = this.getFilterCompletionPercentage();

    if (percentage === 0) return 'empty';
    if (percentage < 25) return 'minimal';
    if (percentage < 75) return 'moderate';
    return 'complete';
  }

    /**
   * Ferme le panel de filtres
   */
  closePanel(): void {
    this.filtersClear.emit();
  }
}
