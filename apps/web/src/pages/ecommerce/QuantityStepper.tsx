import { Box, IconButton, Text } from '@inithium/ui';

interface QuantityStepperProps {
  readonly value: number;
  readonly onChange: (next: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly disabled?: boolean;
}

export const QuantityStepper = ({ value, onChange, min = 1, max = 99, disabled }: QuantityStepperProps) => (
  <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
    <IconButton
      icon="Minus"
      label="Decrease quantity"
      variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
      textColor={{ color: 'surface', intensity: 900 }}
      disabled={disabled || value <= min}
      onClick={() => onChange(value - 1)}
    />
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
      {value}
    </Text>
    <IconButton
      icon="Plus"
      label="Increase quantity"
      variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
      textColor={{ color: 'surface', intensity: 900 }}
      disabled={disabled || value >= max}
      onClick={() => onChange(value + 1)}
    />
  </Box>
);
