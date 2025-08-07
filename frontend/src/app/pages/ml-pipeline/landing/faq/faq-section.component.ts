import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-ml-faq-section',
  standalone: true,
  imports: [CommonModule, MatExpansionModule, TranslateModule],
  templateUrl: './faq-section.component.html',
  styleUrls: ['./faq-section.component.scss']
})
export class MlFaqSectionComponent {
  faqs = [
    {
      q: 'Comment ça fonctionne ?',
      a: "La pipeline guide vos données à travers 8 étapes claires, de la sélection à l’explicabilité."
    },
    {
      q: 'Dois-je connaître le ML ?',
      a: "Pas nécessairement. Vous pouvez démarrer avec des réglages par défaut, puis affiner progressivement."
    },
    {
      q: 'Puis-je utiliser AutoML ?',
      a: "Oui, un mode AutoML facilite la sélection d’algorithmes et d’hyperparamètres."
    }
  ];
}


