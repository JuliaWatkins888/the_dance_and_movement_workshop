import type { ComponentType } from 'react';

export interface NavbarActionDescriptor {
  readonly id: string;
  readonly order?: number;
  // Rendered inside the Navbar's action slot (left of the notification bell / login button) for
  // every visitor - the component reads auth itself (useCurrentUser) if it cares who's signed in.
  readonly Component: ComponentType;
}

// Any plugin that wants a control in the top bar (a cart button, a quick-create shortcut) drops
// its own uniquely-named *.navbar-action.tsx file here, default-exporting a
// NavbarActionDescriptor - the same zero-shared-file-edit import.meta.glob convention as the
// profile tabs and CMS module registries, so no plugin ever needs to own Navbar.tsx itself.
const actionFiles = import.meta.glob<NavbarActionDescriptor>('./*.navbar-action.tsx', { eager: true, import: 'default' });

export const navbarActions: NavbarActionDescriptor[] = Object.values(actionFiles).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);
