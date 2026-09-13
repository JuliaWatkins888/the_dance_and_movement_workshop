import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Inputs/Input',
  component: Input,
  args: {
    label: 'Email address',
    placeholder: 'you@example.com',
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Required: Story = {
  args: { required: true },
};

export const WithHelperText: Story = {
  args: { helperText: 'We will never share your email.' },
};

export const ErrorState: Story = {
  args: { error: true, helperText: 'A valid email is required.' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'locked@example.com' },
};

export const CustomColor: Story = {
  args: { color: { color: 'emerald', intensity: 500 } },
};
