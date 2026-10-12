export const STUDIO_SECTIONS = {
  dashboard: 'Resumen', teams: 'Equipos', groups: 'Grupos', players: 'Jugadores',
  appearance: 'Apariencia', graphics: 'Gráficos', mainMenu: 'Menus',
  scenarios: 'Scenarios', stadiums: 'Estadios', audio: 'Audio',
  emulator: 'Emulador', settings: 'Configuración', project: 'Proyecto',
};

export const MENU_TABS = [
  { id: 'main', label: 'Menú principal' },
  { id: 'secondary', label: 'Menú secundario' },
  { id: 'settings', label: 'Menú settings' },
  { id: 'training', label: 'Menú training' },
  { id: 'handicap', label: 'Menú handicap' },
  { id: 'game', label: 'Menú juego' },
];

export function sectionLocation(section) {
  return section === 'dashboard' ? { name: 'Home' }
    : section === 'mainMenu' ? { name: 'menu-main' }
    : { name: `studio-${section}` };
}

export function studioRoutes(component) {
  return [
    {
      path: '/', name: 'Home', component, meta: { section: 'dashboard' },
      // Keep Home mounted while child metadata selects each editor. Explicit
      // empty components are required for these routes in Vue Router 4.0.
      children: [
        ...Object.keys(STUDIO_SECTIONS).filter(key => !['dashboard', 'mainMenu'].includes(key))
          .map(section => ({ path: section, name: `studio-${section}`, components: {}, meta: { section } })),
        { path: 'menus', components: {}, redirect: { name: 'menu-main' } },
        ...MENU_TABS.map(tab => ({
          path: `menus/${tab.id}`, name: `menu-${tab.id}`, components: {},
          meta: { section: 'mainMenu', menuTab: tab.id },
        })),
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'Home' } },
  ];
}
