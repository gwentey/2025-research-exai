import { NavItem } from './nav-item/nav-item';
import { TranslateService } from '@ngx-translate/core';

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
