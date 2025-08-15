import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

export type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-custom-view-toggle',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, TranslateModule],
  template: `
    <div class="custom-view-toggle">
      <button
        type="button"
        class="view-button"
        [class.active]="value === 'grid'"
        (click)="onButtonClick('grid')"
        [matTooltip]="'DATASETS.LISTING.GRID_VIEW' | translate">
        <mat-icon>grid_view</mat-icon>
      </button>
      <button
        type="button"
        class="view-button"
        [class.active]="value === 'list'"
        (click)="onButtonClick('list')"
        [matTooltip]="'DATASETS.LISTING.LIST_VIEW' | translate">
        <mat-icon>view_list</mat-icon>
      </button>
    </div>
  `,
  styleUrls: ['./custom-view-toggle.component.scss']
})
export class CustomViewToggleComponent {
  @Input() value: ViewMode = 'grid';
  @Output() valueChange = new EventEmitter<ViewMode>();

  onButtonClick(mode: ViewMode): void {
    if (this.value !== mode) {
      this.value = mode;
      this.valueChange.emit(mode);
    }
  }
}
