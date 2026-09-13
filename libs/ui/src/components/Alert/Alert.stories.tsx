import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Feedback/Alert',
  component: Alert,
  args: {
    message: 'Your message has been sent.',
    duration: 0,
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {};

export const Success: Story = {
  args: { severity: 'success', message: 'Delivered successfully.' },
};

export const Danger: Story = {
  args: { severity: 'danger', message: 'Something went wrong. Please try again.' },
};

export const Warning: Story = {
  args: { severity: 'warning', message: 'Your session is about to expire.' },
};

export const Info: Story = {
  args: { severity: 'info', message: 'A new version is available.' },
};

export const Notification: Story = {
  args: { severity: 'notification', message: 'You have a new notification.' },
};

export const NotCloseable: Story = {
  args: { severity: 'info', closeable: false, message: 'This alert has no close button.' },
};
