import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from './services/language.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  title = 'Modernize Angular Admin Template';
  
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);

  ngOnInit(): void {
    // Initialiser les langues supportées
    this.translate.addLangs(['fr', 'en']);
    
    // Définir la langue par défaut 
    this.translate.setDefaultLang('fr');
    
    // Attendre que TranslateService soit prêt, puis initialiser la langue
    setTimeout(() => {
      this.languageService.initializeLanguage();
      console.log('Service de traduction initialisé');
    }, 100);
  }
}
