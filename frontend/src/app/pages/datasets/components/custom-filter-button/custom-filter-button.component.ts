import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-custom-filter-button',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  template: `
    <div class="custom-filter-button">
      <button
        type="button"
        class="filter-btn"
        [class.has-filters]="hasActiveFilters"
        (click)="onClick()">

        <div class="btn-content">
          <mat-icon class="btn-icon">tune</mat-icon>
          <span class="btn-text">{{ buttonText }}</span>
        </div>

        <span
          *ngIf="hasActiveFilters && filterCount > 0"
          class="filters-badge">
          {{ filterCount }}
        </span>
      </button>
    </div>
  `,
  styleUrls: ['./custom-filter-button.component.scss']
})
export class CustomFilterButtonComponent {
  @Input() buttonText: string = 'Filter';
  @Input() hasActiveFilters: boolean = false;
  @Input() filterCount: number = 0;
  @Output() click = new EventEmitter<void>();

  onClick(): void {
    this.click.emit();
  }
}
