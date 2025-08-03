import { NavItem } from './nav-item/nav-item';
import { TranslateService } from '@ngx-translate/core';
import { UserRole } from '../../../../services/role.service';

// Version statique pour compatibilité (fallback en anglais)
export const navItems: NavItem[] = [
  {
    navCap: 'Navigation',
  },
  {
    displayName: 'Dashboard',
    iconName: 'dashboard',
    bgcolor: 'primary',
    route: '/starter',
  },
  {
    navCap: 'Data & Analysis',
  },
  {
    displayName: 'Datasets',
    iconName: 'database',
    bgcolor: 'accent',
    route: '/datasets',
  },
  {
    displayName: 'Projects',
    iconName: 'folder',
    bgcolor: 'primary',
    route: '/projects',
  },
  {
    displayName: 'ML Pipeline',
    iconName: 'chart-dots',
    bgcolor: 'warning',
    route: '/ml-pipeline',
    disabled: false, // Module maintenant actif !
  },
  {
    displayName: 'XAI Explanations',
    iconName: 'bulb',
    bgcolor: 'success',
    route: '/xai-explanations',
    disabled: true, // À activer quand le module sera implémenté
  },
];

// Fonction pour générer les navItems avec traductions
export function getTranslatedNavItems(translate: TranslateService): NavItem[] {
  return [
    {
      navCap: translate.instant('MENU.NAVIGATION') || 'Navigation',
    },
    {
      displayName: translate.instant('MENU.DASHBOARD') || 'Dashboard',
      iconName: 'dashboard',
      bgcolor: 'primary',
      route: '/starter',
    },
    {
      navCap: translate.instant('MENU.DATA_ANALYSIS') || 'Data & Analysis',
    },
    {
      displayName: translate.instant('MENU.DATASETS') || 'Datasets',
      iconName: 'database',
      bgcolor: 'accent',
      route: '/datasets',
    },
    {
      displayName: translate.instant('MENU.PROJECTS') || 'Projects',
      iconName: 'folder',
      bgcolor: 'primary',
      route: '/projects',
    },
    {
      displayName: translate.instant('MENU.ML_PIPELINE') || 'ML Pipeline',
      iconName: 'chart-dots',
      bgcolor: 'warning',
      route: '/ml-pipeline',
      disabled: false, // Module maintenant actif !
    },
    {
      displayName: translate.instant('MENU.XAI_EXPLANATIONS') || 'XAI Explanations',
      iconName: 'bulb',
      bgcolor: 'success',
      route: '/xai-explanations',
      disabled: true, // À activer quand le module sera implémenté
    },
  ];
}

// Fonction pour générer les navItems avec traductions et rôles
export function getTranslatedNavItemsWithRoles(translate: TranslateService, userRole: UserRole | null): NavItem[] {
  const baseItems: NavItem[] = [
    {
      navCap: translate.instant('MENU.NAVIGATION') || 'Navigation',
    },
    {
      displayName: translate.instant('MENU.DASHBOARD') || 'Dashboard',
      iconName: 'dashboard',
      bgcolor: 'primary',
      route: '/starter',
    },
    {
      navCap: translate.instant('MENU.DATA_ANALYSIS') || 'Data & Analysis',
    },
    {
      displayName: translate.instant('MENU.DATASETS') || 'Datasets',
      iconName: 'database',
      bgcolor: 'accent',
      route: '/datasets',
    },
    {
      displayName: translate.instant('MENU.PROJECTS') || 'Projects',
      iconName: 'folder',
      bgcolor: 'primary',
      route: '/projects',
    },
    {
      displayName: translate.instant('MENU.ML_PIPELINE') || 'ML Pipeline',
      iconName: 'chart-dots',
      bgcolor: 'warning',
      route: '/ml-pipeline',
      disabled: false, // Module maintenant actif !
    },
    {
      displayName: translate.instant('MENU.XAI_EXPLANATIONS') || 'XAI Explanations',
      iconName: 'bulb',
      bgcolor: 'success',
      route: '/xai-explanations',
      disabled: true, // À activer quand le module sera implémenté
    },
  ];

  // Ajouter le menu d'administration pour les administrateurs
  if (userRole === UserRole.ADMIN) {
    // Insérer le menu admin après "Data & Analysis" (position 3)
    const adminItems: NavItem[] = [
      {
        navCap: translate.instant('MENU.ADMINISTRATION') || 'Administration',
      },
      {
        displayName: translate.instant('MENU.ADMIN_DASHBOARD') || 'Administration',
        iconName: 'settings',
        bgcolor: 'error',
        route: '/admin',
      },
      {
        displayName: translate.instant('MENU.DATASET_MANAGEMENT') || 'Gestion Datasets',
        iconName: 'database-edit',
        bgcolor: 'error',
        route: '/admin/datasets',
      },
      {
        displayName: translate.instant('MENU.USER_MANAGEMENT') || 'Gestion Utilisateurs',
        iconName: 'users',
        bgcolor: 'error',
        route: '/admin/users',
      },
      {
        displayName: translate.instant('MENU.ETHICAL_TEMPLATES') || 'Templates Éthiques',
        iconName: 'shield-check',
        bgcolor: 'error',
        route: '/admin/ethical-templates',
      },
    ];

    // Insérer les éléments admin après "XAI Explanations"
    baseItems.splice(baseItems.length, 0, ...adminItems);
  }

  return baseItems;
}
