import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { DatasetFilterCriteria, ApplicationDomain, MLTaskType } from '../../../models/dataset.models';
import { DatasetService } from '../../../services/dataset.service';

@Component({
  selector: 'app-dataset-filters',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatCheckboxModule,
    MatCardModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './dataset-filters.component.html',
  styleUrls: ['./dataset-filters.component.scss']
})
export class DatasetFiltersComponent implements OnInit, OnDestroy {
  @Input() initialFilters: DatasetFilterCriteria = {};
  @Input() showApplyButton: boolean = true;
  @Input() autoApply: boolean = true;
  @Input() collapsible: boolean = true;
  
  @Output() filtersChange = new EventEmitter<DatasetFilterCriteria>();
  @Output() filtersApply = new EventEmitter<DatasetFilterCriteria>();
  @Output() filtersReset = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private datasetService = inject(DatasetService);
  private destroy$ = new Subject<void>();

  // Form group pour les filtres
  filterForm!: FormGroup;
  
  // Données pour les sélecteurs
  availableDomains: string[] = [];
  availableTasks: string[] = [];
  domainOptions = Object.values(ApplicationDomain);
  taskOptions = Object.values(MLTaskType);
  
  // État de l'expansion des sections
  isExpanded = true;
  
  // Ranges pour les inputs numériques
  instancesRange = { min: 0, max: 1000000000, step: 1000 };
  featuresRange = { min: 0, max: 1000, step: 1 };
  yearRange = { min: 1990, max: new Date().getFullYear(), step: 1 };

  ngOnInit(): void {
    this.initializeForm();
    this.loadFilterOptions();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialise le formulaire avec les valeurs par défaut
   */
  private initializeForm(): void {
    this.filterForm = this.fb.group({
      // Filtres textuels
      dataset_name: [this.initialFilters.dataset_name || ''],
      objective: [this.initialFilters.objective || ''],
      
      // Filtres catégoriels
      domain: [this.initialFilters.domain || []],
      task: [this.initialFilters.task || []],
      
      // Filtres numériques - Instances
      instances_number_min: [this.initialFilters.instances_number_min || null],
      instances_number_max: [this.initialFilters.instances_number_max || null],
      
      // Filtres numériques - Features
      features_number_min: [this.initialFilters.features_number_min || null],
      features_number_max: [this.initialFilters.features_number_max || null],
      
      // Filtres numériques - Année
      year_min: [this.initialFilters.year_min || null],
      year_max: [this.initialFilters.year_max || null],
      
      // Filtres de qualité
      ethical_score_min: [this.initialFilters.ethical_score_min || null],
      representativity_level: [this.initialFilters.representativity_level || null],
      
      // Filtres booléens
      is_split: [this.initialFilters.is_split || false],
      is_anonymized: [this.initialFilters.is_anonymized || false],
      has_temporal_factors: [this.initialFilters.has_temporal_factors || false],
      is_public: [this.initialFilters.is_public || false]
    });
  }

  /**
   * Charge les options de filtrage depuis l'API
   */
  private loadFilterOptions(): void {
    // Charger les domaines disponibles
    this.datasetService.getAvailableDomains()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (domains) => {
          this.availableDomains = domains;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des domaines:', error);
          // Utiliser les valeurs par défaut
          this.availableDomains = this.domainOptions;
        }
      });

