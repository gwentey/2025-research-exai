import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

export interface FilterChip {
  key: string;
  label: string;
  value: any;
  tooltip?: string;
  removable?: boolean;
}

/**
 * Composant pour afficher les filtres actifs sous forme de chips fermables
 * Permet une visualisation claire et une suppression rapide des filtres
 */
@Component({
  selector: 'app-filter-chip-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    TranslateModule
  ],
  templateUrl: './filter-chip-bar.component.html',
  styleUrls: ['./filter-chip-bar.component.scss']
})
export class FilterChipBarComponent {
  @Input() activeFilters: FilterChip[] = [];
  @Input() maxVisibleChips: number = 8;
  @Input() showClearAll: boolean = true;
  @Input() compact: boolean = false;

  @Output() removeFilter = new EventEmitter<string>();
  @Output() clearAll = new EventEmitter<void>();

  /**
   * Supprime un filtre spécifique
   */
  onRemoveFilter(filterKey: string): void {
    this.removeFilter.emit(filterKey);
  }

  /**
   * Supprime tous les filtres
   */
  onClearAll(): void {
    this.clearAll.emit();
  }

  /**
   * Obtient les chips visibles (limitées par maxVisibleChips)
   */
  get visibleChips(): FilterChip[] {
    return this.activeFilters.slice(0, this.maxVisibleChips);
  }

  /**
   * Obtient le nombre de chips cachées
   */
  get hiddenChipsCount(): number {
    return Math.max(0, this.activeFilters.length - this.maxVisibleChips);
  }

  /**
   * Vérifie s'il y a des chips cachées
   */
  get hasHiddenChips(): boolean {
    return this.hiddenChipsCount > 0;
  }

  /**
   * Génère une tooltip pour les chips cachées
   */
  get hiddenChipsTooltip(): string {
    if (!this.hasHiddenChips) return '';

    const hiddenChips = this.activeFilters.slice(this.maxVisibleChips);
    return hiddenChips.map(chip => chip.label).join(', ');
  }

  /**
   * Génère la couleur d'un chip basée sur son type
   */
  getChipColor(filterKey: string): 'primary' | 'accent' | 'warn' | undefined {
    // Couleurs basées sur le type de filtre
    if (filterKey.includes('text') || filterKey.includes('name') || filterKey.includes('objective')) {
      return 'primary';
    } else if (filterKey.includes('domain') || filterKey.includes('task')) {
      return 'accent';
    } else if (filterKey.includes('score') || filterKey.includes('quality')) {
      return 'warn';
    }
    return undefined;
  }

  /**
   * Génère l'icône d'un chip basée sur son type
   */
  getChipIcon(filterKey: string): string {
    const iconMap: { [key: string]: string } = {
      'dataset_name': 'label',
      'objective': 'description',
      'domain': 'domain',
      'task': 'psychology',
      'instances_number_min': 'storage',
      'instances_number_max': 'storage',
      'features_number_min': 'view_column',
      'features_number_max': 'view_column',
      'year_min': 'calendar_today',
      'year_max': 'calendar_today',
      'ethical_score_min': 'security',
      'representativity_level': 'analytics',
      'is_split': 'call_split',
      'is_anonymized': 'verified_user',
      'has_temporal_factors': 'schedule',
      'is_public': 'public'
    };

    return iconMap[filterKey] || 'filter_list';
  }

  /**
   * Track by function pour optimiser le rendu des chips
   */
  trackByChip(index: number, chip: FilterChip): string {
    return chip.key;
  }
}
