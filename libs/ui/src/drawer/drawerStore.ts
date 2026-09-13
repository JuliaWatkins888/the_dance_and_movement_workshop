import type { ReactNode } from 'react';
import type { AnimationSpec } from '../tokens/animation';
import type { DrawerSide } from '../tokens/drawer';

export interface DrawerRenderContext {
  readonly close: () => void;
}

export type DrawerContent = ReactNode | ((context: DrawerRenderContext) => ReactNode);

export interface DrawerRecord {
  readonly id: string;
  readonly content: DrawerContent;
  readonly title?: string;
  readonly description?: string;
  readonly side: DrawerSide;
  readonly width?: number | string;
  readonly closeable: boolean;
  readonly closeOnOverlayClick: boolean;
  readonly closeOnEscape: boolean;
  readonly animation?: AnimationSpec;
  readonly onClose?: () => void;
  readonly closing: boolean;
}

export interface ShowDrawerOptions {
  readonly side?: DrawerSide;
  readonly title?: string;
  readonly description?: string;
  readonly width?: number | string;
  readonly closeable?: boolean;
  readonly closeOnOverlayClick?: boolean;
  readonly closeOnEscape?: boolean;
  readonly animation?: AnimationSpec;
  readonly onClose?: () => void;
}

type Listener = () => void;

// Module-level pub/sub, exactly mirroring dialogStore.ts and alertStore.ts and for the same
// reason: any code - a component, a plugin, a non-React module - can call `drawer.show(...)`
// (see drawer.ts) without needing to sit inside a Provider anywhere in the tree. DrawerContainer
// is the only piece that needs a fixed spot (mounted once, anywhere) for drawers to actually
// render; dispatching one never depends on where that mount point is.
let records: DrawerRecord[] = [];
const listeners = new Set<Listener>();
let nextId = 0;

const emit = () => listeners.forEach((listener) => listener());

export const subscribeToDrawers = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getDrawerRecords = (): DrawerRecord[] => records;

export const showDrawer = (content: DrawerContent, options: ShowDrawerOptions = {}): string => {
  const id = `drawer-${Date.now()}-${nextId++}`;
  const {
    side = 'right',
    title,
    description,
    width,
    closeable = true,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    animation,
    onClose,
  } = options;

  records = [
    ...records,
    {
      id,
      content,
      title,
      description,
      side,
      width,
      closeable,
      closeOnOverlayClick,
      closeOnEscape,
      animation,
      onClose,
      closing: false,
    },
  ];
  emit();
  return id;
};

// Marks a record as closing (so DrawerContainer switches its rendered Drawer/overlay to
// `trigger="exit"`) without removing it yet - actual removal happens once the exit animation
// has had time to play (DrawerContainer times that via resolveAnimationDurationMs). Every
// dismissal path - the close button, an overlay click, Escape, or a direct `drawer.close(id)`
// call - funnels through this one function, so all four get the same graceful exit.
export const requestDrawerClose = (id: string): void => {
  const record = records.find((r) => r.id === id);
  if (!record || record.closing) return;

  records = records.map((r) => (r.id === id ? { ...r, closing: true } : r));
  emit();
};

export const removeDrawer = (id: string): void => {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  records = records.filter((r) => r.id !== id);
  emit();
  record.onClose?.();
};

export const closeAllDrawers = (): void => {
  records.forEach((record) => requestDrawerClose(record.id));
};
