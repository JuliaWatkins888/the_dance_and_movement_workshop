import type { Meta, StoryObj } from '@storybook/react';
import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'Inputs/Switch',
  component: Switch,
  args: {
    label: 'Enable notifications',
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Required: Story = {
  args: { required: true },
};

export const WithHelperText: Story = {
  args: { helperText: 'You can change this later in settings.' },
};

export const ErrorState: Story = {
  args: { error: true, helperText: 'This setting is required.' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const CustomColor: Story = {
  args: { color: { color: 'emerald', intensity: 500 }, defaultChecked: true },
};
