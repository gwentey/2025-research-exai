import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { DatasetService } from '../../../../services/dataset.service';

export interface FilterGroupConfig {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  expanded: boolean;
  fields: string[];
}

/**
 * Composant moderne pour un groupe de filtres - Style SaaS épuré
 */
@Component({
  selector: 'app-filter-group',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './filter-group.component.html',
  styleUrls: ['./filter-group.component.scss']
})
export class FilterGroupComponent implements OnInit {
  @Input() groupConfig!: FilterGroupConfig;
  @Input() formGroup!: FormGroup;
  @Input() expanded: boolean = true; // Expanded par défaut pour visibilité immédiate
  @Input() hasActiveFilters: boolean = false;

  @Output() toggleExpansion = new EventEmitter<void>();
  @Output() resetGroup = new EventEmitter<void>();

  private datasetService = inject(DatasetService);

  // Données pour les sélecteurs - avec fallback immédiat
  availableDomains: string[] = [
    'Santé', 'Finance', 'Éducation', 'Transport', 'Commerce',
    'Technologie', 'Agriculture', 'Énergie', 'Recherche', 'Social'
  ];

  availableTasks: string[] = [
    'Classification', 'Régression', 'Clustering', 'Réduction de dimension',
    'Détection d\'anomalies', 'Traitement du langage naturel', 'Vision par ordinateur'
  ];

  // Ranges pour les sliders
  instancesRange = { min: 0, max: 1000000, step: 1000 };
  featuresRange = { min: 0, max: 1000, step: 1 };

  ngOnInit(): void {
    this.loadFilterOptions();
  }

  /**
   * Charge les options depuis l'API (avec fallback)
   */
  private loadFilterOptions(): void {
    this.datasetService.getAvailableDomains().subscribe({
      next: (domains) => {
        if (domains && domains.length > 0) {
          this.availableDomains = domains;
        }
      },
      error: (error) => {
        console.log('Utilisation des domaines par défaut:', error);
        // Garde les valeurs par défaut
      }
    });

    this.datasetService.getAvailableTasks().subscribe({
      next: (tasks) => {
        if (tasks && tasks.length > 0) {
          this.availableTasks = tasks;
        }
      },
      error: (error) => {
        console.log('Utilisation des tâches par défaut:', error);
        // Garde les valeurs par défaut
      }
    });
  }

  /**
   * Toggle l'expansion du groupe
   */
  onToggleExpansion(): void {
    this.toggleExpansion.emit();
  }

  /**
   * Reset les filtres de ce groupe
   */
  onResetGroup(): void {
    this.resetGroup.emit();
  }

  // ===============================================
  // MÉTHODES POUR LES DOMAINES
  // ===============================================

  isDomainSelected(domain: string): boolean {
    const domainControl = this.formGroup.get('domain');
    const selectedDomains = domainControl?.value || [];
    return selectedDomains.includes(domain);
  }

  toggleDomain(domain: string): void {
    const domainControl = this.formGroup.get('domain');
    if (!domainControl) return;

    const currentDomains = domainControl.value || [];
    const isSelected = currentDomains.includes(domain);

    if (isSelected) {
      const updatedDomains = currentDomains.filter((d: string) => d !== domain);
      domainControl.setValue(updatedDomains);
    } else {
      const updatedDomains = [...currentDomains, domain];
      domainControl.setValue(updatedDomains);
    }
  }

  getDomainIcon(domain: string): string {
    const iconMap: { [key: string]: string } = {
      'Santé': 'medical_services',
      'Finance': 'attach_money',
      'Éducation': 'school',
      'Transport': 'directions_car',
      'Commerce': 'shopping_cart',
      'Technologie': 'computer',
      'Agriculture': 'eco',
      'Énergie': 'flash_on',
      'Recherche': 'science',
      'Social': 'people'
    };
    return iconMap[domain] || 'category';
  }

  // ===============================================
  // MÉTHODES POUR LES TÂCHES
  // ===============================================

  getTaskIcon(task: string): string {
    const iconMap: { [key: string]: string } = {
      'Classification': 'category',
      'Régression': 'trending_up',
      'Clustering': 'scatter_plot',
      'Réduction de dimension': 'compress',
      'Détection d\'anomalies': 'warning',
      'Traitement du langage naturel': 'translate',
      'Vision par ordinateur': 'visibility'
    };
    return iconMap[task] || 'psychology';
  }

  // ===============================================
  // MÉTHODES POUR LES SLIDERS
  // ===============================================

  getInstancesMin(): number {
    return this.formGroup.get('instances_number_min')?.value || this.instancesRange.min;
  }

  getInstancesMax(): number {
    return this.formGroup.get('instances_number_max')?.value || this.instancesRange.max;
  }

  onInstancesMinChange(event: any): void {
    const value = parseInt(event.target.value);
    const maxValue = this.getInstancesMax();

    if (value <= maxValue) {
      this.formGroup.get('instances_number_min')?.setValue(value);
    }
  }

  onInstancesMaxChange(event: any): void {
    const value = parseInt(event.target.value);
    const minValue = this.getInstancesMin();

    if (value >= minValue) {
      this.formGroup.get('instances_number_max')?.setValue(value);
    }
  }
}
