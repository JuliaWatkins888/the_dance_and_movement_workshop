import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Inputs/Checkbox',
  component: Checkbox,
  args: {
    label: 'Accept terms and conditions',
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Indeterminate: Story = {
  args: { checked: 'indeterminate', onCheckedChange: () => {} },
};

export const Required: Story = {
  args: { required: true },
};

export const WithHelperText: Story = {
  args: { helperText: 'You must accept the terms to continue.' },
};

export const ErrorState: Story = {
  args: { error: true, helperText: 'You must accept the terms.' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const CustomColor: Story = {
  args: { color: { color: 'emerald', intensity: 500 }, defaultChecked: true },
};
