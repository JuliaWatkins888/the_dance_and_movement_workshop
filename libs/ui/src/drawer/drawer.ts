import {
  showDrawer,
  requestDrawerClose,
  closeAllDrawers,
  type DrawerContent,
  type ShowDrawerOptions,
} from './drawerStore';

export type DrawerOptions = ShowDrawerOptions;

// The global dispatch API: `drawer.show(content, options)` slides a panel in from the left or
// right edge of the screen. Callable from anywhere - see drawerStore.ts for why this is a plain
// module-level object rather than something obtained from a hook/Context.
export const drawer = {
  show: (content: DrawerContent, options?: ShowDrawerOptions) => showDrawer(content, options),
  close: requestDrawerClose,
  closeAll: closeAllDrawers,
};
