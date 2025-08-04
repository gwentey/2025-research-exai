import { BreakpointObserver, MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSidenav, MatSidenavContent } from '@angular/material/sidenav';
import { CoreService } from 'src/app/services/core.service';
import { AppSettings } from 'src/app/config';
import { filter } from 'rxjs/operators';
import { NavigationEnd, Router } from '@angular/router';
import { navItems, getTranslatedNavItems, getTranslatedNavItemsWithRoles } from './vertical/sidebar/sidebar-data';
import { NavService } from '../../services/nav.service';
import { RoleService, UserRole } from '../../services/role.service';
import { TranslateService } from '@ngx-translate/core';
import { AppNavItemComponent } from './vertical/sidebar/nav-item/nav-item.component';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './vertical/sidebar/sidebar.component';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { VerticalHeaderComponent } from './vertical/header/header.component';
import { HorizontalHeaderComponent } from './horizontal/header/header.component';
import { AppHorizontalSidebarComponent } from './horizontal/sidebar/sidebar.component';
import { AppBreadcrumbComponent } from './shared/breadcrumb/breadcrumb.component';
import { CustomizerComponent } from './shared/customizer/customizer.component';
import { BrandingComponent } from './vertical/sidebar/branding.component';
import { AuthService } from 'src/app/services/auth.service';
import { UserRead } from 'src/app/models/auth.models';

const MOBILE_VIEW = 'screen and (max-width: 768px)';
const TABLET_VIEW = 'screen and (min-width: 769px) and (max-width: 1024px)';
const MONITOR_VIEW = 'screen and (min-width: 1024px)';
const BELOWMONITOR = 'screen and (max-width: 1023px)';

// for mobile app sidebar
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
    selector: 'app-full',
    imports: [
        RouterModule,
        AppNavItemComponent,
        MaterialModule,
        CommonModule,
        SidebarComponent,
        NgScrollbarModule,
        TablerIconsModule,
        VerticalHeaderComponent,
        HorizontalHeaderComponent,
        AppHorizontalSidebarComponent,
        AppBreadcrumbComponent,
        CustomizerComponent,
        BrandingComponent
    ],
    templateUrl: './full.component.html',
    styleUrls: [],
    encapsulation: ViewEncapsulation.None
})
export class FullComponent implements OnInit {
  navItems = navItems;

  // Informations de l'utilisateur actuel
  currentUser: UserRead | null = null;
  userDisplayName: string = 'Chargement...';
  userRole: string = 'Utilisateur';
  userEmail: string = '';
  userProfileImage: string = '/assets/images/profile/user5.jpg'; // Image par défaut

  @ViewChild('leftsidenav')
  public sidenav: MatSidenav;
  
  @ViewChild('mobilesidenav')
  public mobilesidenav: MatSidenav;
  resView = false;
  @ViewChild('content', { static: true }) content!: MatSidenavContent;
  //get options from service
  options = this.settings.getOptions();
  private layoutChangesSubscription = Subscription.EMPTY;
  private isMobileScreen = false;
  private isContentWidthFixed = true;
  private isCollapsedWidthFixed = false;
  private htmlElement!: HTMLHtmlElement;

  get isOver(): boolean {
    return this.isMobileScreen;
  }

  get isTablet(): boolean {
    return this.resView;
  }

  // for mobile app sidebar
  apps: apps[] = [
    {
      id: 1,
      img: '/assets/images/svgs/icon-dd-chat.svg',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/apps/chat',
    },
    {
      id: 2,
      img: '/assets/images/svgs/icon-dd-cart.svg',
      title: 'eCommerce App',
      subtitle: 'Buy a Product',
      link: '/apps/email/inbox',
    },
    {
      id: 3,
      img: '/assets/images/svgs/icon-dd-invoice.svg',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/apps/invoice',
    },
    {
      id: 4,
      img: '/assets/images/svgs/icon-dd-date.svg',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/apps/calendar',
    },
    {
      id: 5,
      img: '/assets/images/svgs/icon-dd-mobile.svg',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/apps/contacts',
    },
    {
      id: 6,
      img: '/assets/images/svgs/icon-dd-lifebuoy.svg',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/apps/tickets',
    },
    {
      id: 7,
      img: '/assets/images/svgs/icon-dd-message-box.svg',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/apps/email/inbox',
    },
    {
      id: 8,
      img: '/assets/images/svgs/icon-dd-application.svg',
      title: 'Courses',
      subtitle: 'Create new course',
      link: '/apps/courses',
    },
  ];

  quicklinks: quicklinks[] = [
    {
      id: 1,
      title: 'Pricing Page',
      link: '/theme-pages/pricing',
    },
    {
      id: 2,
      title: 'Authentication Design',
      link: '/authentication/login',
    },
    {
      id: 3,
      title: 'Register Now',
      link: '/authentication/side-register',
    },
    {
      id: 4,
      title: '404 Error Page',
      link: '/authentication/error',
    },
    {
      id: 5,
      title: 'Notes App',
      link: '/apps/notes',
    },
    {
      id: 6,
      title: 'Employee App',
      link: '/apps/employee',
    },
    {
      id: 7,
      title: 'Todo Application',
      link: '/apps/todo',
    },
    {
      id: 8,
      title: 'Treeview',
      link: '/theme-pages/treeview',
    },
  ];

