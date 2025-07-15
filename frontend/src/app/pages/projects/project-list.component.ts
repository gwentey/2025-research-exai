import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';

import { ProjectService } from '../../services/project.service';
import { Project, ProjectListResponse } from '../../models/project.models';
import { PaginationParams } from '../../models/dataset.models';
import { ProjectCardComponent } from './components/project-card.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    ProjectCardComponent,
    TranslateModule
  ],
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private translateService = inject(TranslateService);
  private destroy$ = new Subject<void>();

  // Données
  projects: Project[] = [];
  totalProjects = 0;
  
  // État de chargement
  isLoading = false;
  error: string | null = null;

  // Recherche
  searchTerm = '';

  // Pagination
  currentPage = 0;
  pageSize = 12;

  ngOnInit(): void {
    this.loadProjects();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Recherche de projets par nom
   */
  onSearch(): void {
    this.currentPage = 0;
    this.loadProjects();
  }

  /**
   * Efface la recherche
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 0;
    this.loadProjects();
  }

  /**
   * Changement de page
   */
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadProjects();
  }

  /**
   * Actualisation des projets
   */
  refreshProjects(): void {
    this.loadProjects();
  }

  /**
   * Navigation vers la création d'un nouveau projet
   */
  createNewProject(): void {
    this.router.navigate(['/projects/new']);
  }

  /**
   * Visualisation d'un projet
   */
  onViewProject(project: Project): void {
    this.router.navigate(['/projects', project.id]);
  }

  /**
   * Modification d'un projet
   */
  onEditProject(project: Project): void {
    this.router.navigate(['/projects', project.id, 'edit']);
  }

  /**
   * Suppression d'un projet avec confirmation
   */
  onDeleteProject(project: Project): void {
    const confirmMessage = this.translateService.instant('PROJECTS.DELETE.CONFIRM_MESSAGE', { name: project.name });
    const confirmed = confirm(confirmMessage);
    
    if (confirmed) {
      this.projectService.deleteProject(project.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Recharger la liste après suppression
            this.loadProjects();
          },
          error: (error) => {
            console.error('Erreur lors de la suppression:', error);
            this.error = this.translateService.instant('PROJECTS.DELETE.ERROR');
          }
        });
    }
  }

  /**
   * Tracking function pour ngFor
   */
  trackByProject(index: number, project: Project): string {
    return project.id;
  }

  /**
   * Charge les projets depuis l'API
   */
  private loadProjects(): void {
    this.isLoading = true;
    this.error = null;

    // Paramètres de pagination
    const params: PaginationParams = {
      page: this.currentPage + 1, // API utilise 1-based indexing
      page_size: this.pageSize
    };

    this.projectService.getProjects(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ProjectListResponse) => {
          // Filtrage côté client pour la recherche simple
          if (this.searchTerm) {
            this.projects = response.projects.filter(project =>
              project.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
              (project.description && project.description.toLowerCase().includes(this.searchTerm.toLowerCase()))
            );
            this.totalProjects = this.projects.length;
          } else {
            this.projects = response.projects;
            this.totalProjects = response.total_count;
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des projets:', error);
          this.error = this.translateService.instant('PROJECTS.LIST.LOADING_ERROR');
          this.isLoading = false;
          this.projects = [];
          this.totalProjects = 0;
        }
      });
  }
} 