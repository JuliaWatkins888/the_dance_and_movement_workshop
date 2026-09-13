import type { Meta, StoryObj } from '@storybook/react';
import { Drawer } from './Drawer';
import { Text } from '../Text/Text';

const meta: Meta<typeof Drawer> = {
  title: 'Feedback/Drawer',
  component: Drawer,
  args: {
    children: (
      <>
        <Text as="h2" className="text-lg font-semibold text-surface-900">
          Drawer title
        </Text>
        <Text className="text-sm text-surface-600">
          This is the drawer panel in isolation - in the app it's rendered inside
          DrawerContainer's overlay/portal via drawer.show(...).
        </Text>
      </>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof Drawer>;

export const Default: Story = {};

export const LeftSide: Story = {
  args: { side: 'left' },
};

export const CustomWidth: Story = {
  args: { width: 640 },
};

export const NotCloseable: Story = {
  args: { closeable: false },
};
