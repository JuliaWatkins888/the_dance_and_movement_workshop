import * as PhosphorIcons from '@phosphor-icons/react';
import type { IconWeight } from '@phosphor-icons/react';

export type { IconWeight };

type PhosphorExportName = keyof typeof PhosphorIcons;

// Every current (non-deprecated) icon export is suffixed "Icon" (e.g. "SmileyIcon" for the
// "Smiley" glyph phosphoricons.com displays) - this derives the bare names the site actually
// shows straight from the installed package's own exports, so the union always matches the
// installed @phosphor-icons/react version with no hand-maintained list to fall out of sync.
type IconExportName = Extract<PhosphorExportName, `${string}Icon`>;
export type IconName = IconExportName extends `${infer Name}Icon` ? Name : never;
