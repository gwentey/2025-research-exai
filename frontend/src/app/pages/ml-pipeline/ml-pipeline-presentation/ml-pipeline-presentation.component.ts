import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-ml-pipeline-presentation',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './ml-pipeline-presentation.component.html',
  styleUrls: ['./ml-pipeline-presentation.component.scss']
})
export class MlPipelinePresentationComponent implements OnInit, OnDestroy, AfterViewInit {

  private intervals: any[] = [];

    // Conversational AI interface state
  activeStep = -1;
  completedSteps: number[] = [];
  isPlaying = false;
  codeProgress = 0;
  showOutput = false;

  // Training animation
  trainingProgress = 0;
  progressOffset = 283; // 2πr for circle

  // Metrics
  selectedDataset = '';
  finalAccuracy = 94;
  trainingTime = 45;

  // Stats animation
  statsAnimated = false;

  constructor(
    private router: Router,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // Initialize component
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.statsAnimated = true;
    }, 1000);
  }

  ngOnDestroy(): void {
    this.intervals.forEach(interval => clearInterval(interval));
  }

    // Conversational AI animation methods
  triggerStep(stepIndex: number): void {
    this.activeStep = stepIndex;
    if (!this.completedSteps.includes(stepIndex)) {
      this.completedSteps.push(stepIndex);
    }

    // Start training animation on algorithm step
    if (stepIndex === 3) {
      this.startTrainingAnimation();
    }

    // Show final insights after training
    if (stepIndex === 3) {
      setTimeout(() => {
        this.showOutput = true;
      }, 3000);
    }
  }

  playConversation(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.activeStep = -1;
    this.completedSteps = [];
    this.showOutput = false;
    this.codeProgress = 0;
    this.trainingProgress = 0;

    let step = 0;
    const animateStep = () => {
      if (step <= 3) {
        this.triggerStep(step);
        this.codeProgress = ((step + 1) / 4) * 100;
        step++;

        setTimeout(animateStep, 2500);
      } else {
        this.isPlaying = false;
      }
    };

    animateStep();
  }

  startTrainingAnimation(): void {
    const duration = 2500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      this.trainingProgress = Math.floor(progress * 100);
      this.progressOffset = 283 - (283 * progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  resetCodeAnimation(): void {
    this.activeStep = -1;
    this.completedSteps = [];
    this.showOutput = false;
    this.codeProgress = 0;
    this.trainingProgress = 0;
    this.progressOffset = 283;
    this.isPlaying = false;
  }

  // Feature hover effects
  onFeatureHover(index: number): void {
    // Subtle hover animation
  }

  onFeatureLeave(index: number): void {
    // Reset hover state
  }

  // Navigation methods
  startNewExperiment(): void {
    this.router.navigate(['/datasets']);
  }

  openWizard(): void {
    this.router.navigate(['/ml-pipeline/wizard']);
  }

  viewExamples(): void {
    this.router.navigate(['/ml-pipeline/experiments']);
  }
}
