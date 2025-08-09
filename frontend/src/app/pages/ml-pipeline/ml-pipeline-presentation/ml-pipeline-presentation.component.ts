import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, state, style, transition, animate, stagger, query } from '@angular/animations';

interface PipelineStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
  details: string[];
  example?: string;
}

interface FAQItem {
  question: string;
  answer: string;
  expanded?: boolean;
}

@Component({
  selector: 'app-ml-pipeline-presentation',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatChipsModule,
    TranslateModule
  ],
  templateUrl: './ml-pipeline-presentation.component.html',
  styleUrls: ['./ml-pipeline-presentation.component.scss'],
  animations: [
    trigger('fadeInUp', [
      state('in', style({ opacity: 1, transform: 'translateY(0)' })),
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('600ms ease-out')
      ])
    ]),
    trigger('staggerList', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger(100, [
            animate('500ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-100%)' }),
        animate('700ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
    trigger('pulse', [
      state('active', style({ transform: 'scale(1.05)' })),
      transition('* <=> active', [
        animate('1000ms ease-in-out')
      ])
    ])
  ]
})
export class MlPipelinePresentationComponent implements OnInit {

  pipelineSteps: PipelineStep[] = [
    {
      id: 1,
      title: 'ML_PIPELINE.STEPS.STEP1.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP1.DESCRIPTION',
      icon: 'storage',
      color: 'primary',
      details: [
        'ML_PIPELINE.STEPS.STEP1.DETAIL1',
        'ML_PIPELINE.STEPS.STEP1.DETAIL2',
        'ML_PIPELINE.STEPS.STEP1.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP1.EXAMPLE'
    },
    {
      id: 2,
      title: 'ML_PIPELINE.STEPS.STEP2.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP2.DESCRIPTION',
      icon: 'cleaning_services',
      color: 'accent',
      details: [
        'ML_PIPELINE.STEPS.STEP2.DETAIL1',
        'ML_PIPELINE.STEPS.STEP2.DETAIL2',
        'ML_PIPELINE.STEPS.STEP2.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP2.EXAMPLE'
    },
    {
      id: 3,
      title: 'ML_PIPELINE.STEPS.STEP3.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP3.DESCRIPTION',
      icon: 'analytics',
      color: 'warn',
      details: [
        'ML_PIPELINE.STEPS.STEP3.DETAIL1',
        'ML_PIPELINE.STEPS.STEP3.DETAIL2',
        'ML_PIPELINE.STEPS.STEP3.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP3.EXAMPLE'
    },
    {
      id: 4,
      title: 'ML_PIPELINE.STEPS.STEP4.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP4.DESCRIPTION',
      icon: 'smart_toy',
      color: 'primary',
      details: [
        'ML_PIPELINE.STEPS.STEP4.DETAIL1',
        'ML_PIPELINE.STEPS.STEP4.DETAIL2',
        'ML_PIPELINE.STEPS.STEP4.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP4.EXAMPLE'
    },
    {
      id: 5,
      title: 'ML_PIPELINE.STEPS.STEP5.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP5.DESCRIPTION',
      icon: 'tune',
      color: 'accent',
      details: [
        'ML_PIPELINE.STEPS.STEP5.DETAIL1',
        'ML_PIPELINE.STEPS.STEP5.DETAIL2',
        'ML_PIPELINE.STEPS.STEP5.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP5.EXAMPLE'
    },
    {
      id: 6,
      title: 'ML_PIPELINE.STEPS.STEP6.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP6.DESCRIPTION',
      icon: 'model_training',
      color: 'warn',
      details: [
        'ML_PIPELINE.STEPS.STEP6.DETAIL1',
        'ML_PIPELINE.STEPS.STEP6.DETAIL2',
        'ML_PIPELINE.STEPS.STEP6.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP6.EXAMPLE'
    },
    {
      id: 7,
      title: 'ML_PIPELINE.STEPS.STEP7.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP7.DESCRIPTION',
      icon: 'assessment',
      color: 'primary',
      details: [
        'ML_PIPELINE.STEPS.STEP7.DETAIL1',
        'ML_PIPELINE.STEPS.STEP7.DETAIL2',
        'ML_PIPELINE.STEPS.STEP7.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP7.EXAMPLE'
    },
    {
      id: 8,
      title: 'ML_PIPELINE.STEPS.STEP8.TITLE',
      description: 'ML_PIPELINE.STEPS.STEP8.DESCRIPTION',
      icon: 'psychology',
      color: 'accent',
      details: [
        'ML_PIPELINE.STEPS.STEP8.DETAIL1',
        'ML_PIPELINE.STEPS.STEP8.DETAIL2',
        'ML_PIPELINE.STEPS.STEP8.DETAIL3'
      ],
      example: 'ML_PIPELINE.STEPS.STEP8.EXAMPLE'
    }
  ];

  faqItems: FAQItem[] = [
    {
      question: 'ML_PIPELINE.FAQ.Q1.QUESTION',
      answer: 'ML_PIPELINE.FAQ.Q1.ANSWER',
      expanded: false
    },
    {
      question: 'ML_PIPELINE.FAQ.Q2.QUESTION',
      answer: 'ML_PIPELINE.FAQ.Q2.ANSWER',
      expanded: false
    },
    {
      question: 'ML_PIPELINE.FAQ.Q3.QUESTION',
      answer: 'ML_PIPELINE.FAQ.Q3.ANSWER',
      expanded: false
    },
    {
      question: 'ML_PIPELINE.FAQ.Q4.QUESTION',
      answer: 'ML_PIPELINE.FAQ.Q4.ANSWER',
      expanded: false
    },
    {
      question: 'ML_PIPELINE.FAQ.Q5.QUESTION',
      answer: 'ML_PIPELINE.FAQ.Q5.ANSWER',
      expanded: false
    }
  ];

  // Variables pour l'animation du pipeline
  currentFlowStep = 0;
  maxFlowSteps = 8;
  flowProgress = 0;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.startPipelineAnimation();
  }

  startPipelineAnimation(): void {
    setInterval(() => {
      this.currentFlowStep = (this.currentFlowStep + 1) % this.maxFlowSteps;
      this.flowProgress = ((this.currentFlowStep + 1) / this.maxFlowSteps) * 100;
    }, 1500);
  }

  startNewExperiment(): void {
    this.router.navigate(['/datasets']);
  }

  openWizard(): void {
    this.router.navigate(['/ml-pipeline/wizard']);
  }

  viewExamples(): void {
    this.router.navigate(['/ml-pipeline/experiments']);
  }

  toggleFAQ(index: number): void {
    this.faqItems[index].expanded = !this.faqItems[index].expanded;
  }

  getStepClasses(step: PipelineStep): string {
    const baseClasses = 'step-item';
    const isActive = step.id === this.currentFlowStep + 1;
    return `${baseClasses} ${isActive ? 'active' : ''}`;
  }
}
