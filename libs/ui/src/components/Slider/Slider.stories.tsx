import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'Inputs/Slider',
  component: Slider,
  args: {
    label: 'Volume',
    min: 0,
    max: 100,
    step: 1,
    defaultValue: [50],
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {};

export const Range: Story = {
  args: { label: 'Price range', defaultValue: [20, 80] },
};

export const Required: Story = {
  args: { required: true },
};

export const WithHelperText: Story = {
  args: { helperText: 'Adjust the output volume.' },
};

export const ErrorState: Story = {
  args: { error: true, helperText: 'Volume must be above 0.' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const CustomColor: Story = {
  args: { color: { color: 'emerald', intensity: 500 } },
};
