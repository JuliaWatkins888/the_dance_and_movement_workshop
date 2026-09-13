import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Inputs/Textarea',
  component: Textarea,
  args: {
    label: 'Bio',
    placeholder: 'Tell us about yourself',
    rows: 4,
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const Required: Story = {
  args: { required: true },
};

export const WithHelperText: Story = {
  args: { helperText: 'Max 500 characters.' },
};

export const ErrorState: Story = {
  args: { error: true, helperText: 'Bio is required.' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'This field is locked.' },
};

export const CustomColor: Story = {
  args: { color: { color: 'emerald', intensity: 500 } },
};
