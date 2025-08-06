import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

import { DatasetUploadService, DatasetMetadata, DatasetSuggestions } from '../../../../services/dataset-upload.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-metadata-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSliderModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatExpansionModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTabsModule,
    TranslateModule
  ],
  template: `
    <div class="metadata-form-container">
      <!-- Header -->
      <div class="form-header">
        <h2>{{ 'METADATA_FORM.TITLE' | translate }}</h2>
        <p class="subtitle">{{ 'METADATA_FORM.SUBTITLE' | translate }}</p>
      </div>

      <!-- Auto-Save Indicator -->
      <div *ngIf="isAutoSaving" class="auto-save-indicator">
        <mat-icon>cloud_upload</mat-icon>
        <span>{{ 'METADATA_FORM.AUTO_SAVING' | translate }}</span>
      </div>

      <!-- Form Progress -->
      <div class="form-progress">
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="getCompletionPercentage()"></div>
        </div>
        <span class="progress-text">
          {{ getCompletionPercentage() }}% {{ 'METADATA_FORM.COMPLETED' | translate }}
        </span>
      </div>

      <form [formGroup]="metadataForm" class="metadata-form">
        <mat-tab-group animationDuration="0ms" class="form-tabs">
          
          <!-- Informations Générales -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>info</mat-icon>
              {{ 'METADATA_FORM.TABS.GENERAL' | translate }}
            </ng-template>
            
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ 'METADATA_FORM.GENERAL.TITLE' | translate }}</mat-card-title>
                  <mat-card-subtitle>{{ 'METADATA_FORM.GENERAL.SUBTITLE' | translate }}</mat-card-subtitle>
                </mat-card-header>
                
                <mat-card-content>
                  <!-- Nom du dataset -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.GENERAL.DATASET_NAME' | translate }} *</mat-label>
                    <input matInput formControlName="dataset_name" 
                           placeholder="{{ 'METADATA_FORM.GENERAL.DATASET_NAME_PLACEHOLDER' | translate }}">
                    <mat-icon matSuffix matTooltip="{{ 'METADATA_FORM.TOOLTIPS.DATASET_NAME' | translate }}">help</mat-icon>
                    <mat-error *ngIf="metadataForm.get('dataset_name')?.hasError('required')">
                      {{ 'METADATA_FORM.ERRORS.REQUIRED' | translate }}
                    </mat-error>
                  </mat-form-field>

                  <!-- Bouton de synchronisation des noms -->
                  <div class="name-sync-container">
                    <button 
                      type="button"
                      mat-icon-button 
                      [class.synced]="isDisplayNameSynced"
                      [class.unsynced]="!isDisplayNameSynced"
                      (click)="toggleDisplayNameSync()"
                      [matTooltip]="isDisplayNameSynced ? 'Nom d\\'affichage synchronisé avec le nom du dataset - Cliquer pour les séparer' : 'Noms séparés - Cliquer pour synchroniser le nom d\\'affichage avec le nom du dataset'"
                      class="sync-toggle-btn">
                      <mat-icon>{{ isDisplayNameSynced ? 'sync' : 'sync_disabled' }}</mat-icon>
                    </button>
                    <span class="sync-label">
                      {{ isDisplayNameSynced ? 'Nom d\\'affichage synchronisé avec le nom du dataset' : 'Noms séparés' }}
                    </span>
                  </div>

                  <!-- Nom d'affichage -->
                  <mat-form-field appearance="outline" class="full-width display-name-field" [class.synced]="isDisplayNameSynced">
                    <mat-label>{{ 'METADATA_FORM.GENERAL.DISPLAY_NAME' | translate }}</mat-label>
                    <input matInput formControlName="display_name" 
                           [readonly]="isDisplayNameSynced"
                           [class.readonly-input]="isDisplayNameSynced"
                           placeholder="{{ 'METADATA_FORM.GENERAL.DISPLAY_NAME_PLACEHOLDER' | translate }}">
                    <mat-icon matSuffix matTooltip="{{ 'METADATA_FORM.TOOLTIPS.DISPLAY_NAME' | translate }}">help</mat-icon>
                  </mat-form-field>

                  <!-- Année -->
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.GENERAL.YEAR' | translate }}</mat-label>
                    <input matInput type="number" formControlName="year" 
                           [min]="1900" [max]="currentYear"
                           placeholder="{{ currentYear }}">
                    <mat-icon matSuffix matTooltip="{{ 'METADATA_FORM.TOOLTIPS.YEAR' | translate }}">help</mat-icon>
                  </mat-form-field>

                  <!-- Objectif -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.GENERAL.OBJECTIVE' | translate }}</mat-label>
                    <textarea matInput formControlName="objective" rows="3"
                              placeholder="{{ 'METADATA_FORM.GENERAL.OBJECTIVE_PLACEHOLDER' | translate }}"></textarea>
                    <mat-icon matSuffix matTooltip="{{ 'METADATA_FORM.TOOLTIPS.OBJECTIVE' | translate }}">help</mat-icon>
                  </mat-form-field>

                  <!-- Domaines -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.GENERAL.DOMAINS' | translate }}</mat-label>
                    <mat-select formControlName="domain" multiple>
                      <mat-option *ngFor="let domain of availableDomains" [value]="domain.value">
                        {{ domain.label | translate }}
                      </mat-option>
                    </mat-select>
                    <mat-icon matSuffix matTooltip="{{ 'METADATA_FORM.TOOLTIPS.DOMAINS' | translate }}">help</mat-icon>
                  </mat-form-field>

                  <!-- Tâches ML -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.GENERAL.ML_TASKS' | translate }}</mat-label>
                    <mat-select formControlName="task" multiple>
                      <mat-option *ngFor="let task of availableTasks" [value]="task.value">
                        {{ task.label | translate }}
                      </mat-option>
                    </mat-select>
                    <mat-icon matSuffix matTooltip="{{ 'METADATA_FORM.TOOLTIPS.ML_TASKS' | translate }}">help</mat-icon>
                  </mat-form-field>
                </mat-card-content>
              </mat-card>

              <!-- Suggestions automatiques -->
              <mat-card *ngIf="suggestions" class="suggestions-card">
                <mat-card-header>
                  <mat-card-title>
                    <mat-icon>lightbulb</mat-icon>
                    {{ 'METADATA_FORM.SUGGESTIONS.TITLE' | translate }}
                  </mat-card-title>
                </mat-card-header>
                
                <mat-card-content>
                  <div class="suggestion-item">
                    <button mat-stroked-button 
                            (click)="applySuggestion('dataset_name', suggestions.suggested_dataset_name)"
                            class="apply-suggestion">
                      <mat-icon>auto_fix_high</mat-icon>
                      {{ 'METADATA_FORM.SUGGESTIONS.APPLY_NAME' | translate }}: "{{ suggestions.suggested_dataset_name }}"
                    </button>
                  </div>
                  
                  <div class="suggestion-item" *ngIf="suggestions.suggested_domains.length > 0">
                    <button mat-stroked-button 
                            (click)="applySuggestion('domain', suggestions.suggested_domains)"
                            class="apply-suggestion">
                      <mat-icon>auto_fix_high</mat-icon>
                      {{ 'METADATA_FORM.SUGGESTIONS.APPLY_DOMAINS' | translate }}: {{ suggestions.suggested_domains.join(', ') }}
                    </button>
                  </div>
                  
                  <div class="suggestion-item" *ngIf="suggestions.suggested_tasks.length > 0">
                    <button mat-stroked-button 
                            (click)="applySuggestion('task', suggestions.suggested_tasks)"
                            class="apply-suggestion">
                      <mat-icon>auto_fix_high</mat-icon>
                      {{ 'METADATA_FORM.SUGGESTIONS.APPLY_TASKS' | translate }}: {{ suggestions.suggested_tasks.join(', ') }}
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Données techniques -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>settings</mat-icon>
              {{ 'METADATA_FORM.TABS.TECHNICAL' | translate }}
            </ng-template>
            
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ 'METADATA_FORM.TECHNICAL.TITLE' | translate }}</mat-card-title>
                  <mat-card-subtitle>{{ 'METADATA_FORM.TECHNICAL.SUBTITLE' | translate }}</mat-card-subtitle>
                </mat-card-header>
                
                <mat-card-content>
                  <!-- Accès -->
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.ACCESS' | translate }}</mat-label>
                    <mat-select formControlName="access">
                      <mat-option value="public">{{ 'METADATA_FORM.TECHNICAL.ACCESS_PUBLIC' | translate }}</mat-option>
                      <mat-option value="private">{{ 'METADATA_FORM.TECHNICAL.ACCESS_PRIVATE' | translate }}</mat-option>
                      <mat-option value="restricted">{{ 'METADATA_FORM.TECHNICAL.ACCESS_RESTRICTED' | translate }}</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <!-- Disponibilité -->
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.AVAILABILITY' | translate }}</mat-label>
                    <mat-select formControlName="availability">
                      <mat-option value="online">{{ 'METADATA_FORM.TECHNICAL.AVAILABILITY_ONLINE' | translate }}</mat-option>
                      <mat-option value="offline">{{ 'METADATA_FORM.TECHNICAL.AVAILABILITY_OFFLINE' | translate }}</mat-option>
                      <mat-option value="on_request">{{ 'METADATA_FORM.TECHNICAL.AVAILABILITY_REQUEST' | translate }}</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <!-- Nombre d'instances (auto-détecté) -->
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.INSTANCES_NUMBER' | translate }}</mat-label>
                    <input matInput type="number" formControlName="instances_number" readonly>
                    <mat-hint>{{ 'METADATA_FORM.TECHNICAL.AUTO_DETECTED' | translate }}</mat-hint>
                  </mat-form-field>

                  <!-- Nombre de features (auto-détecté) -->
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.FEATURES_NUMBER' | translate }}</mat-label>
                    <input matInput type="number" formControlName="features_number" readonly>
                    <mat-hint>{{ 'METADATA_FORM.TECHNICAL.AUTO_DETECTED' | translate }}</mat-hint>
                  </mat-form-field>

                  <!-- Description des features -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.FEATURES_DESCRIPTION' | translate }}</mat-label>
                    <textarea matInput formControlName="features_description" rows="3"
                              placeholder="{{ 'METADATA_FORM.TECHNICAL.FEATURES_DESCRIPTION_PLACEHOLDER' | translate }}"></textarea>
                  </mat-form-field>

                  <!-- Sources -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.SOURCES' | translate }}</mat-label>
                    <textarea matInput formControlName="sources" rows="2"
                              placeholder="{{ 'METADATA_FORM.TECHNICAL.SOURCES_PLACEHOLDER' | translate }}"></textarea>
                  </mat-form-field>

                  <!-- Nombre de citations -->
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.NUM_CITATIONS' | translate }}</mat-label>
                    <input matInput type="number" formControlName="num_citations" min="0">
                  </mat-form-field>

                  <!-- Lien de citation -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.TECHNICAL.CITATION_LINK' | translate }}</mat-label>
                    <input matInput formControlName="citation_link" type="url"
                           placeholder="https://...">
                  </mat-form-field>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Qualité des données -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>verified</mat-icon>
              {{ 'METADATA_FORM.TABS.QUALITY' | translate }}
            </ng-template>
            
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ 'METADATA_FORM.QUALITY.TITLE' | translate }}</mat-card-title>
                  <mat-card-subtitle>{{ 'METADATA_FORM.QUALITY.SUBTITLE' | translate }}</mat-card-subtitle>
                </mat-card-header>
                
                <mat-card-content>
                  <!-- Dataset splittée -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="split">
                      {{ 'METADATA_FORM.QUALITY.IS_SPLIT' | translate }}
                    </mat-checkbox>
                    <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.SPLIT' | translate }}">help</mat-icon>
                  </div>

                  <!-- Valeurs manquantes -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="has_missing_values">
                      {{ 'METADATA_FORM.QUALITY.HAS_MISSING_VALUES' | translate }}
                    </mat-checkbox>
                  </div>

                  <!-- Description des valeurs manquantes -->
                  <mat-form-field *ngIf="metadataForm.get('has_missing_values')?.value" 
                                  appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.QUALITY.MISSING_VALUES_DESCRIPTION' | translate }}</mat-label>
                    <textarea matInput formControlName="missing_values_description" rows="2"></textarea>
                  </mat-form-field>

                  <!-- Pourcentage global de valeurs manquantes -->
                  <mat-form-field *ngIf="metadataForm.get('has_missing_values')?.value" appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.QUALITY.GLOBAL_MISSING_PERCENTAGE' | translate }}</mat-label>
                    <input matInput type="number" formControlName="global_missing_percentage" 
                           min="0" max="100" step="0.1">
                    <span matSuffix>%</span>
                  </mat-form-field>

                  <!-- Méthode de gestion des valeurs manquantes -->
                  <mat-form-field *ngIf="metadataForm.get('has_missing_values')?.value" appearance="outline">
                    <mat-label>{{ 'METADATA_FORM.QUALITY.MISSING_VALUES_HANDLING' | translate }}</mat-label>
                    <mat-select formControlName="missing_values_handling_method">
                      <mat-option value="drop">{{ 'METADATA_FORM.QUALITY.HANDLING_DROP' | translate }}</mat-option>
                      <mat-option value="mean">{{ 'METADATA_FORM.QUALITY.HANDLING_MEAN' | translate }}</mat-option>
                      <mat-option value="median">{{ 'METADATA_FORM.QUALITY.HANDLING_MEDIAN' | translate }}</mat-option>
                      <mat-option value="mode">{{ 'METADATA_FORM.QUALITY.HANDLING_MODE' | translate }}</mat-option>
                      <mat-option value="interpolation">{{ 'METADATA_FORM.QUALITY.HANDLING_INTERPOLATION' | translate }}</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <!-- Facteurs temporels -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="temporal_factors">
                      {{ 'METADATA_FORM.QUALITY.TEMPORAL_FACTORS' | translate }}
                    </mat-checkbox>
                    <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.TEMPORAL' | translate }}">help</mat-icon>
                  </div>

                  <!-- Qualité des données documentée -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="data_quality_documented">
                      {{ 'METADATA_FORM.QUALITY.DATA_QUALITY_DOCUMENTED' | translate }}
                    </mat-checkbox>
                  </div>

                  <!-- Description des erreurs de données -->
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.QUALITY.DATA_ERRORS_DESCRIPTION' | translate }}</mat-label>
                    <textarea matInput formControlName="data_errors_description" rows="2"
                              placeholder="{{ 'METADATA_FORM.QUALITY.DATA_ERRORS_PLACEHOLDER' | translate }}"></textarea>
                  </mat-form-field>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Critères éthiques -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>security</mat-icon>
              {{ 'METADATA_FORM.TABS.ETHICS' | translate }}
            </ng-template>
            
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ 'METADATA_FORM.ETHICS.TITLE' | translate }}</mat-card-title>
                  <mat-card-subtitle>{{ 'METADATA_FORM.ETHICS.SUBTITLE' | translate }}</mat-card-subtitle>
                </mat-card-header>
                
                <mat-card-content>
                  <!-- Consentement éclairé -->
                  <div class="ethical-question">
                    <div class="question-header">
                      <h4>{{ 'METADATA_FORM.ETHICS.INFORMED_CONSENT' | translate }}</h4>
                      <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.INFORMED_CONSENT' | translate }}">help</mat-icon>
                    </div>
                    <mat-radio-group formControlName="informed_consent" class="radio-group">
                      <mat-radio-button [value]="true">{{ 'METADATA_FORM.ETHICS.YES' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="false">{{ 'METADATA_FORM.ETHICS.NO' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="null">{{ 'METADATA_FORM.ETHICS.UNKNOWN' | translate }}</mat-radio-button>
                    </mat-radio-group>
                  </div>

                  <!-- Transparence -->
                  <div class="ethical-question">
                    <div class="question-header">
                      <h4>{{ 'METADATA_FORM.ETHICS.TRANSPARENCY' | translate }}</h4>
                      <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.TRANSPARENCY' | translate }}">help</mat-icon>
                    </div>
                    <mat-radio-group formControlName="transparency" class="radio-group">
                      <mat-radio-button [value]="true">{{ 'METADATA_FORM.ETHICS.YES' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="false">{{ 'METADATA_FORM.ETHICS.NO' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="null">{{ 'METADATA_FORM.ETHICS.UNKNOWN' | translate }}</mat-radio-button>
                    </mat-radio-group>
                  </div>

                  <!-- Contrôle utilisateur -->
                  <div class="ethical-question">
                    <div class="question-header">
                      <h4>{{ 'METADATA_FORM.ETHICS.USER_CONTROL' | translate }}</h4>
                      <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.USER_CONTROL' | translate }}">help</mat-icon>
                    </div>
                    <mat-radio-group formControlName="user_control" class="radio-group">
                      <mat-radio-button [value]="true">{{ 'METADATA_FORM.ETHICS.YES' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="false">{{ 'METADATA_FORM.ETHICS.NO' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="null">{{ 'METADATA_FORM.ETHICS.UNKNOWN' | translate }}</mat-radio-button>
                    </mat-radio-group>
                  </div>

                  <!-- Équité et non-discrimination -->
                  <div class="ethical-question">
                    <div class="question-header">
                      <h4>{{ 'METADATA_FORM.ETHICS.EQUITY_NON_DISCRIMINATION' | translate }}</h4>
                      <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.EQUITY' | translate }}">help</mat-icon>
                    </div>
                    <mat-radio-group formControlName="equity_non_discrimination" class="radio-group">
                      <mat-radio-button [value]="true">{{ 'METADATA_FORM.ETHICS.YES' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="false">{{ 'METADATA_FORM.ETHICS.NO' | translate }}</mat-radio-button>
                      <mat-radio-button [value]="null">{{ 'METADATA_FORM.ETHICS.UNKNOWN' | translate }}</mat-radio-button>
                    </mat-radio-group>
                  </div>

                  <!-- Mesures de sécurité -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="security_measures_in_place">
                      {{ 'METADATA_FORM.ETHICS.SECURITY_MEASURES' | translate }}
                    </mat-checkbox>
                    <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.SECURITY' | translate }}">help</mat-icon>
                  </div>

                  <!-- Anonymisation appliquée -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="anonymization_applied">
                      {{ 'METADATA_FORM.ETHICS.ANONYMIZATION_APPLIED' | translate }}
                    </mat-checkbox>
                    <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.ANONYMIZATION' | translate }}">help</mat-icon>
                  </div>

                  <!-- Responsabilité définie -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="accountability_defined">
                      {{ 'METADATA_FORM.ETHICS.ACCOUNTABILITY_DEFINED' | translate }}
                    </mat-checkbox>
                    <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.ACCOUNTABILITY' | translate }}">help</mat-icon>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Documentation -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>description</mat-icon>
              {{ 'METADATA_FORM.TABS.DOCUMENTATION' | translate }}
            </ng-template>
            
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ 'METADATA_FORM.DOCUMENTATION.TITLE' | translate }}</mat-card-title>
                  <mat-card-subtitle>{{ 'METADATA_FORM.DOCUMENTATION.SUBTITLE' | translate }}</mat-card-subtitle>
                </mat-card-header>
                
                <mat-card-content>
                  <!-- Métadonnées fournies avec le dataset -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="metadata_provided_with_dataset">
                      {{ 'METADATA_FORM.DOCUMENTATION.METADATA_PROVIDED' | translate }}
                    </mat-checkbox>
                  </div>

                  <!-- Documentation externe disponible -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="external_documentation_available">
                      {{ 'METADATA_FORM.DOCUMENTATION.EXTERNAL_DOC_AVAILABLE' | translate }}
                    </mat-checkbox>
                  </div>

                  <!-- Lien vers la documentation -->
                  <mat-form-field *ngIf="metadataForm.get('external_documentation_available')?.value" 
                                  appearance="outline" class="full-width">
                    <mat-label>{{ 'METADATA_FORM.DOCUMENTATION.DOCUMENTATION_LINK' | translate }}</mat-label>
                    <input matInput formControlName="documentation_link" type="url"
                           placeholder="https://...">
                  </mat-form-field>

                  <!-- Politique de conservation des enregistrements -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="record_keeping_policy_exists">
                      {{ 'METADATA_FORM.DOCUMENTATION.RECORD_KEEPING_POLICY' | translate }}
                    </mat-checkbox>
                    <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.RECORD_KEEPING' | translate }}">help</mat-icon>
                  </div>

                  <!-- Respect de la limitation des finalités -->
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="purpose_limitation_respected">
                      {{ 'METADATA_FORM.DOCUMENTATION.PURPOSE_LIMITATION' | translate }}
                    </mat-checkbox>
                    <mat-icon matTooltip="{{ 'METADATA_FORM.TOOLTIPS.PURPOSE_LIMITATION' | translate }}">help</mat-icon>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Actions du formulaire -->
        <div class="form-actions">
          <button mat-button type="button" (click)="onCancel()">
            {{ 'METADATA_FORM.ACTIONS.CANCEL' | translate }}
          </button>
          
          <button mat-button type="button" (click)="saveDraft()" [disabled]="isAutoSaving">
            <mat-icon>save</mat-icon>
            {{ 'METADATA_FORM.ACTIONS.SAVE_DRAFT' | translate }}
          </button>
          
          <button mat-raised-button color="primary" type="button" 
                  (click)="onSubmit()" [disabled]="!metadataForm.valid || isSubmitting">
            <mat-icon>cloud_upload</mat-icon>
            {{ isSubmitting ? ('METADATA_FORM.ACTIONS.UPLOADING' | translate) : ('METADATA_FORM.ACTIONS.CREATE_DATASET' | translate) }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .metadata-form-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 24px;
    }

    .form-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .form-header h2 {
      margin: 0 0 8px 0;
      color: #1976d2;
      font-weight: 400;
    }

    .subtitle {
      margin: 0;
      color: #666;
      font-size: 1.1rem;
    }

    .auto-save-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #e8f5e8;
      border-radius: 4px;
      margin-bottom: 16px;
      color: #2e7d32;
      font-size: 0.9rem;
    }

    .form-progress {
      margin-bottom: 24px;
    }

    .progress-bar {
      width: 100%;
      height: 4px;
      background: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #1976d2;
      transition: width 0.3s ease;
    }

    .progress-text {
      display: block;
      text-align: right;
      font-size: 0.9rem;
      color: #666;
      margin-top: 4px;
    }

    .form-tabs {
      margin-bottom: 32px;
    }

    .tab-content {
      padding: 24px 0;
    }

    .full-width {
      width: 100%;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0;
    }

    .suggestions-card {
      margin-top: 16px;
      background: #f8f9fa;
    }

    .suggestion-item {
      margin: 8px 0;
    }

    .apply-suggestion {
      width: 100%;
      justify-content: flex-start;
    }

    .ethical-question {
      margin: 24px 0;
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .question-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .question-header h4 {
      margin: 0;
      font-weight: 500;
      color: #333;
    }

    .radio-group {
      display: flex;
      gap: 24px;
    }

    .form-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 24px 0;
      border-top: 1px solid #e0e0e0;
    }

    .form-actions button {
      min-width: 120px;
    }

    /* Styles pour le bouton de synchronisation des noms */
    .name-sync-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 8px 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      transition: all 0.3s ease;
    }

    .sync-toggle-btn {
      transition: all 0.3s ease;
      border-radius: 50%;
    }

    .sync-toggle-btn.synced {
      background-color: #4caf50 !important;
      color: white !important;
    }

    .sync-toggle-btn.synced:hover {
      background-color: #45a049 !important;
    }

    .sync-toggle-btn.unsynced {
      background-color: #ff9800 !important;
      color: white !important;
    }

    .sync-toggle-btn.unsynced:hover {
      background-color: #f57c00 !important;
    }

    .sync-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: #6c757d;
      text-align: center;
      flex: 1;
      margin: 0 8px;
    }

    .name-sync-container:hover {
      background: #e9ecef;
      border-color: #dee2e6;
    }

    /* Styles pour le champ nom d'affichage */
    .display-name-field {
      margin-top: 16px; /* Padding demandé */
      transition: all 0.3s ease;
    }

    .display-name-field.synced {
      opacity: 0.7;
    }

    .display-name-field.synced .mat-form-field-wrapper {
      background-color: #f8f9fa;
    }

    .readonly-input {
      background-color: #f8f9fa !important;
      color: #6c757d !important;
      cursor: not-allowed;
    }

    /* Style pour les champs synchronisés */
    .display-name-field.synced input {
      background-color: #f8f9fa !important;
      color: #6c757d !important;
      cursor: not-allowed;
    }

    .display-name-field.synced .mat-form-field-outline {
      background-color: #f8f9fa;
      opacity: 0.8;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .metadata-form-container {
        padding: 16px;
      }

      .radio-group {
        flex-direction: column;
        gap: 12px;
      }

      .form-actions {
        flex-direction: column;
        gap: 12px;
      }

      .form-actions button {
        width: 100%;
      }
    }
  `]
})
export class MetadataFormComponent implements OnInit, OnDestroy {
  @Input() suggestions: DatasetSuggestions | null = null;
  @Input() initialData: Partial<DatasetMetadata> | null = null;
  @Output() formSubmit = new EventEmitter<DatasetMetadata>();
  @Output() formCancel = new EventEmitter<void>();

