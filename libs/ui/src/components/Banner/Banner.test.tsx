import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Banner } from './Banner';
import type { BannerTrianglifyConfig } from '../../tokens/banner';

const trianglifyConfig: BannerTrianglifyConfig = {
  cellSize: 40,
  variance: 0.5,
  xColors: ['#4f46e5', '#0ea5e9'],
  yColors: ['#0ea5e9', '#22d3ee'],
};

describe('Banner', () => {
  it('renders a generated trianglify mesh when no imageUrl is given', () => {
    const { container } = render(<Banner trianglifyConfig={trianglifyConfig} />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelectorAll('polygon').length).toBeGreaterThan(0);
  });

  it('renders the image and skips the mesh when imageUrl is given', () => {
    const { container } = render(
      <Banner trianglifyConfig={trianglifyConfig} imageUrl="https://example.com/banner.png" imageAlt="A banner" />,
    );
    const img = container.querySelector('img');

    expect(img?.getAttribute('src')).toBe('https://example.com/banner.png');
    expect(img?.getAttribute('alt')).toBe('A banner');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('defaults to full width and a 250px height', () => {
    const { container } = render(<Banner trianglifyConfig={trianglifyConfig} />);
    const svg = container.querySelector('svg') as unknown as HTMLElement;

    expect(svg.style.width).toBe('100%');
    expect(svg.style.height).toBe('250px');
  });

  it('applies a custom numeric width and height as pixel values', () => {
    const { container } = render(<Banner trianglifyConfig={trianglifyConfig} width={480} height={120} />);
    const svg = container.querySelector('svg') as unknown as HTMLElement;

    expect(svg.style.width).toBe('480px');
    expect(svg.style.height).toBe('120px');
  });

  it('accepts a string width as a raw CSS value', () => {
    const { container } = render(<Banner trianglifyConfig={trianglifyConfig} width="50%" />);
    const svg = container.querySelector('svg') as unknown as HTMLElement;

    expect(svg.style.width).toBe('50%');
  });

  it('generates the same mesh for the same props (deterministic, no re-render flicker)', () => {
    const first = render(<Banner trianglifyConfig={trianglifyConfig} width={400} height={200} />);
    const firstPoints = Array.from(first.container.querySelectorAll('polygon')).map((polygon) =>
      polygon.getAttribute('points'),
    );
    first.unmount();

    const second = render(<Banner trianglifyConfig={trianglifyConfig} width={400} height={200} />);
    const secondPoints = Array.from(second.container.querySelectorAll('polygon')).map((polygon) =>
      polygon.getAttribute('points'),
    );

    expect(secondPoints).toEqual(firstPoints);
  });
});
