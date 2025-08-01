import {
  Component,
  Output,
  EventEmitter,
  Input,
  signal,
  ViewEncapsulation,
  OnInit,
  inject,
} from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog } from '@angular/material/dialog';
import { navItems } from '../sidebar/sidebar-data';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { LanguageService, Language } from 'src/app/services/language.service';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AppSettings } from 'src/app/config';
import { AuthService } from 'src/app/services/auth.service';
import { UserRead } from 'src/app/models/auth.models';
// Assuming search dialog is defined here or imported, comment out for now if causing issues
// import { AppSearchDialogComponent } from './search-dialog.component';

interface notifications {
  id: number;
  img: string;
  title: string;
  subtitle: string;
}

interface profiledd {
  id: number;
  img: string;
  title: string;
  subtitle: string;
  link: string;
  color: string;
}

// Interfaces apps et quicklinks supprimées - non nécessaires pour IBIS-X

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
    TranslateModule,
    FormsModule,
  ],
  templateUrl: './header.component.html',
})
export class VerticalHeaderComponent implements OnInit {
  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() optionsChange = new EventEmitter<AppSettings>();

  isCollapse: boolean = false; // Initially hidden
  
  // Informations de l'utilisateur actuel
  currentUser: UserRead | null = null;
  userDisplayName: string = 'Chargement...';
  userRole: string = 'Utilisateur';
  userEmail: string = '';
  userProfileImage: string = '/assets/images/profile/user5.jpg'; // Image par défaut

  toggleCollpase() {
    this.isCollapse = !this.isCollapse; // Toggle visibility
  }

  showFiller = false;

  public selectedLanguage: Language;
  public languages: Language[];

  notifications: notifications[] = [];
  profiledd: profiledd[] = [];

  // Apps array supprimé - non nécessaire pour IBIS-X

  // Injections
  private settings = inject(CoreService);
  public translate = inject(TranslateService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog); // Injected MatDialog
  private languageService = inject(LanguageService);

  options = this.settings.getOptions();

  constructor() {
    // Initialiser les propriétés liées aux langues
    this.selectedLanguage = this.languageService.getCurrentLanguage();
    this.languages = this.languageService.availableLanguages;
    
    // S'abonner aux changements de langue
    this.languageService.currentLanguage$.subscribe(language => {
      this.selectedLanguage = language;
    });
  }

  ngOnInit(): void {
    // Charger les informations de l'utilisateur connecté
    this.loadUserInfo();
    // Initialiser les données traduites
    this.initializeTranslatedData();
    
    // Écouter les changements de langue pour recharger les traductions
    this.translate.onLangChange.subscribe(() => {
      this.initializeTranslatedData();
    });
  }