  metadataForm: FormGroup;
  currentYear = new Date().getFullYear();
  isAutoSaving = false;
  isSubmitting = false;
  isDisplayNameSynced = true; // Par défaut, les noms sont synchronisés

  private destroy$ = new Subject<void>();
  private autoSaveDelay = 3000; // 3 secondes

  availableDomains = [
    { value: 'education', label: 'DOMAINS.EDUCATION' },
    { value: 'healthcare', label: 'DOMAINS.HEALTHCARE' },
    { value: 'finance', label: 'DOMAINS.FINANCE' },
    { value: 'technology', label: 'DOMAINS.TECHNOLOGY' },
    { value: 'science', label: 'DOMAINS.SCIENCE' },
    { value: 'social', label: 'DOMAINS.SOCIAL' },
    { value: 'environment', label: 'DOMAINS.ENVIRONMENT' },
    { value: 'general', label: 'DOMAINS.GENERAL' }
  ];

  availableTasks = [
    { value: 'classification', label: 'TASKS.CLASSIFICATION' },
    { value: 'regression', label: 'TASKS.REGRESSION' },
    { value: 'clustering', label: 'TASKS.CLUSTERING' },
    { value: 'anomaly_detection', label: 'TASKS.ANOMALY_DETECTION' },
    { value: 'time_series', label: 'TASKS.TIME_SERIES' },
    { value: 'nlp', label: 'TASKS.NLP' },
    { value: 'computer_vision', label: 'TASKS.COMPUTER_VISION' },
    { value: 'recommendation', label: 'TASKS.RECOMMENDATION' }
  ];

