import type { Meta, StoryObj } from '@storybook/react';
import { Banner } from './Banner';
import { useElementSize } from '../../composites/useElementSize';

const meta: Meta<typeof Banner> = {
  title: 'Data Display/Banner',
  component: Banner,
  args: {
    trianglifyConfig: {
      cellSize: 60,
      variance: 0.75,
      xColors: ['#4f46e5', '#0ea5e9'],
      yColors: ['#0ea5e9', '#22d3ee'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Banner>;

export const Default: Story = {};

export const DenseMesh: Story = {
  args: { trianglifyConfig: { cellSize: 20, variance: 0.9, xColors: ['#be123c', '#f97316'], yColors: ['#f97316', '#facc15'] } },
};

export const LowVariance: Story = {
  args: { trianglifyConfig: { cellSize: 60, variance: 0.1, xColors: ['#166534', '#4ade80'], yColors: ['#4ade80', '#bbf7d0'] } },
};

export const CustomHeight: Story = {
  args: { height: 120 },
};

export const FixedWidth: Story = {
  args: { width: 480 },
};

export const FromImage: Story = {
  args: { imageUrl: 'https://picsum.photos/1200/250', imageAlt: 'Scenic banner photo' },
};

// Demonstrates the recommended pattern for a Banner spanning a wide range of container widths
// (a narrow sidebar card up to a full-bleed hero): wrap it, measure the wrapper with
// useElementSize, and pass the resolved pixel width straight back in. Resize this story's
// container in Storybook's viewport controls to see the mesh regenerate undistorted at every
// width, rather than stretching against Banner's own DEFAULT_MESH_WIDTH fallback.
export const ResponsiveContainer: Story = {
  render: (args) => {
    const { ref, size } = useElementSize();
    return (
      <div ref={ref} style={{ width: '100%', maxWidth: 900, resize: 'horizontal', overflow: 'auto' }}>
        <Banner {...args} width={size?.width} />
      </div>
    );
  },
};
