import { Component, Input, OnInit, OnChanges, ChangeDetectionStrategy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Composant réutilisable pour afficher le nom d'utilisateur avec troncature intelligente
 * Gère automatiquement la réduction de taille de police et l'ellipsis selon l'espace disponible
 */
@Component({
  selector: 'app-user-name-display',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './user-name-display.component.html',
  styleUrls: ['./user-name-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserNameDisplayComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() displayName: string = '';
  @Input() maxWidth: number = 126; // Largeur maximale disponible en pixels
  @Input() baseClass: string = 'f-w-600'; // Classes CSS de base à conserver
  @Input() referenceText: string = ''; // Texte de référence - si displayName est plus large, ne pas afficher

  @ViewChild('nameElement', { static: false }) nameElement!: ElementRef<HTMLElement>;

  public currentFontSize: string = 'f-s-16'; // Taille de police actuelle
  public isTruncated: boolean = false; // Indique si le texte est tronqué
  public shouldShowTooltip: boolean = false; // Indique si le tooltip doit être affiché
  public shouldDisplay: boolean = true; // Indique si le composant doit être affiché

  private readonly fontSizes = ['f-s-16', 'f-s-14', 'f-s-12']; // Tailles de police disponibles par ordre décroissant


  ngOnInit(): void {
    this.calculateOptimalDisplay();
  }

  ngOnChanges(): void {
    this.calculateOptimalDisplay();
  }

  ngAfterViewInit(): void {
    // Calculer l'affichage optimal
    this.calculateOptimalDisplay();
  }



  /**
   * Calcule l'affichage optimal du nom d'utilisateur
   * Teste différentes tailles de police avant de tronquer
   */
  private calculateOptimalDisplay(): void {
    if (!this.displayName) {
      this.shouldDisplay = false;
      return;
    }

    // Reset des états
    this.isTruncated = false;
    this.shouldShowTooltip = false;
    this.shouldDisplay = true;

    // Utiliser Canvas pour mesurer précisément la largeur du texte
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Font family par défaut (Plus Jakarta Sans)
    const fontFamily = '"Plus Jakarta Sans", sans-serif';
    let sizeFound = false;

    // Déterminer le font-weight depuis baseClass
    let fontWeight = '600'; // défaut semi-bold
    if (this.baseClass.includes('f-w-400')) fontWeight = '400';
    else if (this.baseClass.includes('f-w-500')) fontWeight = '500';
    else if (this.baseClass.includes('f-w-700')) fontWeight = '700';

    // Si un texte de référence est fourni, vérifier d'abord si on dépasse
    if (this.referenceText) {
      // Calculer la largeur du texte de référence avec la taille de base
      const baseSize = this.baseClass.includes('f-s-14') ? 14 : this.baseClass.includes('f-s-12') ? 12 : 16;
      context.font = `${fontWeight} ${baseSize}px ${fontFamily}`;
      
      const referenceWidth = context.measureText(this.referenceText).width;
      const currentWidth = context.measureText(this.displayName).width;
      
      // Si le texte actuel est plus large que la référence, ne pas afficher
      if (currentWidth > referenceWidth) {
        this.shouldDisplay = false;
        return;
      }
    }

    // Tester chaque taille de police
    for (const fontSize of this.fontSizes) {
      // Convertir la classe CSS en pixels
      let pixelSize = 16; // défaut f-s-16
      if (fontSize === 'f-s-14') pixelSize = 14;
      else if (fontSize === 'f-s-12') pixelSize = 12;
      
      // Définir la police dans le canvas avec le bon poids
      context.font = `${fontWeight} ${pixelSize}px ${fontFamily}`;
      
      // Mesurer la largeur du texte
      const textWidth = context.measureText(this.displayName).width;
      
      // Vérifier si ça rentre avec une marge de sécurité de 3px
      if (textWidth <= (this.maxWidth - 3)) {
        this.currentFontSize = fontSize;
        sizeFound = true;
        break;
      }
    }

    // Si aucune taille ne fonctionne, forcer l'affichage avec la plus petite taille et ellipsis
    if (!sizeFound) {
      this.currentFontSize = this.fontSizes[this.fontSizes.length - 1];
      this.isTruncated = true;
      this.shouldShowTooltip = true;
      
      // Garantir un affichage minimum : si le texte fait moins de 30% de maxWidth,
      // c'est probablement parce que le conteneur est trop petit, pas le texte trop long
      const minDisplayWidth = this.maxWidth * 0.3;
      if (context) {
        context.font = `${fontWeight} 12px ${fontFamily}`;
        const finalWidth = context.measureText(this.displayName).width;
        
        // Si même la plus petite taille ne rentre pas dans 30% de l'espace,
        // on force quand même l'affichage (le CSS truncation s'en chargera)
        if (finalWidth < minDisplayWidth) {
          console.warn(`UserNameDisplay: Texte "${this.displayName}" très court mais espace limité (${this.maxWidth}px)`);
        }
      }
    }
  }



  /**
   * Retourne les classes CSS à appliquer à l'élément
   */
  public getClasses(): string {
    const classes = [this.baseClass, this.currentFontSize];
    
    if (this.isTruncated) {
      classes.push('text-ellipsis', 'text-nowrap', 'overflow-hidden');
    }
    
    return classes.join(' ');
  }

  /**
   * Retourne le message du tooltip si nécessaire
   */
  public getTooltipMessage(): string | null {
    return this.shouldShowTooltip ? this.displayName : null;
  }

  /**
   * Retourne les styles inline pour la largeur maximale
   */
  public getInlineStyles(): { [key: string]: string } {
    return {
      'max-width.px': this.maxWidth.toString(),
      'display': 'block',
      'width': '100%'
    };
  }
}