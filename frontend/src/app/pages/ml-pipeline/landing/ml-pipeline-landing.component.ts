import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

import { MlHeroSectionComponent } from './hero/hero-section.component';
import { MlStepsTimelineComponent } from './steps/steps-timeline.component';
import { MlFlowVisualComponent } from './flow/flow-visual.component';
import { MlFaqSectionComponent } from './faq/faq-section.component';

@Component({
  selector: 'app-ml-pipeline-landing',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatExpansionModule,
    TranslateModule,
    MlHeroSectionComponent,
    MlStepsTimelineComponent,
    MlFlowVisualComponent,
    MlFaqSectionComponent
  ],
  templateUrl: './ml-pipeline-landing.component.html',
  styleUrls: ['./ml-pipeline-landing.component.scss'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(24px)' }),
        animate('500ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerIn', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(80, [
            animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class MlPipelineLandingComponent {
  constructor(private router: Router) {}

  startWizard(): void {
    this.router.navigate(['/ml-pipeline-wizard']);
  }
}


