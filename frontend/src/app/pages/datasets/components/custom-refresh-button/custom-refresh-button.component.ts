import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-custom-refresh-button',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, TranslateModule],
  template: `
    <div class="custom-refresh-button">
      <button
        type="button"
        class="refresh-btn"
        [class.loading]="isLoading"
        [disabled]="isLoading"
        (click)="onClick()"
        [matTooltip]="tooltipText">

        <mat-icon
          class="refresh-icon"
          [class.spinning]="isLoading">
          refresh
        </mat-icon>
      </button>
    </div>
  `,
  styleUrls: ['./custom-refresh-button.component.scss']
})
export class CustomRefreshButtonComponent {
  @Input() tooltipText: string = 'Refresh';
  @Input() isLoading: boolean = false;
  @Output() click = new EventEmitter<void>();

  onClick(): void {
    if (!this.isLoading) {
      this.click.emit();
    }
  }
}
