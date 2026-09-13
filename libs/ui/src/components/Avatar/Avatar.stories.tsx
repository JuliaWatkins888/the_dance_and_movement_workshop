import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Data Display/Avatar',
  component: Avatar,
  args: {
    source: { variant: 'initials', name: 'Jane Doe' },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {};

export const Square: Story = {
  args: { styleConfig: { shape: 'square' } },
};

export const CustomColors: Story = {
  args: { styleConfig: { bgColor: { color: 'accent', intensity: 600 }, fontColor: { color: 'accent-foreground' } } },
};

export const Large: Story = {
  args: { size: 200 },
};

export const FromImage: Story = {
  args: { imageUrl: 'https://i.pravatar.cc/200', imageAlt: 'Jane Doe' },
};

export const FromDicebear: Story = {
  args: { source: { variant: 'dicebear', style: 'bottts', seed: 'jane-doe' } },
};

export const Clickable: Story = {
  args: { onClick: () => alert('Avatar clicked') },
};

export const Online: Story = {
  args: { status: 'online' },
};

export const Busy: Story = {
  args: { status: 'busy' },
};

export const Away: Story = {
  args: { status: 'away' },
};

export const OfflineStatus: Story = {
  args: { status: 'offline' },
};
