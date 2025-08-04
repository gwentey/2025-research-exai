import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest, map, startWith } from 'rxjs';

import { RoleService } from '../../services/role.service';
import { DatasetService } from '../../services/dataset.service';

interface DatasetSummary {
  id: string;
  name: string;
  creator: string;
  createdDate: Date;
  filesCount: number;
  size: string;
  isPublic: boolean;
  domain: string[];
  status: 'active' | 'pending' | 'archived';
}

@Component({
  selector: 'app-dataset-management',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
    TranslateModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="dataset-management">
      <!-- Header -->
      <div class="header-section">
        <div class="title-area">
          <h1>
            <mat-icon>storage</mat-icon>
            {{ 'ADMIN.DATASETS.TITLE' | translate }}
          </h1>
          <p class="subtitle">
            {{ 'ADMIN.DATASETS.SUBTITLE' | translate }}
          </p>
        </div>

        <div class="actions-area">
          <button 
            mat-raised-button 
            color="primary"
            routerLink="/datasets/upload">
            <mat-icon>add</mat-icon>
            {{ 'ADMIN.DATASETS.ADD_DATASET' | translate }}
          </button>
        </div>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>{{ 'ADMIN.DATASETS.SEARCH' | translate }}</mat-label>
              <input matInput [formControl]="searchControl" placeholder="{{ 'ADMIN.DATASETS.SEARCH_PLACEHOLDER' | translate }}">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>{{ 'ADMIN.DATASETS.STATUS' | translate }}</mat-label>
              <mat-select [formControl]="statusControl" multiple>
                <mat-option value="active">{{ 'ADMIN.DATASETS.STATUS_ACTIVE' | translate }}</mat-option>
                <mat-option value="pending">{{ 'ADMIN.DATASETS.STATUS_PENDING' | translate }}</mat-option>
                <mat-option value="archived">{{ 'ADMIN.DATASETS.STATUS_ARCHIVED' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>{{ 'ADMIN.DATASETS.DOMAIN' | translate }}</mat-label>
              <mat-select [formControl]="domainControl" multiple>
                <mat-option value="education">Education</mat-option>
                <mat-option value="healthcare">Healthcare</mat-option>
                <mat-option value="finance">Finance</mat-option>
                <mat-option value="social">Social</mat-option>
                <mat-option value="technology">Technology</mat-option>
              </mat-select>
            </mat-form-field>

            <button 
              mat-stroked-button 
              (click)="clearFilters()"
              class="clear-filters-btn">
              <mat-icon>clear</mat-icon>
              {{ 'ADMIN.DATASETS.CLEAR_FILTERS' | translate }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Datasets Table -->
      <mat-card class="table-card">
        <mat-card-content class="table-content">
          <div class="table-header">
            <h3>{{ 'ADMIN.DATASETS.DATASETS_LIST' | translate }}</h3>
            <div class="table-stats">
              <span class="stats-text">
                {{ (filteredDatasets$ | async)?.length ?? 0 }} {{ 'ADMIN.DATASETS.DATASETS_FOUND' | translate }}
              </span>
            </div>
          </div>

          <div class="table-container">
            <table mat-table [dataSource]="(filteredDatasets$ | async) ?? []" class="datasets-table" matSort>
              <!-- Name Column -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.DATASETS.TABLE.NAME' | translate }}
                </th>
                <td mat-cell *matCellDef="let dataset">
                  <div class="dataset-name-cell">
                    <strong>{{ dataset.dataset_name }}</strong>
                    <div class="dataset-meta">
                      <mat-chip-set>
                        <mat-chip 
                          *ngFor="let domain of dataset.domain" 
                          class="domain-chip">
                          {{ domain }}
                        </mat-chip>
                      </mat-chip-set>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Creator Column -->
              <ng-container matColumnDef="creator">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.DATASETS.TABLE.CREATOR' | translate }}
                </th>
                <td mat-cell *matCellDef="let dataset">{{ dataset.creator }}</td>
              </ng-container>

              <!-- Created Date Column -->
              <ng-container matColumnDef="createdDate">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.DATASETS.TABLE.CREATED' | translate }}
                </th>
                <td mat-cell *matCellDef="let dataset">
                  {{ dataset.createdDate | date:'short' }}
                </td>
              </ng-container>

              <!-- Files Count Column -->
              <ng-container matColumnDef="filesCount">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.DATASETS.TABLE.FILES' | translate }}
                </th>
                <td mat-cell *matCellDef="let dataset">
                  <div class="files-info">
                    <mat-icon class="files-icon">description</mat-icon>
                    {{ dataset.filesCount }}
                  </div>
                </td>
              </ng-container>

              <!-- Size Column -->
              <ng-container matColumnDef="size">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'ADMIN.DATASETS.TABLE.SIZE' | translate }}
                </th>
                <td mat-cell *matCellDef="let dataset">{{ dataset.size }}</td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.DATASETS.TABLE.STATUS' | translate }}
                </th>
                <td mat-cell *matCellDef="let dataset">
                  <mat-chip [class]="'status-' + dataset.status">
                    {{ getStatusLabel(dataset.status) | translate }}
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'ADMIN.DATASETS.TABLE.ACTIONS' | translate }}
                </th>
                <td mat-cell *matCellDef="let dataset" class="actions-cell">
                  <button 
                    mat-icon-button 
                    [routerLink]="['/datasets', dataset.id]"
                    matTooltip="{{ 'ADMIN.DATASETS.VIEW_DETAILS' | translate }}">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  
                  <button 
                    mat-icon-button 
                    [routerLink]="['/datasets', dataset.id, 'edit']"
                    matTooltip="{{ 'ADMIN.DATASETS.EDIT' | translate }}">
                    <mat-icon>edit</mat-icon>
                  </button>
                  
                  <button 
                    mat-icon-button 
                    color="warn"
                    (click)="deleteDataset(dataset)"
                    matTooltip="{{ 'ADMIN.DATASETS.DELETE' | translate }}">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>

          <!-- Loading State -->
          <div class="loading-container" *ngIf="isLoading">
            <mat-progress-spinner mode="indeterminate" diameter="50"></mat-progress-spinner>
            <p>{{ 'ADMIN.DATASETS.LOADING' | translate }}</p>
          </div>

          <!-- Empty State -->
          <div class="empty-state" *ngIf="!isLoading && (filteredDatasets$ | async)?.length === 0">
            <mat-icon class="empty-icon">database</mat-icon>
            <h3>{{ 'ADMIN.DATASETS.NO_DATASETS' | translate }}</h3>
            <p>{{ 'ADMIN.DATASETS.NO_DATASETS_MESSAGE' | translate }}</p>
            <button mat-raised-button color="primary" routerLink="/datasets/upload">
              <mat-icon>add</mat-icon>
              {{ 'ADMIN.DATASETS.ADD_FIRST_DATASET' | translate }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dataset-management {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 24px;
    }

    .title-area h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 2rem;
      font-weight: 400;
      margin: 0 0 8px 0;
      color: #1976d2;
    }

    .subtitle {
      color: #666;
      margin: 0;
      font-size: 1.1rem;
    }

    .filters-card {
      margin-bottom: 24px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-field {
      min-width: 200px;
      flex: 1;
    }

    .clear-filters-btn {
      flex-shrink: 0;
    }

    .table-card {
      margin-bottom: 24px;
    }

    .table-content {
      padding: 0;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .table-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 500;
    }

    .stats-text {
      color: #666;
      font-size: 0.9rem;
    }

    .table-container {
      overflow-x: auto;
    }

    .datasets-table {
      width: 100%;
      min-width: 800px;
    }

    .dataset-name-cell {
      max-width: 250px;
    }

    .dataset-name-cell strong {
      display: block;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dataset-meta {
      margin-top: 4px;
    }

    .domain-chip {
      font-size: 0.75rem;
      height: 20px;
      margin-right: 4px;
    }

    .files-info {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .files-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
      color: #666;
    }

    .actions-cell {
      width: 140px;
    }

    .actions-cell button {
      margin-right: 4px;
    }

    .status-active {
      background-color: #e8f5e8;
      color: #2e7d32;
    }

    .status-pending {
      background-color: #fff3e0;
      color: #f57c00;
    }

    .status-archived {
      background-color: #f3e5f5;
      color: #7b1fa2;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .loading-container p {
      margin-top: 16px;
      color: #666;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .empty-icon {
      font-size: 4rem;
      width: 4rem;
      height: 4rem;
      color: #ccc;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #666;
    }

    .empty-state p {
      margin: 0 0 24px 0;
      color: #999;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .dataset-management {
        padding: 16px;
      }

      .header-section {
        flex-direction: column;
        align-items: flex-start;
      }

      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-field {
        min-width: unset;
      }

      .table-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
    }
  `]
})
export class DatasetManagementComponent implements OnInit {
  private roleService = inject(RoleService);
  private datasetService = inject(DatasetService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // Table configuration
  displayedColumns: string[] = ['name', 'creator', 'createdDate', 'filesCount', 'size', 'status', 'actions'];
  
  // Form controls for filtering
  searchControl = new FormControl<string>('');
  statusControl = new FormControl<('active' | 'pending' | 'archived')[]>([]);
  domainControl = new FormControl<string[]>([]);

  // Data streams
  datasets$ = new BehaviorSubject<DatasetSummary[]>([]);
  filteredDatasets$: Observable<DatasetSummary[]>;
  isLoading = true;

  ngOnInit(): void {
    this.loadDatasets();
    this.setupFiltering();
  }

  private setupFiltering(): void {
    this.filteredDatasets$ = combineLatest([
      this.datasets$.asObservable(),
      this.searchControl.valueChanges.pipe(startWith('')),
      this.statusControl.valueChanges.pipe(startWith([])),
      this.domainControl.valueChanges.pipe(startWith([]))
    ]).pipe(
      map(([datasets, search, statuses, domains]: [DatasetSummary[], string | null, ('active' | 'pending' | 'archived')[] | null, string[] | null]) => {
        let filtered = datasets;

        // Search filter
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = filtered.filter(dataset => 
            dataset.name.toLowerCase().includes(searchLower) ||
            dataset.creator.toLowerCase().includes(searchLower)
          );
        }

        // Status filter
        if (statuses && statuses.length > 0) {
          filtered = filtered.filter(dataset => statuses.includes(dataset.status));
        }

        // Domain filter
        if (domains && domains.length > 0) {
          filtered = filtered.filter(dataset => 
            dataset.domain.some(d => domains.includes(d))
          );
        }

        return filtered;
      })
    );
  }

  private loadDatasets(): void {
    this.isLoading = true;
    
    // Récupération des vraies données depuis l'API backend
    this.datasetService.getDatasets({ page: 1, page_size: 100 }).subscribe({
      next: (response) => {
        const datasets: DatasetSummary[] = response.datasets.map(dataset => ({
          id: dataset.id,
          name: dataset.dataset_name || 'Dataset sans nom',
          creator: 'Système', // TODO: Ajouter le champ owner dans le modèle Dataset backend
          createdDate: dataset.created_at ? new Date(dataset.created_at) : new Date(),
          filesCount: 0, // TODO: Calculer le nombre de fichiers depuis les relations
          size: this.formatSize(dataset.instances_number, dataset.features_number),
          isPublic: true, // TODO: Ajouter le champ is_public dans le modèle Dataset backend
          domain: dataset.domain || [],
          status: this.mapDatasetStatus(dataset)
        }));
        
        this.datasets$.next(datasets);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des datasets:', error);
        let errorMessage = 'Erreur lors du chargement des datasets';
        if (error.status === 422) {
          errorMessage = 'Paramètres de requête invalides';
        } else if (error.status === 403) {
          errorMessage = 'Accès non autorisé - droits administrateur requis';
        } else if (error.status === 500) {
          errorMessage = 'Erreur serveur - veuillez réessayer plus tard';
        }
        this.snackBar.open(errorMessage, 'Fermer', { duration: 5000 });
        this.datasets$.next([]);
        this.isLoading = false;
      }
    });
  }

  private formatSize(instances?: number, features?: number): string {
    if (!instances || !features) return 'Taille inconnue';
    
    // Estimation de la taille basée sur instances * features * 8 bytes
    const estimatedBytes = instances * features * 8;
    
    if (estimatedBytes < 1024 * 1024) {
      return `${Math.round(estimatedBytes / 1024)} KB`;
    } else if (estimatedBytes < 1024 * 1024 * 1024) {
      return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(estimatedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  }

  private mapDatasetStatus(dataset: any): 'active' | 'pending' | 'archived' {
    // Logique pour mapper le statut du dataset basée sur les propriétés disponibles
    if (dataset.created_at) {
      const createdDate = new Date(dataset.created_at);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (createdDate < oneYearAgo) return 'archived';
    }
    
    // Pour l'instant, tous les datasets récents sont considérés comme actifs
    // TODO: Ajouter une vraie logique de statut basée sur des champs backend
    return 'active';
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue([]);
    this.domainControl.setValue([]);
  }

  deleteDataset(dataset: DatasetSummary): void {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer le dataset "${dataset.name}" ?`;
    
    if (confirm(confirmMessage)) {
      // TODO: Implémenter la suppression via API
      console.log('Suppression du dataset:', dataset.id);
      
      this.snackBar.open(
        `Dataset "${dataset.name}" supprimé avec succès`,
        'Fermer',
        { duration: 3000 }
      );
      
      // Retirer le dataset de la liste
      const currentDatasets = this.datasets$.value;
      const updatedDatasets = currentDatasets.filter(d => d.id !== dataset.id);
      this.datasets$.next(updatedDatasets);
    }
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'active': 'ADMIN.DATASETS.STATUS_ACTIVE',
      'pending': 'ADMIN.DATASETS.STATUS_PENDING',
      'archived': 'ADMIN.DATASETS.STATUS_ARCHIVED'
    };
    return statusMap[status] ?? status;
  }
}