  constructor(
    private settings: CoreService,
    private mediaMatcher: MediaMatcher,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private navService: NavService,
    private authService: AuthService,
    private roleService: RoleService,
    private translate: TranslateService
  ) {
    this.htmlElement = document.querySelector('html')!;
    this.layoutChangesSubscription = this.breakpointObserver
      .observe([MOBILE_VIEW, TABLET_VIEW, MONITOR_VIEW, BELOWMONITOR])
      .subscribe((state) => {
        // SidenavOpened must be reset true when layout changes
        this.options.sidenavOpened = true;
        this.isMobileScreen = state.breakpoints[BELOWMONITOR];
        if (this.options.sidenavCollapsed == false) {
          this.options.sidenavCollapsed = state.breakpoints[TABLET_VIEW];
        }
        this.isContentWidthFixed = state.breakpoints[MONITOR_VIEW];
        this.resView = state.breakpoints[BELOWMONITOR];
      });

    // Initialize project theme with options
    this.receiveOptions(this.options);
    
    // This is for scroll to top
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((e) => {
        this.content.scrollTo({ top: 0 });
      });
  }

  ngOnInit(): void {
    // Charger les informations de l'utilisateur connecté
    this.loadUserInfo();
    
    // Initialiser les navItems traduits avec rôles
    this.updateNavItems();
    
    // Écouter les changements de langue pour mettre à jour les navItems
    this.translate.onLangChange.subscribe(() => {
      this.updateNavItems();
    });
    
    // Écouter les changements de rôle pour mettre à jour les navItems
    this.roleService.getCurrentRole().subscribe(() => {
      this.updateNavItems();
    });
  }

  /**
   * Met à jour les navItems avec les traductions et les rôles
   */
  private updateNavItems(): void {
    const currentRole = this.roleService.getCurrentRoleSync();
    this.navItems = getTranslatedNavItemsWithRoles(this.translate, currentRole);
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
          
          // Définir le rôle basé sur le nouveau système
          if (user.role) {
            this.userRole = this.roleService.getRoleDisplayName(user.role as UserRole);
          } else if (user.is_superuser) {
            this.userRole = 'Admin';
          } else {
            this.userRole = 'Utilisateur';
          }
          
          // Rafraîchir le rôle dans le RoleService pour déclencher la mise à jour de la navigation
          this.roleService.refreshCurrentRole();
        },
        error: (error) => {
          console.error('Erreur lors du chargement des informations utilisateur', error);
          // Fallback sur des valeurs par défaut
          this.userDisplayName = 'Utilisateur';
        }
      });
    }
  }

  /**
   * Sanitize Google profile image URLs to ensure they are displayable in Angular
   * and handle CORS issues with Google images
   */
  sanitizeGoogleImageUrl(url: string): string {
    // Vérifier si c'est une URL Google Photos
    if (url && url.includes('googleusercontent.com')) {
      // Ajouter un paramètre pour éviter la mise en cache et les problèmes CORS
      // On ajoute =s200-c comme paramètre pour spécifier la taille et le recadrage
      if (!url.includes('=s')) {
        url = url.includes('?') ? `${url}&s=200-c` : `${url}=s200-c`;
      }
      return url;
    }
    return url;
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    this.authService.logout();
  }

  ngOnDestroy() {
    this.layoutChangesSubscription.unsubscribe();
  }

  toggleCollapsed() {
    this.isContentWidthFixed = false;
    this.options.sidenavCollapsed = !this.options.sidenavCollapsed;
    this.resetCollapsedState();
  }

  resetCollapsedState(timer = 400) {
    setTimeout(() => this.settings.setOptions(this.options), timer);
  }

  onSidenavClosedStart() {
    this.isContentWidthFixed = false;
  }

  onSidenavOpenedChange(isOpened: boolean) {
    this.isCollapsedWidthFixed = !this.isOver;
    this.options.sidenavOpened = isOpened;
    this.settings.setOptions(this.options);
  }

  receiveOptions(options: AppSettings): void {
    //this.options = options;
    
    this.toggleDarkTheme(options);
    this.toggleColorsTheme(options);
  }

  toggleActiveSidenav(): void {
    // Toggle the appropriate sidenav based on the current view mode
    if (this.resView && this.mobilesidenav) {
      this.mobilesidenav.toggle();
    } else if (this.sidenav) {
      this.sidenav.toggle();
    }
  }

  toggleDarkTheme(options: AppSettings) {
    
    if (options.theme === 'dark') {
      this.htmlElement.classList.add('dark-theme');
      this.htmlElement.classList.remove('light-theme');
    } else {
      this.htmlElement.classList.remove('dark-theme');
      this.htmlElement.classList.add('light-theme');
    }
  }

  toggleColorsTheme(options: AppSettings) {
    // Remove any existing theme class dynamically
    this.htmlElement.classList.forEach((className) => {
      if (className.endsWith('_theme')) {
        this.htmlElement.classList.remove(className);
      }
    });

    // Add the selected theme class
    this.htmlElement.classList.add(options.activeTheme);
  }
}