  /**
   * Initialise les données qui nécessitent des traductions
   */
  private initializeTranslatedData(): void {
    this.notifications = [
      {
        id: 1,
        img: '/assets/images/profile/user-1.jpg',
        title: this.translate.instant('NOTIFICATIONS.ML_PIPELINE_COMPLETED'),
        subtitle: this.translate.instant('NOTIFICATIONS.MODEL_READY'),
      },
      {
        id: 2,
        img: '/assets/images/profile/user-2.jpg',
        title: this.translate.instant('NOTIFICATIONS.NEW_XAI_EXPLANATION'),
        subtitle: this.translate.instant('NOTIFICATIONS.SHAP_GENERATED'),
      },
      {
        id: 3,
        img: '/assets/images/profile/user-3.jpg',
        title: this.translate.instant('NOTIFICATIONS.DATASET_UPDATED'),
        subtitle: this.translate.instant('NOTIFICATIONS.DATASET_SYNCHRONIZED'),
      },
      {
        id: 4,
        img: '/assets/images/profile/user-4.jpg',
        title: this.translate.instant('NOTIFICATIONS.ANALYSIS_COMPLETED'),
        subtitle: this.translate.instant('NOTIFICATIONS.PERFORMANCE_CALCULATED'),
      },
      {
        id: 5,
        img: '/assets/images/profile/user-5.jpg',
        title: this.translate.instant('NOTIFICATIONS.REPORT_GENERATED'),
        subtitle: this.translate.instant('NOTIFICATIONS.EXPLANATIONS_AVAILABLE'),
      },
    ];

    this.profiledd = [
      {
        id: 1,
        img: 'user',
        color: 'primary',
        title: this.translate.instant('HEADER.PROFILE_MENU.MY_PROFILE'),
        subtitle: this.translate.instant('HEADER.PROFILE_MENU.ACCOUNT_SETTINGS'),
        link: '/profile',
      },
      {
        id: 2,
        img: 'settings',
        color: 'success',
        title: this.translate.instant('HEADER.PROFILE_MENU.PREFERENCES'),
        subtitle: this.translate.instant('HEADER.PROFILE_MENU.IBIS_X_CONFIGURATION'),
        link: '/settings',
      },
      {
        id: 3,
        img: 'help',
        color: 'warning',
        title: this.translate.instant('HEADER.PROFILE_MENU.HELP_SUPPORT'),
        subtitle: this.translate.instant('HEADER.PROFILE_MENU.DOCUMENTATION'),
        link: '/help',
      },
    ];
  }


  
  /**
   * Charge les informations de l'utilisateur connecté
   */
  loadUserInfo(): void {
    if (this.authService.isAuthenticated()) {
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUser = user;
          this.userEmail = user.email;
          
          // Déterminer le nom à afficher par ordre de priorité
          if (user.pseudo) {
            // 1. Utiliser le pseudo s'il existe
            this.userDisplayName = user.pseudo;
          } else if (user.given_name && user.family_name) {
            // 2. Sinon utiliser le nom complet s'il existe (prénom + nom)
            this.userDisplayName = `${user.given_name} ${user.family_name}`;
          } else if (user.given_name) {
            // 3. Sinon juste le prénom s'il existe
            this.userDisplayName = user.given_name;
          } else {
            // 4. Sinon fallback sur l'email
            this.userDisplayName = user.email.split('@')[0];
          }
          
          // Utiliser l'image de profil si disponible
          if (user.picture) {
            this.userProfileImage = this.sanitizeGoogleImageUrl(user.picture);
          }
          
          // Définir le rôle
          if (user.is_superuser) {
            this.userRole = 'Admin';
          } else {
            this.userRole = 'Utilisateur';
          }
        },
        error: (error) => {
          console.error('Erreur lors du chargement des informations utilisateur', error);
          // Fallback sur des valeurs par défaut
          this.userDisplayName = 'Utilisateur';
        }
      });
    }
  }

  // Commented out openDialog to avoid compilation error
  /*
  openDialog() {
    const dialogRef = this.dialog.open(AppSearchDialogComponent);
    dialogRef.afterClosed().subscribe((result: any) => {
      console.log(`Dialog result: ${result}`);
    });
  }
  */

  // Other methods
  changeLanguage(lang: Language): void {
    this.languageService.setLanguage(lang);
  }

  setlightDark(theme: string) {
    this.options.theme = theme;
    this.emitOptions();
  }

  logout(): void {
    this.authService.logout();
  }

  private emitOptions() {
    this.optionsChange.emit(this.options);
  }

  /**
   * Sanitize Google profile image URLs to ensure they are displayable in Angular
   * and handle CORS issues with Google images
   */
  sanitizeGoogleImageUrl(url: string): string {
    // Vérifier si c'est une URL Google Photos
    if (url && url.includes('googleusercontent.com')) {
      console.log('Sanitizing Google image URL:', url);
      
      // Ajouter un paramètre pour éviter la mise en cache et les problèmes CORS
      // On ajoute =s200-c comme paramètre pour spécifier la taille et le recadrage
      if (!url.includes('=s')) {
        url = url.includes('?') ? `${url}&s=200-c` : `${url}=s200-c`;
      }
      
      // Vérifier si l'URL est accessible
      const img = new Image();
      img.onerror = () => {
        console.warn('Google profile image failed to load, using default image');
        this.userProfileImage = '/assets/images/profile/user5.jpg';
      };
      img.src = url;
      
      return url;
    }
    return url;
  }
}

// Assuming search dialog component is defined elsewhere or needs fixing
/*
@Component({
  selector: 'search-dialog',
  imports: [RouterModule, MaterialModule, TablerIconsModule, FormsModule],
  templateUrl: 'search-dialog.component.html',
})
export class AppSearchDialogComponent {
  searchText: string = '';
  navItems = navItems;
  navItemsData = navItems.filter((navitem) => navitem.displayName);
}
*/
