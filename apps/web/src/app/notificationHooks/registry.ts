import type { NotificationEntity } from '@inithium/api-client';

export interface NotificationHookContext {
  readonly navigate: (url: string) => void;
}

export interface NotificationHookHandlers {
  // Omit to fall through to the default `navigate(actionUrl)` behavior even for a matched
  // notification (e.g. a hook that only cares about onMarkAllRead).
  readonly onClick?: (notification: NotificationEntity, ctx: NotificationHookContext) => void;
  readonly onMarkAllRead?: () => void;
}

// A plugin that needs custom behavior for its own notification types (rather than the default
// "navigate to actionUrl") drops one uniquely-named *.notification-hook.ts(x) file here,
// default-exporting one of these - the same zero-shared-file-edit convention
// @inithium/cms's own modules/widgets/settings-definitions/permissions-definitions registries
// already established, just on the web app's own side rather than inside a plugin lib. `.tsx` is
// supported alongside `.ts` since a hook's onClick commonly needs to render JSX (e.g. opening a
// dialog).
export interface NotificationHook extends NotificationHookHandlers {
  // Must be true for exactly this hook's own notification type(s) - two installed hooks both
  // matching the same notification is a plugin-authoring bug, not something resolved by
  // install order (see the dev-mode warning in app.tsx).
  readonly test: (notification: NotificationEntity) => boolean;
  // For a hook whose onClick/onMarkAllRead needs its own React state or a mutation trigger (e.g.
  // useSomeMutation()) rather than being a plain function - called unconditionally, once per
  // registered hook, at the top of the app shell on every render. Safe despite normally being a
  // "hook inside a loop": `notificationHooks` is a fixed array resolved once at module load via
  // eager import.meta.glob, so the exact same hooks run in the exact same order on every render,
  // which is all the rules of hooks actually require. When present, takes precedence over this
  // hook's own plain onClick/onMarkAllRead.
  readonly useHandlers?: () => NotificationHookHandlers;
}

const tsHookFiles = import.meta.glob<NotificationHook>('./*.notification-hook.ts', {
  eager: true,
  import: 'default',
});
const tsxHookFiles = import.meta.glob<NotificationHook>('./*.notification-hook.tsx', {
  eager: true,
  import: 'default',
});

export const notificationHooks: NotificationHook[] = [
  ...Object.values(tsHookFiles),
  ...Object.values(tsxHookFiles),
];

// Resolves every registered hook's handlers exactly once per render, calling each hook's own
// useHandlers() (if it declared one) rather than making app.tsx itself aware of which hooks need
// React state - see NotificationHook.useHandlers's own comment on why this is safe to call from
// inside a loop.
export const useResolvedNotificationHooks = (): Array<{ test: NotificationHook['test'] } & NotificationHookHandlers> =>
  // eslint-disable-next-line react-hooks/rules-of-hooks -- notificationHooks is a fixed, eagerly-
  // resolved array; the same hooks run in the same order on every render.
  notificationHooks.map((hook) => ({
    test: hook.test,
    ...(hook.useHandlers ? hook.useHandlers() : { onClick: hook.onClick, onMarkAllRead: hook.onMarkAllRead }),
  }));
