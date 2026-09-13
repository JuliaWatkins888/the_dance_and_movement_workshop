import { Box } from '../components/Box/Box';
import { Button } from '../components/Button/Button';
import {
  showDialog,
  requestDialogClose,
  closeAllDialogs,
  type DialogContent,
  type ShowDialogOptions,
} from './dialogStore';
import type { ButtonVariantSpec } from '../tokens/button';

export type DialogOptions = ShowDialogOptions;

export interface ConfirmDialogOptions {
  readonly title?: string;
  readonly description?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly confirmVariant?: ButtonVariantSpec;
  readonly width?: number | string;
}

const DEFAULT_CONFIRM_VARIANT: ButtonVariantSpec = { kind: 'filled', color: 'primary', intensity: 500 };

// Built on top of `dialog.show` rather than a separate mechanism - a confirm dialog is just
// a dialog whose content is two buttons, and whose result is surfaced as a Promise instead of
// a callback. Dismissing any other way (overlay click, Escape, the close button) resolves
// `false` via the same `onClose` every other dismissal path already funnels through.
const confirmDialog = (options: ConfirmDialogOptions = {}): Promise<boolean> => {
  const {
    title = 'Are you sure?',
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = DEFAULT_CONFIRM_VARIANT,
    width,
  } = options;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    showDialog(
      ({ close }) => (
        <Box flex={{ direction: 'row', justify: 'end', gap: 8 }}>
          <Button
            variant={{ kind: 'ghost', color: 'surface', intensity: 700 }}
            onClick={() => {
              settle(false);
              close();
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              settle(true);
              close();
            }}
          >
            {confirmLabel}
          </Button>
        </Box>
      ),
      { title, description, width, onClose: () => settle(false) },
    );
  });
};

// The global dispatch API: `dialog.show(content, options)` renders anything (a confirm prompt,
// a custom editor, a form) inside the centered, animated overlay; `dialog.confirm(...)` is a
// Promise-based convenience for the yes/no case. Callable from anywhere - see dialogStore.ts
// for why this is a plain module-level object rather than something obtained from a hook/Context.
export const dialog = {
  show: (content: DialogContent, options?: ShowDialogOptions) => showDialog(content, options),
  confirm: confirmDialog,
  close: requestDialogClose,
  closeAll: closeAllDialogs,
};
