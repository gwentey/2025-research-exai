import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Navigation',
  },
  {
    displayName: 'Tableau de bord',
    iconName: 'dashboard',
    bgcolor: 'primary',
    route: '/starter',
  },
  {
    navCap: 'Données & Analyse',
  },
  {
    displayName: 'Datasets',
    iconName: 'database',
    bgcolor: 'accent',
    route: '/datasets',
  },
  {
    displayName: 'Pipeline ML',
    iconName: 'chart-dots',
    bgcolor: 'warning',
    route: '/ml-pipeline',
    disabled: true, // À activer quand le module sera implémenté
  },
  {
    displayName: 'Explications XAI',
    iconName: 'bulb',
    bgcolor: 'success',
    route: '/xai-explanations',
    disabled: true, // À activer quand le module sera implémenté
  },
];
