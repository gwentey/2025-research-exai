import { NavItem } from '../../vertical/sidebar/nav-item/nav-item';

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
    displayName: 'Login',
    iconName: 'lock',
    bgcolor: 'secondary',
    route: '/authentication/login',
  },
  {
    navCap: 'Other',
  },
  {
    displayName: 'Menu Level',
    iconName: 'box-multiple',
    bgcolor: 'error',
    route: 'menu-level',
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
    bgcolor: 'success',
    route: '/disabled',
    disabled: true,
  },
];
