import type { Meta, StoryObj } from '@storybook/react';
import { RadioGroup, RadioGroupItem } from './RadioGroup';

const meta: Meta<typeof RadioGroup> = {
  title: 'Inputs/RadioGroup',
  component: RadioGroup,
  args: {
    label: 'Plan',
  },
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

const planItems = (
  <>
    <RadioGroupItem value="free" label="Free" />
    <RadioGroupItem value="pro" label="Pro" />
    <RadioGroupItem value="enterprise" label="Enterprise" />
  </>
);

export const Default: Story = {
  args: { defaultValue: 'free' },
  render: (args) => <RadioGroup {...args}>{planItems}</RadioGroup>,
};

export const Required: Story = {
  args: { required: true },
  render: (args) => <RadioGroup {...args}>{planItems}</RadioGroup>,
};

export const WithHelperText: Story = {
  args: { helperText: 'You can change your plan at any time.' },
  render: (args) => <RadioGroup {...args}>{planItems}</RadioGroup>,
};

export const ErrorState: Story = {
  args: { error: true, helperText: 'Please choose a plan.' },
  render: (args) => <RadioGroup {...args}>{planItems}</RadioGroup>,
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'free' },
  render: (args) => <RadioGroup {...args}>{planItems}</RadioGroup>,
};

export const CustomColor: Story = {
  args: { color: { color: 'emerald', intensity: 500 }, defaultValue: 'pro' },
  render: (args) => <RadioGroup {...args}>{planItems}</RadioGroup>,
};
