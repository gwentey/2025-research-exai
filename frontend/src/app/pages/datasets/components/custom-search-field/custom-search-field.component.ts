import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-custom-search-field',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, TranslateModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSearchFieldComponent),
      multi: true
    }
  ],
  template: `
    <div class="custom-search-field">
      <div class="search-input-container">
        <input
          type="text"
          class="search-input"
          [value]="value"
          (input)="onInput($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          [placeholder]="placeholder"
          autocomplete="off">

        <button
          *ngIf="value && value.length > 0"
          type="button"
          class="clear-button"
          (click)="onClear()"
          [matTooltip]="'COMMON.CLEAR' | translate">
          <mat-icon>clear</mat-icon>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./custom-search-field.component.scss']
})
export class CustomSearchFieldComponent implements ControlValueAccessor {
  @Input() placeholder: string = '';
  @Output() inputChange = new EventEmitter<Event>();
  @Output() clear = new EventEmitter<void>();

  value: string = '';
  isFocused: boolean = false;

  // ControlValueAccessor implementation
  private onChange = (value: string) => {};
  private onTouched = () => {};

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
    this.inputChange.emit(event);
  }

  onFocus(): void {
    this.isFocused = true;
  }

  onBlur(): void {
    this.isFocused = false;
    this.onTouched();
  }

  onClear(): void {
    this.value = '';
    this.onChange(this.value);
    this.clear.emit();
  }
}
