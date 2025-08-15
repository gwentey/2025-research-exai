import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, forwardRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

export interface SortOption {
  value: string;
  label: string;
  translationKey?: string;
}

@Component({
  selector: 'app-custom-sort-select',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslateModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSortSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="custom-sort-select">
      <div
        #selectContainer
        class="select-container"
        [class.open]="isOpen"
        (click)="toggleDropdown()">

        <div class="select-value">
          <span class="selected-text">
            {{ ('DATASETS.LISTING.SORT_BY' | translate) + ': ' + (getSelectedLabel() | translate) }}
          </span>
          <mat-icon class="dropdown-icon" [class.rotated]="isOpen">expand_more</mat-icon>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./custom-sort-select.component.scss']
})
export class CustomSortSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() label: string = '';
  @Input() options: SortOption[] = [];
  @Output() selectionChange = new EventEmitter<any>();
  @ViewChild('selectContainer', { static: false }) selectContainer!: ElementRef;

  value: string = '';
  isOpen: boolean = false;

  // Référence au dropdown créé dynamiquement dans le body
  private dropdownElement: HTMLElement | null = null;
  private overlayElement: HTMLElement | null = null;

  // ControlValueAccessor implementation
  private onChange = (value: string) => {};
  private onTouched = () => {};

  ngOnInit(): void {
    // Fermer le dropdown si on clique ailleurs
    document.addEventListener('click', this.handleDocumentClick.bind(this));
    // Recalculer la position sur resize
    window.addEventListener('resize', this.handleWindowResize.bind(this));
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleDocumentClick.bind(this));
    window.removeEventListener('resize', this.handleWindowResize.bind(this));
    // Détruire le dropdown s'il existe encore
    this.destroyDropdown();
  }

  private handleDocumentClick(event: Event): void {
    // La fermeture est gérée par l'overlay
  }

  private handleWindowResize(): void {
    if (this.isOpen) {
      // Recalculer la position du dropdown créé dans le body
      this.destroyDropdown();
      setTimeout(() => {
        if (this.isOpen) {
          this.createDropdownInBody();
        }
      }, 100);
    }
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.createDropdownInBody();
      this.onTouched();
    } else {
      this.destroyDropdown();
    }
  }

  private createDropdownInBody(): void {
    if (!this.selectContainer) return;

    // Détruire le dropdown existant s'il y en a un
    this.destroyDropdown();

    // Calculer la position du select
    const rect = this.selectContainer.nativeElement.getBoundingClientRect();
    console.log('🎯 Création dropdown dans body - Position select:', {
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width
    });

    // 1. Créer l'overlay (backdrop transparent)
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'custom-dropdown-overlay';
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 100000;
      background: transparent;
      cursor: default;
    `;
    this.overlayElement.addEventListener('click', () => this.closeDropdown());

    // 2. Créer le dropdown menu
    this.dropdownElement = document.createElement('div');
    this.dropdownElement.className = 'custom-dropdown-menu';

    // Calculer la position optimale
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = Math.max(rect.width, 280);
    const dropdownHeight = Math.min(this.options.length * 50 + 16, 250); // Estimation de la hauteur

    // Position horizontale
    let left = rect.left;
    if (left + dropdownWidth > viewportWidth - 10) {
      left = viewportWidth - dropdownWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    // Position verticale
    let top = rect.bottom + 4;
    if (top + dropdownHeight > viewportHeight - 10) {
      // Ouvrir vers le haut
      top = rect.top - dropdownHeight - 4;
      if (top < 10) {
        top = 10; // Position de secours
      }
    }

    this.dropdownElement.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      width: ${dropdownWidth}px;
      max-height: 250px;
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
      z-index: 100001;
      overflow-y: auto;
      overscroll-behavior: contain;
    `;

    // 3. Ajouter les options
    if (!this.dropdownElement) {
      console.error('Dropdown element is null, cannot add options');
      return;
    }

    const dropdownContainer = this.dropdownElement; // Variable locale pour TypeScript

    this.options.forEach((option, index) => {
      const optionElement = document.createElement('div');
      optionElement.className = `custom-dropdown-option ${option.value === this.value ? 'selected' : ''}`;
      optionElement.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        cursor: pointer;
        font-size: 15px;
        color: ${option.value === this.value ? '#ffffff' : '#1e293b'};
        background: ${option.value === this.value ? '#242e54' : '#ffffff'};
        transition: background-color 0.2s ease;
        ${index === 0 ? 'border-radius: 10px 10px 0 0;' : ''}
        ${index === this.options.length - 1 ? 'border-radius: 0 0 10px 10px;' : ''}
        ${this.options.length === 1 ? 'border-radius: 10px;' : ''}
      `;

      // Texte de l'option
      const textSpan = document.createElement('span');
      textSpan.textContent = option.label;
      textSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      optionElement.appendChild(textSpan);

      // Icône de sélection
      if (option.value === this.value) {
        const checkIcon = document.createElement('span');
        checkIcon.innerHTML = '✓';
        checkIcon.style.cssText = 'font-size: 18px; color: #ffffff; margin-left: 8px;';
        optionElement.appendChild(checkIcon);
      }

      // Hover effect
      optionElement.addEventListener('mouseenter', () => {
        if (option.value !== this.value) {
          optionElement.style.background = '#f8fafc';
        }
      });
      optionElement.addEventListener('mouseleave', () => {
        if (option.value !== this.value) {
          optionElement.style.background = '#ffffff';
        }
      });

      // Click handler
      optionElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectOption(option);
      });

      dropdownContainer.appendChild(optionElement);
    });

    // 4. Ajouter au body (dans l'ordre: overlay puis dropdown)
    if (this.overlayElement && this.dropdownElement) {
      document.body.appendChild(this.overlayElement);
      document.body.appendChild(this.dropdownElement);
    }

    console.log(`✅ Dropdown créé dans le body avec z-index 100001 à la position (${left}, ${top})`);
  }

  private destroyDropdown(): void {
    if (this.dropdownElement && this.dropdownElement.parentNode) {
      document.body.removeChild(this.dropdownElement);
      this.dropdownElement = null;
    }
    if (this.overlayElement && this.overlayElement.parentNode) {
      document.body.removeChild(this.overlayElement);
      this.overlayElement = null;
    }
  }

  closeDropdown(): void {
    this.isOpen = false;
    this.destroyDropdown();
  }

  selectOption(option: SortOption): void {
    this.value = option.value;
    this.onChange(this.value);
    this.selectionChange.emit({ value: option.value });
    this.closeDropdown();
  }

  getSelectedLabel(): string {
    const selected = this.options.find(opt => opt.value === this.value);
    if (!selected) return '';

    // Retourner la clé de traduction si elle existe, sinon le label
    return selected.translationKey || selected.label;
  }
}
