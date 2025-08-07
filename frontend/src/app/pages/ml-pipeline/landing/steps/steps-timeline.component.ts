import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { StepExampleDialogComponent } from './step-example-dialog.component';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';

interface StepCard {
  id: number;
  titleKey: string;
  icon: string;
  descKey: string;
}

@Component({
  selector: 'app-ml-steps-timeline',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatCardModule, MatButtonModule, TranslateModule],
  templateUrl: './steps-timeline.component.html',
  styleUrls: ['./steps-timeline.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class MlStepsTimelineComponent {
  steps: StepCard[] = [
    { id: 1, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP1_TITLE', icon: 'folder_open', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP1_DESC' },
    { id: 2, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP2_TITLE', icon: 'cleaning_services', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP2_DESC' },
    { id: 3, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP3_TITLE', icon: 'data_thresholding', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP3_DESC' },
    { id: 4, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP4_TITLE', icon: 'extension', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP4_DESC' },
    { id: 5, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP5_TITLE', icon: 'hub', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP5_DESC' },
    { id: 6, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP6_TITLE', icon: 'model_training', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP6_DESC' },
    { id: 7, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP7_TITLE', icon: 'insights', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP7_DESC' },
    { id: 8, titleKey: 'ML_PIPELINE.LANDING.STEPS.STEP8_TITLE', icon: 'emoji_objects', descKey: 'ML_PIPELINE.LANDING.STEPS.STEP8_DESC' }
  ];

  constructor(private dialog: MatDialog) {}

  openExample(step: StepCard): void {
    this.dialog.open(StepExampleDialogComponent, {
      maxWidth: '640px',
      data: {
        id: step.id,
        titleKey: step.titleKey,
        icon: step.icon
      }
    });
  }
}