    // Charger les tâches disponibles
    this.datasetService.getAvailableTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.availableTasks = tasks;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des tâches:', error);
          // Utiliser les valeurs par défaut
          this.availableTasks = this.taskOptions;
        }
      });
  }

  /**
   * Configure les souscriptions au formulaire
   */
  private setupFormSubscriptions(): void {
    if (this.autoApply) {
      this.filterForm.valueChanges
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          takeUntil(this.destroy$)
        )
        .subscribe(() => {
          this.emitFiltersChange();
        });
    }
  }

  /**
   * Émet les changements de filtres
   */
  private emitFiltersChange(): void {
    const filters = this.getFiltersFromForm();
    this.filtersChange.emit(filters);
  }

  /**
   * Extrait les filtres du formulaire
   */
  private getFiltersFromForm(): DatasetFilterCriteria {
    const formValue = this.filterForm.value;
    const filters: DatasetFilterCriteria = {};

    // Filtres textuels
    if (formValue.dataset_name?.trim()) {
      filters.dataset_name = formValue.dataset_name.trim();
    }
    if (formValue.objective?.trim()) {
      filters.objective = formValue.objective.trim();
    }

    // Filtres catégoriels
    if (formValue.domain?.length > 0) {
      filters.domain = formValue.domain;
    }
    if (formValue.task?.length > 0) {
      filters.task = formValue.task;
    }

    // Filtres numériques
    if (formValue.instances_number_min !== null && formValue.instances_number_min !== undefined) {
      filters.instances_number_min = formValue.instances_number_min;
    }
    if (formValue.instances_number_max !== null && formValue.instances_number_max !== undefined) {
      filters.instances_number_max = formValue.instances_number_max;
    }
    if (formValue.features_number_min !== null && formValue.features_number_min !== undefined) {
      filters.features_number_min = formValue.features_number_min;
    }
    if (formValue.features_number_max !== null && formValue.features_number_max !== undefined) {
      filters.features_number_max = formValue.features_number_max;
    }
    if (formValue.year_min !== null && formValue.year_min !== undefined) {
      filters.year_min = formValue.year_min;
    }
    if (formValue.year_max !== null && formValue.year_max !== undefined) {
      filters.year_max = formValue.year_max;
    }

    // Filtres de qualité
    if (formValue.ethical_score_min !== null && formValue.ethical_score_min !== undefined) {
      filters.ethical_score_min = formValue.ethical_score_min;
    }
    if (formValue.representativity_level !== null && formValue.representativity_level !== undefined) {
      filters.representativity_level = formValue.representativity_level;
    }

    // Filtres booléens (seulement si cochés)
    if (formValue.is_split === true) {
      filters.is_split = formValue.is_split;
    }
    if (formValue.is_anonymized === true) {
      filters.is_anonymized = formValue.is_anonymized;
    }
    if (formValue.has_temporal_factors === true) {
      filters.has_temporal_factors = formValue.has_temporal_factors;
    }
    if (formValue.is_public === true) {
      filters.is_public = formValue.is_public;
    }

    return filters;
  }

  /**
   * Applique les filtres manuellement
   */
  applyFilters(): void {
    const filters = this.getFiltersFromForm();
    this.filtersApply.emit(filters);
  }

  /**
   * Remet à zéro tous les filtres
   */
  resetFilters(): void {
    this.filterForm.reset();
    this.filtersReset.emit();
  }

  /**
   * Remet à zéro une section spécifique
   */
  resetSection(section: string): void {
    switch (section) {
      case 'text':
        this.filterForm.patchValue({
          dataset_name: '',
          objective: ''
        });
        break;
      case 'category':
        this.filterForm.patchValue({
          domain: [],
          task: []
        });
        break;
      case 'numerical':
        this.filterForm.patchValue({
          instances_number_min: null,
          instances_number_max: null,
          features_number_min: null,
          features_number_max: null,
          year_min: null,
          year_max: null
        });
        break;
      case 'quality':
        this.filterForm.patchValue({
          ethical_score_min: null,
          representativity_level: null,
          is_split: false,
          is_anonymized: false,
          has_temporal_factors: false,
          is_public: false
        });
        break;
    }
  }

  /**
   * Vérifie si des filtres sont actifs
   */
  hasActiveFilters(): boolean {
    const filters = this.getFiltersFromForm();
    return Object.keys(filters).length > 0;
  }

  /**
   * Compte le nombre de filtres actifs
   */
  getActiveFiltersCount(): number {
    const filters = this.getFiltersFromForm();
    return Object.keys(filters).length;
  }

  /**
   * Vérifie si des filtres numériques sont actifs
   */
  hasNumericalFilters(): boolean {
    const formValue = this.filterForm.value;
    return !!(
      formValue.instances_number_min !== null ||
      formValue.instances_number_max !== null ||
      formValue.features_number_min !== null ||
      formValue.features_number_max !== null ||
      formValue.year_min !== null ||
      formValue.year_max !== null
    );
  }

  /**
   * Vérifie si des filtres de qualité sont actifs
   */
  hasQualityFilters(): boolean {
    const formValue = this.filterForm.value;
    return !!(
      formValue.ethical_score_min !== null ||
      formValue.representativity_level !== null ||
      formValue.is_split === true ||
      formValue.is_anonymized === true ||
      formValue.has_temporal_factors === true ||
      formValue.is_public === true
    );
  }

  /**
   * Formate la valeur des instances pour l'affichage
   */
  formatInstancesValue(value: number): string {
    return this.datasetService.formatInstancesCount(value);
  }

  /**
   * Formate la valeur des features pour l'affichage
   */
  formatFeaturesValue(value: number): string {
    return value.toString();
  }

  /**
   * Formate la valeur de l'année pour l'affichage
   */
  formatYearValue(value: number): string {
    return value.toString();
  }

  /**
   * Récupère les domaines sélectionnés
   */
  getSelectedDomains(): string[] {
    return this.filterForm.get('domain')?.value || [];
  }

  /**
   * Récupère les tâches sélectionnées
   */
  getSelectedTasks(): string[] {
    return this.filterForm.get('task')?.value || [];
  }

  /**
   * Supprime un domaine sélectionné
   */
  removeDomain(domain: string): void {
    const currentDomains = this.getSelectedDomains();
    const newDomains = currentDomains.filter(d => d !== domain);
    this.filterForm.patchValue({ domain: newDomains });
  }

  /**
   * Supprime une tâche sélectionnée
   */
  removeTask(task: string): void {
    const currentTasks = this.getSelectedTasks();
    const newTasks = currentTasks.filter(t => t !== task);
    this.filterForm.patchValue({ task: newTasks });
  }

  /**
   * Bascule l'état d'expansion
   */
  toggleExpansion(): void {
    this.isExpanded = !this.isExpanded;
  }

  /**
   * Récupère la couleur associée à un domaine
   */
  getDomainColor(domain: string): string {
    return this.datasetService.getDomainColor(domain);
  }

  /**
   * Récupère l'icône associée à une tâche
   */
  getTaskIcon(task: string): string {
    return this.datasetService.getTaskIcon(task);
  }
} 