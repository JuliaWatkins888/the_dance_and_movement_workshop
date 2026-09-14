import { useId, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Box, Icon, Input, Text } from '../components';
import { FieldShell } from '../components/FieldShell/FieldShell';
import { mergeClassNames } from '../theme/mergeClassNames';
import { resolvePhosphorIcon } from '../utils/resolvePhosphorIcon';
import { CURATED_ICON_GROUPS } from '../tokens/iconPicker';
import type { IconName } from '../tokens/icon';
import type { FieldProps } from '../tokens/field';

export interface IconPickerProps extends FieldProps {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (iconName: string) => void;
  readonly placeholder?: string;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
}

// Real room for a legible 6-column icon grid regardless of how narrow the trigger's own
// container happens to be - same reasoning as ColorPicker's own MIN_PANEL_WIDTH.
const MIN_PANEL_WIDTH = 260;

// Unlike ColorPicker (a hand-rolled absolutely-positioned panel - see composites/ColorPicker.tsx),
// this is built on Radix's Popover: the panel here is materially taller (a searchable, grouped
// ~60-icon grid vs. ColorPicker's compact two-tab swatch grid), and a plain absolute-positioned
// panel gets silently clipped by Dialog's own `overflow-auto` the moment it's used inside a CMS
// edit dialog - confirmed while building the Policies/Pages icon fields this replaces. Popover.
// Content portals to document.body and Radix computes its own collision-aware position/max-height
// against the real viewport, which sidesteps that clipping entirely rather than working around it
// with manual position math - the same portal-based escape-hatch DialogContainer already relies
// on for its own overlay (see components/DialogContainer/DialogContainer.tsx).
//
// `open` stays fully controlled by local state (not Radix's own trigger-click toggle) since the
// Input itself should also open the panel on focus, the same click-or-focus affordance
// ColorPicker's Input+button pairing offers.
//
// `value`/`defaultValue`/`onValueChange` stay a plain string, matching every other icon-name
// field in this codebase (PageNavigationConfig.icon, PolicyCategoryEntity.icon) - the Input
// stays typable so a caller who *does* know an exact Phosphor name (or wants to paste one) isn't
// forced through the curated grid; resolvePhosphorIcon's own undefined-if-unknown return is what
// keeps that hybrid safe (see PreviewIcon below).
export const IconPicker = ({
  label,
  required,
  disabled,
  error,
  helperText,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'No icon',
  name,
  id,
  className,
}: IconPickerProps) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperTextId = helperText !== undefined ? `${inputId}-helper` : undefined;

  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value ?? '') : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const commit = (next: string) => {
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  };

  const pickIcon = (iconName: IconName) => {
    commit(iconName);
    setOpen(false);
    setSearch('');
  };

  // undefined for both an empty string and a typed name that isn't a real Phosphor export -
  // either way the trigger falls back to the empty-state placeholder below rather than crashing
  // on an unresolved icon component.
  const PreviewIcon = currentValue ? resolvePhosphorIcon(currentValue as IconName) : undefined;

  const normalizedSearch = search.trim().toLowerCase();
  const visibleGroups = normalizedSearch
    ? CURATED_ICON_GROUPS.map((group) => ({
        ...group,
        icons: group.icons.filter((iconName) => iconName.toLowerCase().includes(normalizedSearch)),
      })).filter((group) => group.icons.length > 0)
    : CURATED_ICON_GROUPS;

  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      helperTextId={helperTextId}
      htmlFor={inputId}
      className={className}
    >
      <PopoverPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative w-full">
            <Input
              id={inputId}
              name={name}
              value={currentValue}
              onChange={(event) => commit(event.target.value)}
              // Both needed, not redundant: onFocus opens it the first time (including
              // keyboard/Tab focus, which never fires a click). onOpenAutoFocus/onCloseAutoFocus
              // below keep focus in this Input for the entire open-pick-close cycle (so typing to
              // search is never interrupted) - which means after that first close, the Input
              // never loses focus, so a second click never re-fires `focus` and onClick is what
              // actually reopens it.
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              required={required}
              error={error}
              autoComplete="off"
              spellCheck={false}
              className="h-10 pr-11"
              aria-describedby={helperTextId}
            />

            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen((prev) => !prev)}
              aria-label="Choose an icon"
              aria-expanded={open}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-surface-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed"
            >
              {PreviewIcon ? (
                <Icon name={currentValue as IconName} size={18} />
              ) : (
                <span className="block h-4 w-4 rounded-sm border border-dashed border-surface-400" />
              )}
            </button>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            collisionPadding={12}
            // Keeps focus in the Input rather than Radix's default of moving it into the panel -
            // opening via focus (typing to search) would otherwise immediately lose focus the
            // instant the panel mounts.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            style={{ minWidth: `${MIN_PANEL_WIDTH}px`, width: 'var(--radix-popover-trigger-width)' }}
            // Both this panel and DialogContainer's own overlay portal to document.body as
            // siblings, so raw z-index (not DOM nesting) decides stacking - this must clear
            // DialogContainer's z-[200] overlay or a caller using IconPicker inside a CMS edit
            // dialog (every current one) would render the panel visually on top but have every
            // click swallowed by the dialog underneath instead.
            className="z-[210] flex max-h-[var(--radix-popover-content-available-height)] flex-col overflow-hidden rounded-md border border-surface-300 bg-surface-100 shadow-lg"
          >
            <Box padding={{ base: 12 }} className="flex min-h-0 flex-1 flex-col">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search icons…"
                autoComplete="off"
                spellCheck={false}
                className="mb-3 h-9 shrink-0"
              />

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {visibleGroups.length > 0 ? (
                  visibleGroups.map((group) => (
                    <div key={group.label} className="mb-3 last:mb-0">
                      <Text
                        as="span"
                        textColor={{ color: 'surface', intensity: 500 }}
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                      >
                        {group.label}
                      </Text>
                      <div className="grid grid-cols-6 gap-1.5">
                        {group.icons.map((iconName) => (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => pickIcon(iconName)}
                            title={iconName}
                            aria-label={iconName}
                            aria-pressed={currentValue === iconName}
                            className={mergeClassNames(
                              'flex aspect-square w-full items-center justify-center rounded border transition-colors',
                              'hover:border-primary-400 hover:bg-primary-50',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
                              currentValue === iconName
                                ? 'border-primary-500 bg-primary-50 text-primary-600'
                                : 'border-surface-200 text-surface-700',
                            )}
                          >
                            <Icon name={iconName} size={18} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <Text as="p" textColor={{ color: 'surface', intensity: 500 }} className="py-4 text-center text-sm">
                    No icons match “{search}”
                  </Text>
                )}
              </div>
            </Box>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </FieldShell>
  );
};
