import type { AvatarShape } from '../tokens/avatar';

const SHAPE_CLASSES: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  square: 'rounded-lg',
};

export const resolveAvatarShapeClasses = (shape: AvatarShape): string => SHAPE_CLASSES[shape];
