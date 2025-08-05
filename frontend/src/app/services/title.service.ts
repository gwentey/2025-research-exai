import { Injectable, inject, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { Observable, combineLatest, BehaviorSubject, Subject } from 'rxjs';
import { map, takeUntil, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TitleService implements OnDestroy {
  private title = inject(Title);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();
  
  private readonly DEFAULT_TITLE = 'IBIS-X';
  private readonly TITLE_SEPARATOR = ' | ';
  
  // BehaviorSubject pour stocker la clé de titre actuelle
  private currentTitleKey$ = new BehaviorSubject<string>('PAGE_TITLES.DASHBOARD');

  constructor() {
    // Attendre que le service soit vraiment prêt avant d'écouter
    setTimeout(() => {
      this.setupLanguageListener();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Écoute les changements de langue pour mettre à jour automatiquement le titre
   */
  private setupLanguageListener(): void {
    // Combiner les changements de langue avec la clé de titre actuelle
    this.translate.onLangChange
      .pipe(
        switchMap(() => this.currentTitleKey$),
        switchMap(titleKey => this.translate.get(titleKey)),
        takeUntil(this.destroy$)
      )
      .subscribe(translatedTitle => {
        const finalTitle = this.formatTitle(translatedTitle);
        this.title.setTitle(finalTitle);
        console.log(`🌐 Titre mis à jour suite au changement de langue: "${finalTitle}"`);
      });
  }

  /**
   * Met à jour le titre de la page avec le format: "<Nom de la page> | IBIS-X"
   * @param pageTitle Le titre de la page (peut être une clé de traduction)
   * @param isTranslationKey Si true, traduit le titre avant de l'utiliser
   */
  setTitle(pageTitle: string, isTranslationKey: boolean = true): void {
    if (isTranslationKey) {
      // Stocker la clé actuelle pour les changements de langue futurs
      this.currentTitleKey$.next(pageTitle);
      
      console.log(`🔍 Recherche de traduction pour clé: "${pageTitle}"`);
      console.log(`📚 Langue actuelle: ${this.translate.currentLang}`);
      
      this.translate.get(pageTitle).subscribe({
        next: (translatedTitle) => {
          console.log(`📖 Traduction trouvée: "${translatedTitle}" pour clé: "${pageTitle}"`);
          
          // Vérifier si la traduction a vraiment fonctionné
          let finalTranslation = translatedTitle;
          if (translatedTitle === pageTitle || !translatedTitle || translatedTitle.startsWith('PAGE_TITLES.')) {
            // La traduction a échoué, essayer de décomposer la clé
            console.warn(`⚠️ Traduction échouée pour: ${pageTitle}`);
            
            // Extraire la dernière partie de la clé (ex: CREDITS_REFILL de PAGE_TITLES.CREDITS_REFILL)
            const keyParts = pageTitle.split('.');
            const simpleKey = keyParts[keyParts.length - 1];
            
            // Essayer avec la clé simple
            console.log(`🔄 Tentative avec clé simple: ${simpleKey}`);
            this.translate.get(`PAGE_TITLES.${simpleKey}`).subscribe(retry => {
              console.log(`🔁 Résultat retry: "${retry}"`);
              if (retry !== `PAGE_TITLES.${simpleKey}` && retry !== pageTitle) {
                finalTranslation = retry;
              } else {
                // Dernier fallback : utiliser le nom de la clé mais en format lisible
                finalTranslation = this.formatKeyAsTitle(simpleKey);
                console.warn(`💡 Utilisation du fallback lisible: "${finalTranslation}"`);
              }
              
              const finalTitle = this.formatTitle(finalTranslation);
              this.title.setTitle(finalTitle);
              console.log(`🎯 Titre final mis à jour: "${finalTitle}"`);
            });
            return;
          }
          
          const finalTitle = this.formatTitle(finalTranslation);
          this.title.setTitle(finalTitle);
          console.log(`🎯 Titre mis à jour: "${finalTitle}" (clé: ${pageTitle}, lang: ${this.translate.currentLang})`);
        },
        error: (error) => {
          console.error(`❌ Erreur lors de la traduction de "${pageTitle}":`, error);
          const fallbackTitle = this.formatKeyAsTitle(pageTitle.split('.').pop() || 'Page');
          const finalTitle = this.formatTitle(fallbackTitle);
          this.title.setTitle(finalTitle);
          console.log(`🆘 Titre fallback: "${finalTitle}"`);
        }
      });
    } else {
      const finalTitle = this.formatTitle(pageTitle);
      this.title.setTitle(finalTitle);
      console.log(`🎯 Titre mis à jour: "${finalTitle}"`);
    }
  }

  /**
   * Convertit une clé de traduction en titre lisible
   * Ex: CREDITS_REFILL -> "Credits Refill"
   */
  private formatKeyAsTitle(key: string): string {
    return key
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Met à jour le titre avec des paramètres dynamiques
   * @param pageTitleKey Clé de traduction du titre
   * @param params Paramètres pour la traduction
   */
  setTitleWithParams(pageTitleKey: string, params: any): void {
    this.translate.get(pageTitleKey, params).subscribe(translatedTitle => {
      const finalTitle = this.formatTitle(translatedTitle);
      this.title.setTitle(finalTitle);
    });
  }

  /**
   * Observe les changements de titre avec traduction automatique
   * @param pageTitleKey Clé de traduction du titre
   * @returns Observable du titre formaté
   */
  getTitleObservable(pageTitleKey: string): Observable<string> {
    return this.translate.get(pageTitleKey).pipe(
      map(translatedTitle => this.formatTitle(translatedTitle))
    );
  }

  /**
   * Observe les changements de titre avec paramètres
   * @param pageTitleKey Clé de traduction du titre
   * @param params Paramètres pour la traduction
   * @returns Observable du titre formaté
   */
  getTitleWithParamsObservable(pageTitleKey: string, params: any): Observable<string> {
    return this.translate.get(pageTitleKey, params).pipe(
      map(translatedTitle => this.formatTitle(translatedTitle))
    );
  }

  /**
   * Met à jour le titre depuis les données de route
   * @param routeData Données de la route contenant potentiellement un titre
   * @param routeParams Paramètres de la route pour les titres dynamiques
   */
  setTitleFromRoute(routeData: any, routeParams?: any): void {
    if (routeData?.title) {
      if (routeParams && Object.keys(routeParams).length > 0) {
        // Utiliser les paramètres pour créer un titre dynamique
        this.setDynamicTitle(routeData.title, routeParams);
      } else {
        this.setTitle(`PAGE_TITLES.${routeData.title}`, true);
      }
    } else {
      // Fallback au titre par défaut si aucun titre n'est défini
      this.title.setTitle(this.DEFAULT_TITLE);
    }
  }

  /**
   * Met à jour le titre avec des paramètres dynamiques pour personnalisation
   * @param baseTitleKey Clé de base pour le titre
   * @param params Paramètres pour personnaliser le titre
   */
  private setDynamicTitle(baseTitleKey: string, params: any): void {
    // Pour les pages de détail, essayer de créer des titres plus spécifiques
    if (baseTitleKey === 'PROJECT_DETAIL' && params.id) {
      // Pour les projets, nous pourrions avoir besoin de récupérer le nom du projet
      // Pour l'instant, utiliser l'ID comme fallback
      this.setTitle(`PAGE_TITLES.PROJECT_DETAIL`, true);
    } else if (baseTitleKey === 'DATASET_DETAIL' && params.id) {
      // Pour les datasets, similaire
      this.setTitle(`PAGE_TITLES.DATASET_DETAIL`, true);
    } else {
      // Fallback vers le titre de base
      this.setTitle(`PAGE_TITLES.${baseTitleKey}`, true);
    }
  }

  /**
   * Réinitialise le titre au titre par défaut
   */
  resetToDefault(): void {
    this.title.setTitle(this.DEFAULT_TITLE);
  }

  /**
   * Formate le titre avec le séparateur et le nom de l'application
   * @param pageTitle Le titre de la page
   * @returns Le titre formaté
   */
  private formatTitle(pageTitle: string): string {
    if (!pageTitle || pageTitle.trim() === '') {
      return this.DEFAULT_TITLE;
    }
    
    // Éviter la duplication si le titre contient déjà IBIS-X
    if (pageTitle.includes('IBIS-X')) {
      return pageTitle;
    }
    
    return `${pageTitle}${this.TITLE_SEPARATOR}${this.DEFAULT_TITLE}`;
  }
}