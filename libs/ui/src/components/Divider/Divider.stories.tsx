import type { Meta, StoryObj } from '@storybook/react';
import { Divider } from './Divider';

const meta: Meta<typeof Divider> = {
  title: 'Layout/Divider',
  component: Divider,
};

export default meta;
type Story = StoryObj<typeof Divider>;

export const Default: Story = {};

export const ThickPrimary: Story = {
  args: { thickness: 4, color: { color: 'primary', intensity: 500 } },
};

export const FixedWidth: Story = {
  args: { width: 240 },
};

export const WithMargin: Story = {
  args: { margin: { top: 16, bottom: 16 } },
};
