import { Component, ViewEncapsulation } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Composant starter simple et vide
 */
@Component({
  selector: 'app-starter',
  templateUrl: './starter.component.html',
  imports: [MaterialModule, CommonModule, RouterModule, TranslateModule],
  styleUrls: ['./starter.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class StarterComponent {
  
  constructor() {}

}
