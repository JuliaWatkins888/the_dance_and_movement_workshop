import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Input, Text } from '@inithium/ui';

export interface TimezoneComboboxProps {
  readonly label?: string;
  readonly helperText?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
}

// core @inithium/ui's Select is Radix-backed and works fine for short option lists, but its
// Content has no height cap tied to the available viewport space (no max-height wired to Radix's
// own --radix-select-content-available-height), so a ~400-entry IANA timezone list simply clips
// past the edge of the screen with nothing to scroll to. Rather than patch that shared core
// component from inside a plugin, this builds a small type-to-filter combobox scoped to this one
// screen - explicit max-height + overflow-y-auto here, fully within this plugin's own control.
export const TimezoneCombobox = ({ label, helperText, value, onChange, options }: TimezoneComboboxProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keeps the box in sync with an async-resolved value (e.g. the settings query resolving after
  // this component already mounted with a fallback) - never while the user has it open/is typing,
  // so an in-progress query is never clobbered out from under them.
  useEffect(() => {
    if (!isOpen) setInputValue(value);
  }, [value, isOpen]);

  const filtered = useMemo(() => {
    const needle = inputValue.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((zone) => zone.toLowerCase().includes(needle));
  }, [inputValue, options]);

  const handleSelect = (zone: string) => {
    onChange(zone);
    setInputValue(zone);
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsOpen(true);
  };

  // A short delay rather than closing immediately - lets a click on a list item (below) register
  // via its own onClick before this unmounts the list out from under it. Reverts an abandoned,
  // never-selected query back to the confirmed value rather than leaving stray text behind.
  const handleBlur = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setInputValue(value);
    }, 150);
  };

  return (
    <Box className="relative">
      <Input label={label} helperText={helperText} value={inputValue} onChange={(event) => setInputValue(event.target.value)} onFocus={handleFocus} onBlur={handleBlur} />
      {isOpen ? (
        <Box
          borderColor={{ color: 'surface', intensity: 300 }}
          bgColor={{ color: 'surface', intensity: 100 }}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border shadow-md"
        >
          {filtered.length > 0 ? (
            filtered.map((zone) => (
              <button
                key={zone}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(zone)}
                className="block w-full truncate px-3 py-2 text-left text-sm text-surface-950 hover:bg-surface-200"
              >
                {zone}
              </button>
            ))
          ) : (
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="px-3 py-2 text-sm">
              No matching timezones.
            </Text>
          )}
        </Box>
      ) : null}
    </Box>
  );
};
