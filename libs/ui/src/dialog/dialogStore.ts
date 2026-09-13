import type { ReactNode } from 'react';
import type { AnimationSpec } from '../tokens/animation';

export interface DialogRenderContext {
  readonly close: () => void;
}

export type DialogContent = ReactNode | ((context: DialogRenderContext) => ReactNode);

export interface DialogRecord {
  readonly id: string;
  readonly content: DialogContent;
  readonly title?: string;
  readonly description?: string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly closeable: boolean;
  readonly closeOnOverlayClick: boolean;
  readonly closeOnEscape: boolean;
  readonly animation?: AnimationSpec;
  readonly onClose?: () => void;
  readonly closing: boolean;
}

export interface ShowDialogOptions {
  readonly title?: string;
  readonly description?: string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly closeable?: boolean;
  readonly closeOnOverlayClick?: boolean;
  readonly closeOnEscape?: boolean;
  readonly animation?: AnimationSpec;
  readonly onClose?: () => void;
}

type Listener = () => void;

// Module-level pub/sub, exactly mirroring alertStore.ts and for the same reason: any code -
// a component, a plugin, a non-React module - can call `dialog.show(...)`/`dialog.confirm(...)`
// (see dialog.ts) without needing to sit inside a Provider anywhere in the tree. DialogContainer
// is the only piece that needs a fixed spot (mounted once, anywhere) for dialogs to actually
// render; dispatching one never depends on where that mount point is.
let records: DialogRecord[] = [];
const listeners = new Set<Listener>();
let nextId = 0;

const emit = () => listeners.forEach((listener) => listener());

export const subscribeToDialogs = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getDialogRecords = (): DialogRecord[] => records;

export const showDialog = (content: DialogContent, options: ShowDialogOptions = {}): string => {
  const id = `dialog-${Date.now()}-${nextId++}`;
  const {
    title,
    description,
    width,
    height,
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
      width,
      height,
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

// Marks a record as closing (so DialogContainer switches its rendered Dialog/overlay to
// `trigger="exit"`) without removing it yet - actual removal happens once the exit animation
// has had time to play (DialogContainer times that via resolveAnimationDurationMs). Every
// dismissal path - the close button, an overlay click, Escape, or a direct `dialog.close(id)`
// call - funnels through this one function, so all four get the same graceful exit.
export const requestDialogClose = (id: string): void => {
  const record = records.find((r) => r.id === id);
  if (!record || record.closing) return;

  records = records.map((r) => (r.id === id ? { ...r, closing: true } : r));
  emit();
};

export const removeDialog = (id: string): void => {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  records = records.filter((r) => r.id !== id);
  emit();
  record.onClose?.();
};

export const closeAllDialogs = (): void => {
  records.forEach((record) => requestDialogClose(record.id));
};
