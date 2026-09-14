import type { IconName } from './icon';

export interface IconPickerGroup {
  readonly label: string;
  readonly icons: readonly IconName[];
}

// A hand-picked subset of Phosphor's ~1500 icons (not the full library) - end users picking a
// nav icon or a policy category icon don't know Phosphor's naming, so this trades completeness
// for a browsable, sensibly-grouped set that covers the site-navigation and studio-policy
// contexts this ships with today. IconPicker's own search field narrows within this set, not
// across the full library - see composites/IconPicker.tsx.
export const CURATED_ICON_GROUPS: readonly IconPickerGroup[] = [
  {
    label: 'General',
    icons: [
      'House',
      'Compass',
      'MapPin',
      'Calendar',
      'Clock',
      'Globe',
      'Bell',
      'Star',
      'Heart',
      'Gear',
      'Info',
      'Question',
      'Warning',
      'CheckCircle',
      'XCircle',
      'Lightbulb',
    ],
  },
  {
    label: 'Money & Commerce',
    icons: ['CreditCard', 'Money', 'Receipt', 'Wallet', 'Coins', 'Tag', 'ShoppingBag', 'ShoppingCart', 'Storefront'],
  },
  {
    label: 'Legal & Documents',
    icons: [
      'FileText',
      'Signature',
      'ClipboardText',
      'Scroll',
      'Files',
      'Certificate',
      'Notebook',
      'ShieldCheck',
      'Lock',
      'Gavel',
      'Handshake',
    ],
  },
  {
    label: 'Safety & Medical',
    icons: ['Stethoscope', 'FirstAidKit', 'Heartbeat', 'Ambulance'],
  },
  {
    label: 'Media',
    icons: ['Camera', 'VideoCamera', 'Image', 'Images', 'Play'],
  },
  {
    label: 'People & Family',
    icons: ['Users', 'UsersThree', 'User', 'UserCircle', 'Baby', 'IdentificationCard'],
  },
  {
    label: 'Communication',
    icons: ['EnvelopeSimple', 'Phone', 'ChatCircle', 'Megaphone', 'PaperPlaneTilt'],
  },
  {
    label: 'Studio & Celebration',
    icons: ['MusicNotes', 'MusicNote', 'PersonSimpleRun', 'Trophy', 'Medal', 'GraduationCap', 'Sparkle', 'Confetti'],
  },
];
