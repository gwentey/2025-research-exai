import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from './services/language.service';
import { TitleService } from './services/title.service';
import { filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);
  private titleService = inject(TitleService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  ngOnInit(): void {
    // Initialiser les langues supportées
    this.translate.addLangs(['fr', 'en']);
    
    // Définir la langue par défaut 
    this.translate.setDefaultLang('fr');
    
    // Attendre que TranslateService soit prêt, puis initialiser la langue
    setTimeout(() => {
      this.languageService.initializeLanguage();
      console.log('🔄 Service de traduction initialisé, langue actuelle:', this.translate.currentLang);
      
      // Attendre encore un peu que les traductions soient vraiment chargées
      this.translate.get('PAGE_TITLES.DASHBOARD').subscribe(result => {
        console.log('✅ Test de traduction:', result);
        
        if (result !== 'PAGE_TITLES.DASHBOARD') {
          // Les traductions sont chargées !
          console.log('📚 Traductions prêtes, initialisation des titres...');
          
          // Écouter les changements de routes pour mettre à jour le titre
          this.setupTitleUpdates();
          
          // Définir le titre initial pour la page actuelle
          const initialUrl = this.router.url;
          console.log('🏠 URL initiale:', initialUrl);
          this.setTitleFromUrl();
        } else {
          // Les traductions ne sont pas encore chargées, réessayer
          console.log('⏳ Traductions pas encore prêtes, nouveau délai...');
          setTimeout(() => {
            this.setupTitleUpdates();
            this.setTitleFromUrl();
          }, 300);
        }
      });
    }, 200);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupTitleUpdates(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.activatedRoute),
        map(route => {
          // Naviguer jusqu'à la route enfant finale
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route;
        }),
        switchMap(route => {
          // Combiner les données de route avec les paramètres
          return route.data.pipe(
            map(data => ({ data, params: route.snapshot.params }))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(({ data, params }) => {
        this.updateTitle(data, params);
      });
  }

  private updateTitle(routeData: any, routeParams?: any): void {
    console.log('🔍 Mise à jour du titre - routeData:', routeData, 'params:', routeParams);
    
    if (routeData?.title) {
      // Utiliser le titre défini dans les données de route avec le bon prefix
      const titleKey = `PAGE_TITLES.${routeData.title}`;
      console.log('📝 Utilisation de la clé de titre:', titleKey);
      this.titleService.setTitle(titleKey, true);
    } else {
      // Fallback : essayer de déduire le titre depuis l'URL
      console.log('⚠️ Aucun titre dans routeData, utilisation du fallback URL');
      this.setTitleFromUrl();
    }
  }

  private setTitleFromUrl(): void {
    const url = this.router.url;
    let titleKey = 'DASHBOARD'; // Titre par défaut
    
    if (url.includes('/datasets')) {
      if (url.includes('/complete-metadata')) {
        titleKey = 'DATASET_METADATA';
      } else if (url.match(/\/datasets\/[^\/]+$/)) {
        titleKey = 'DATASET_DETAIL';
      } else {
        titleKey = 'DATASETS';
      }
    } else if (url.includes('/projects')) {
      if (url.match(/\/projects\/[^\/]+$/)) {
        titleKey = 'PROJECT_DETAIL';
      } else {
        titleKey = 'PROJECTS';
      }
    } else if (url.includes('/ml-pipeline-wizard')) {
      titleKey = 'ML_PIPELINE_WIZARD';
    } else if (url.includes('/ml-pipeline')) {
      if (url.includes('/cleaning')) {
        titleKey = 'ML_PIPELINE_CLEANING';
      } else if (url.includes('/training')) {
        titleKey = 'ML_PIPELINE_TRAINING';
      } else if (url.includes('/results')) {
        titleKey = 'ML_PIPELINE_RESULTS';
      } else {
        titleKey = 'ML_PIPELINE';
      }
    } else if (url.includes('/profile')) {
      if (url.includes('/credits-refill')) {
        titleKey = 'CREDITS_REFILL';
      } else {
        titleKey = 'PROFILE';
      }
    } else if (url.includes('/admin')) {
      if (url.includes('/datasets')) {
        titleKey = 'ADMIN_DATASETS';
      } else if (url.includes('/users')) {
        titleKey = 'ADMIN_USERS';
      } else if (url.includes('/ethical-templates')) {
        titleKey = 'ADMIN_ETHICAL_TEMPLATES';
      } else {
        titleKey = 'ADMIN_DASHBOARD';
      }
    } else if (url.includes('/authentication')) {
      if (url.includes('/login')) {
        titleKey = 'LOGIN';
      } else if (url.includes('/register')) {
        titleKey = 'REGISTER';
      } else {
        titleKey = 'ERROR';
      }
    } else if (url.includes('/onboarding')) {
      titleKey = 'ONBOARDING';
    }
    
    this.titleService.setTitle(`PAGE_TITLES.${titleKey}`, true);
  }
}
