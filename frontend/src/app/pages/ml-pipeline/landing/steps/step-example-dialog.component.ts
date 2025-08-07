import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-step-example-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, TranslateModule],
  template: `
  <div class="dialog">
    <div class="header">
      <mat-icon>{{ data.icon }}</mat-icon>
      <h3>{{ data.titleKey | translate }}</h3>
    </div>
    <p>{{ ('ML_PIPELINE.LANDING.EXAMPLES.STEP' + data.id) | translate }}</p>
    <div class="actions">
      <button mat-flat-button color="primary" mat-dialog-close>OK</button>
    </div>
  </div>
  `,
  styles: [`
  .dialog { max-width: 640px; }
  .header { display: flex; align-items: center; gap: 10px; }
  .header h3 { margin: 0; }
  .actions { margin-top: 12px; display: flex; justify-content: flex-end; }
  `]
})
export class StepExampleDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { id: number; titleKey: string; icon: string }) {}
}


