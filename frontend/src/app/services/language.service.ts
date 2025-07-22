import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export interface Language {
  language: string;
  code: string;
  type?: string;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly STORAGE_KEY = 'selectedLanguage';
  
  public readonly availableLanguages: Language[] = [
    {
      language: 'English',
      code: 'en',
      type: 'US',
      icon: '/assets/images/flag/icon-flag-en.svg',
    },
    {
      language: 'Français',
      code: 'fr',
      icon: '/assets/images/flag/icon-flag-fr.svg',
    },
  ];

  private currentLanguageSubject = new BehaviorSubject<Language>(this.availableLanguages[0]);
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(private translate: TranslateService) {
    // L'initialisation sera gérée par AppComponent
    // On attend que TranslateService soit prêt
    this.translate.onLangChange.subscribe((event) => {
      const language = this.availableLanguages.find(lang => lang.code === event.lang);
      if (language) {
        this.currentLanguageSubject.next(language);
      }
    });
  }



  /**
   * Initialise la langue au premier chargement
   */
  public initializeLanguage(): void {
    const savedLang = this.getSavedLanguage();
    if (savedLang) {
      this.setLanguage(savedLang, false);
    } else {
      // Détecter la langue du navigateur
      const browserLang = this.translate.getBrowserLang() || 'fr';
      const detectedLang = this.availableLanguages.find(lang => lang.code === browserLang);
      this.setLanguage(detectedLang || this.availableLanguages[0], true);
    }
  }

  /**
   * Change la langue de l'application
   */
  public setLanguage(language: Language, save: boolean = true): void {
    this.translate.use(language.code);
    this.currentLanguageSubject.next(language);
    
    if (save) {
      this.saveLanguage(language);
    }
  }

  /**
   * Récupère la langue actuelle
   */
  public getCurrentLanguage(): Language {
    return this.currentLanguageSubject.value;
  }

  /**
   * Sauvegarde la langue dans localStorage
   */
  private saveLanguage(language: Language): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(language));
    } catch (error) {
      console.warn('Impossible de sauvegarder la langue:', error);
    }
  }

  /**
   * Récupère la langue sauvegardée depuis localStorage
   */
  private getSavedLanguage(): Language | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsedLang = JSON.parse(saved);
        // Vérifier que la langue sauvegardée existe encore
        return this.availableLanguages.find(lang => lang.code === parsedLang.code) || null;
      }
    } catch (error) {
      console.warn('Erreur lors du chargement de la langue sauvegardée:', error);
    }
    return null;
  }

  /**
   * Vérifie si une langue est supportée
   */
  public isLanguageSupported(languageCode: string): boolean {
    return this.availableLanguages.some(lang => lang.code === languageCode);
  }
} 