  constructor(
    private fb: FormBuilder,
    private uploadService: DatasetUploadService
  ) {
    this.metadataForm = this.createForm();
  }

  ngOnInit() {
    // Charger les données initiales si disponibles
    if (this.initialData) {
      this.metadataForm.patchValue(this.initialData);
    }

    // Appliquer les suggestions automatiques
    if (this.suggestions) {
      this.applyAutoSuggestions();
    }

    // Configurer la synchronisation automatique des noms
    this.setupDisplayNameSync();

    // Auto-save
    this.metadataForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(this.autoSaveDelay)
      )
      .subscribe(() => {
        this.autoSave();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      // Informations générales
      dataset_name: ['', Validators.required],
      display_name: [''],
      year: [this.currentYear],
      objective: [''],
      domain: [[]],
      task: [[]],
      
      // Données techniques
      access: ['public'],
      availability: ['online'],
      instances_number: [{ value: 0, disabled: true }],
      features_number: [{ value: 0, disabled: true }],
      features_description: [''],
      sources: [''],
      num_citations: [0],
      citation_link: [''],
      
      // Qualité des données
      split: [false],
      has_missing_values: [false],
      missing_values_description: [''],
      global_missing_percentage: [0],
      missing_values_handling_method: [''],
      temporal_factors: [false],
      data_quality_documented: [false],
      data_errors_description: [''],
      
      // Critères éthiques
      informed_consent: [null],
      transparency: [null],
      user_control: [null],
      equity_non_discrimination: [null],
      security_measures_in_place: [false],
      anonymization_applied: [false],
      accountability_defined: [false],
      
      // Documentation
      metadata_provided_with_dataset: [false],
      external_documentation_available: [false],
      documentation_link: [''],
      record_keeping_policy_exists: [false],
      purpose_limitation_respected: [false]
    });
  }

  private applyAutoSuggestions() {
    if (!this.suggestions) return;

    const updates: any = {};
    
    if (this.suggestions.suggested_dataset_name && !this.metadataForm.get('dataset_name')?.value) {
      updates.dataset_name = this.suggestions.suggested_dataset_name;
      
      // Synchroniser display_name si la synchronisation est active
      if (this.isDisplayNameSynced) {
        updates.display_name = this.formatDisplayName(this.suggestions.suggested_dataset_name);
      }
    }
    
    if (this.suggestions.suggested_domains?.length > 0 && !this.metadataForm.get('domain')?.value?.length) {
      updates.domain = this.suggestions.suggested_domains;
    }
    
    if (this.suggestions.suggested_tasks?.length > 0 && !this.metadataForm.get('task')?.value?.length) {
      updates.task = this.suggestions.suggested_tasks;
    }
    
    // Mettre à jour les statistiques techniques (activer temporairement les champs désactivés)
    if (this.suggestions.total_instances) {
      const instancesControl = this.metadataForm.get('instances_number');
      if (instancesControl) {
        instancesControl.enable();
        instancesControl.setValue(this.suggestions.total_instances);
        instancesControl.disable();
      }
    }
    
    if (this.suggestions.total_features) {
      const featuresControl = this.metadataForm.get('features_number');
      if (featuresControl) {
        featuresControl.enable();
        featuresControl.setValue(this.suggestions.total_features);
        featuresControl.disable();
      }
    }

    this.metadataForm.patchValue(updates);
  }

  applySuggestion(field: string, value: any) {
    this.metadataForm.patchValue({ [field]: value });
  }

  getCompletionPercentage(): number {
    const form = this.metadataForm;
    const totalFields = Object.keys(form.controls).length;
    const filledFields = Object.keys(form.controls).filter(key => {
      const control = form.get(key);
      const value = control?.value;
      return value !== null && value !== '' && 
             (Array.isArray(value) ? value.length > 0 : true);
    }).length;
    
    return Math.round((filledFields / totalFields) * 100);
  }

  private autoSave() {
    if (this.metadataForm.valid && !this.isAutoSaving) {
      this.isAutoSaving = true;
      this.uploadService.saveDraft(this.metadataForm.value);
      
      setTimeout(() => {
        this.isAutoSaving = false;
      }, 1000);
    }
  }

  saveDraft() {
    this.uploadService.saveDraft(this.metadataForm.value);
  }

  onSubmit() {
    if (this.metadataForm.valid) {
      this.isSubmitting = true;
      this.formSubmit.emit(this.metadataForm.value);
    }
  }

  /**
   * Bascule la synchronisation entre dataset_name et display_name
   */
  toggleDisplayNameSync() {
    this.isDisplayNameSynced = !this.isDisplayNameSynced;
    
    if (this.isDisplayNameSynced) {
      // Synchroniser display_name avec dataset_name
      const datasetName = this.metadataForm.get('dataset_name')?.value || '';
      this.metadataForm.patchValue({
        display_name: this.formatDisplayName(datasetName)
      });
    }
  }

  /**
   * Formate le nom de dataset en nom d'affichage (première lettre en majuscule, remplace _ par espaces)
   */
  private formatDisplayName(datasetName: string): string {
    if (!datasetName) return '';
    
    return datasetName
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Met à jour display_name automatiquement quand dataset_name change (si synchronisé)
   */
  private setupDisplayNameSync() {
    this.metadataForm.get('dataset_name')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(datasetName => {
        if (this.isDisplayNameSynced && datasetName) {
          this.metadataForm.patchValue({
            display_name: this.formatDisplayName(datasetName)
          }, { emitEvent: false }); // emitEvent: false pour éviter les boucles
        }
      });
  }

  onCancel() {
    this.formCancel.emit();
  }
}