import type { Meta, StoryObj } from '@storybook/react';
import { Select, SelectItem } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Inputs/Select',
  component: Select,
  args: {
    label: 'Country',
    placeholder: 'Choose a country',
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const countryItems = (
  <>
    <SelectItem value="us">United States</SelectItem>
    <SelectItem value="ca">Canada</SelectItem>
    <SelectItem value="mx">Mexico</SelectItem>
  </>
);

export const Default: Story = {
  render: (args) => <Select {...args}>{countryItems}</Select>,
};

export const Required: Story = {
  args: { required: true },
  render: (args) => <Select {...args}>{countryItems}</Select>,
};

export const WithHelperText: Story = {
  args: { helperText: 'Used to calculate shipping.' },
  render: (args) => <Select {...args}>{countryItems}</Select>,
};

export const ErrorState: Story = {
  args: { error: true, helperText: 'Please choose a country.' },
  render: (args) => <Select {...args}>{countryItems}</Select>,
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'us' },
  render: (args) => <Select {...args}>{countryItems}</Select>,
};

export const CustomColor: Story = {
  args: { color: { color: 'emerald', intensity: 500 } },
  render: (args) => <Select {...args}>{countryItems}</Select>,
};
