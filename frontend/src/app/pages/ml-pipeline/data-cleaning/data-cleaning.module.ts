import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataCleaningComponent } from './data-cleaning.component';

@NgModule({
  imports: [
    CommonModule,
    DataCleaningComponent // Standalone component
  ],
  exports: [DataCleaningComponent]
})
export class DataCleaningModule { }