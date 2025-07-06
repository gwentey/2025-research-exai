import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Home',
  },
  {
    displayName: 'Starter',
    iconName: 'home',
    bgcolor: 'primary',
    route: '/starter',
  },
  {
    navCap: 'Données & Ressources',
  },
  {
    displayName: 'Datasets',
    iconName: 'database',
    bgcolor: 'accent',
    route: '/datasets',
  },
  {
    navCap: 'Authentification',
  },
  {
    displayName: 'Login',
    iconName: 'lock',
    bgcolor: 'secondary',
    route: '/authentication/login',
  },
  {
    displayName: 'Register',
    iconName: 'user-edit',
    bgcolor: 'success',
    route: '/authentication/register',
  },
  {
    navCap: 'Other',
  },
  {
    displayName: 'Menu Level',
    iconName: 'box-multiple',
    bgcolor: 'error',
    route: '/menu-level',
    children: [
      {
        displayName: 'Menu 1',
        iconName: 'point',
        route: '/menu-1',
        children: [
          {
            displayName: 'Menu 1',
            iconName: 'point',
            route: '/menu-1',
          },

          {
            displayName: 'Menu 2',
            iconName: 'point',
            route: '/menu-2',
          },
        ],
      },

      {
        displayName: 'Menu 2',
        iconName: 'point',
        route: '/menu-2',
      },
    ],
  },
  {
    displayName: 'Disabled',
    iconName: 'ban',
    route: '/disabled',
    disabled: true,
  },
  {
    displayName: 'Chip',
    iconName: 'mood-smile',
    route: '/',
    chip: true,
    chipClass: 'bg-primary text-white',
    chipContent: '9',
  },
  {
    displayName: 'Outlined',
    iconName: 'mood-smile',
    route: '/',
    chip: true,
    chipClass: 'b-1 border-primary text-primary',
    chipContent: 'outlined',
  },
  {
    displayName: 'External Link',
    iconName: 'star',
    route: 'https://www.google.com/',
    external: true,
  },
];
