import type { Meta, StoryObj } from '@storybook/react';
import { Dialog } from './Dialog';
import { Text } from '../Text/Text';

const meta: Meta<typeof Dialog> = {
  title: 'Feedback/Dialog',
  component: Dialog,
  args: {
    children: (
      <>
        <Text as="h2" className="text-lg font-semibold text-surface-900">
          Dialog title
        </Text>
        <Text className="text-sm text-surface-600">
          This is the dialog card in isolation - in the app it's rendered inside DialogContainer's
          overlay/portal via dialog.show(...).
        </Text>
      </>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {};

export const CustomSize: Story = {
  args: { width: 640, height: 320 },
};

export const NotCloseable: Story = {
  args: { closeable: false },
};
