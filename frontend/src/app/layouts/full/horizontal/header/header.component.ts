import { Component, Output, EventEmitter, Input, OnInit, inject } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog } from '@angular/material/dialog';
import { navItems } from '../../vertical/sidebar/sidebar-data';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { AppSettings } from 'src/app/config';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AuthService } from 'src/app/services/auth.service';
import { BrandingComponent } from '../../vertical/sidebar/branding.component';
import { UserRead } from 'src/app/models/auth.models';
import { UserNameDisplayComponent } from 'src/app/components/user-name-display';
// Commented out potentially problematic import
// import { AppHorizontalSearchDialogComponent } from './search-dialog.component';

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

interface apps {
  id: number;
  img: string;
  title: string;
  subtitle: string;
  link: string;
}

interface quicklinks {
  id: number;
  title: string;
  link: string;
}

@Component({
  selector: 'app-horizontal-header',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
    TranslateModule,
    FormsModule,
    BrandingComponent,
    UserNameDisplayComponent,
  ],
  templateUrl: './header.component.html',
})
export class HorizontalHeaderComponent implements OnInit {
  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

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

  @Output() optionsChange = new EventEmitter<AppSettings>();

  public selectedLanguage: any = {
    language: 'English',
    code: 'en',
    type: 'US',
    icon: '/assets/images/flag/icon-flag-en.svg',
  };

  public languages: any[] = [
    {
      language: 'English',
      code: 'en',
      type: 'US',
      icon: '/assets/images/flag/icon-flag-en.svg',
    },
    {
      language: 'Español',
      code: 'es',
      icon: '/assets/images/flag/icon-flag-es.svg',
    },
    {
      language: 'Français',
      code: 'fr',
      icon: '/assets/images/flag/icon-flag-fr.svg',
    },
    {
      language: 'German',
      code: 'de',
      icon: '/assets/images/flag/icon-flag-de.svg',
    },
  ];

  private settings = inject(CoreService);
  public translate = inject(TranslateService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);

  constructor() {
    this.translate.setDefaultLang('en');
  }

  ngOnInit(): void {
    // Charger les informations de l'utilisateur connecté
    this.loadUserInfo();
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

  logout(): void {
    this.authService.logout();
  }

  /**
   * Détermine si l'email doit être affiché selon sa largeur par rapport à la référence
   */
  shouldShowEmail(): boolean {
    if (!this.userEmail) return false;
    
    // Créer un canvas pour mesurer
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return true; // Fallback : afficher si on ne peut pas mesurer
    
    // Utiliser la même police que le composant (f-s-14 f-w-400)
    const fontFamily = '"Plus Jakarta Sans", sans-serif';
    context.font = '400 14px ' + fontFamily;
    
    // Mesurer les deux textes
    const referenceWidth = context.measureText('anthonyoutub@gmail.com').width;
    const emailWidth = context.measureText(this.userEmail).width;
    
    // Afficher seulement si l'email n'est pas plus large que la référence
    return emailWidth <= referenceWidth;
  }

  // Commented out openDialog method to avoid compilation error
  /*
  openDialog() {
    const dialogRef = this.dialog.open(AppHorizontalSearchDialogComponent);
    dialogRef.afterClosed().subscribe((result: any) => {
      console.log(`Dialog result: ${result}`);
    });
  }
  */

  changeLanguage(lang: any): void {
    this.translate.use(lang.code);
    this.selectedLanguage = lang;
  }

  options = this.settings.getOptions();

  private emitOptions() {
    this.optionsChange.emit(this.options);
  }



  notifications: notifications[] = [
    {
      id: 1,
      img: '/assets/images/profile/user-1.jpg',
      title: 'Roman Joined the Team!',
      subtitle: 'Congratulate him',
    },
    {
      id: 2,
      img: '/assets/images/profile/user-2.jpg',
      title: 'New message received',
      subtitle: 'Salma sent you new message',
    },
    {
      id: 3,
      img: '/assets/images/profile/user-3.jpg',
      title: 'New Payment received',
      subtitle: 'Check your earnings',
    },
    {
      id: 4,
      img: '/assets/images/profile/user-4.jpg',
      title: 'Jolly completed tasks',
      subtitle: 'Assign her new tasks',
    },
    {
      id: 5,
      img: '/assets/images/profile/user-5.jpg',
      title: 'Hitesh Joined the Team!',
      subtitle: 'Congratulate him',
    },
  ];

  profiledd: profiledd[] = [
    {
      id: 1,
      img: 'wallet',
      color: 'primary',
      title: 'My Profile',
      subtitle: 'Account Settings',
      link: '/',
    },
    {
      id: 2,
      img: 'shield',
      color: 'success',
      title: 'My Inbox',
      subtitle: 'Messages & Email',
      link: '/',
    },
    {
      id: 3,
      img: 'credit-card',
      color: 'error',
      title: 'My Tasks',
      subtitle: 'To-do and Daily Tasks',
      link: '/',
    },
  ];

  apps: apps[] = [
    {
      id: 1,
      img: '/assets/images/svgs/icon-dd-chat.svg',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/',
    },
    {
      id: 2,
      img: '/assets/images/svgs/icon-dd-cart.svg',
      title: 'eCommerce App',
      subtitle: 'Buy a Product',
      link: '/',
    },
    {
      id: 3,
      img: '/assets/images/svgs/icon-dd-invoice.svg',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/',
    },
    {
      id: 4,
      img: '/assets/images/svgs/icon-dd-date.svg',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/',
    },
    {
      id: 5,
      img: '/assets/images/svgs/icon-dd-mobile.svg',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/',
    },
    {
      id: 6,
      img: '/assets/images/svgs/icon-dd-lifebuoy.svg',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/',
    },
    {
      id: 7,
      img: '/assets/images/svgs/icon-dd-message-box.svg',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/',
    },
    {
      id: 8,
      img: '/assets/images/svgs/icon-dd-application.svg',
      title: 'Courses',
      subtitle: 'Create new course',
      link: '/',
    },
  ];

  quicklinks: quicklinks[] = [
    {
      id: 1,
      title: 'Pricing Page',
      link: '/',
    },
    {
      id: 2,
      title: 'Authentication Design',
      link: '/',
    },
    {
      id: 3,
      title: 'Register Now',
      link: '/',
    },
    {
      id: 4,
      title: '404 Error Page',
      link: '/',
    },
    {
      id: 5,
      title: 'Notes App',
      link: '/',
    },
    {
      id: 6,
      title: 'Employee App',
      link: '/',
    },
    {
      id: 7,
      title: 'Todo Application',
      link: '/',
    },
    {
      id: 8,
      title: 'Treeview',
      link: '/',
    },
  ];

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

@Component({
  selector: 'app-search-dialog',
  imports: [RouterModule, MaterialModule, TablerIconsModule, FormsModule],
  templateUrl: 'search-dialog.component.html',
})
export class AppHorizontalSearchDialogComponent {
  searchText: string = '';
  navItems = navItems;

  navItemsData = navItems.filter((navitem) => navitem.displayName);

  // filtered = this.navItemsData.find((obj) => {
  //   return obj.displayName == this.searchinput;
  // });
}
