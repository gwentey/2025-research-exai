import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MaterialModule } from '../../../material.module';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [RouterModule, MaterialModule, TranslateModule],
  templateUrl: './error.component.html',
})
export class AppErrorComponent {}
