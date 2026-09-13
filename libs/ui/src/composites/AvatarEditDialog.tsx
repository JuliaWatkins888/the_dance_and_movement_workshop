import { useState } from 'react';
import type { AvatarConfig } from '@inithium/db';
import { Avatar } from '../components/Avatar/Avatar';
import { Box, Button, IconButton, RadioGroup, RadioGroupItem, Text } from '../components';
import { alert } from '../alert/alert';
import { resolveContrastColor } from '../utils/resolveContrastColor';
import { DEFAULT_AVATAR_STYLE, DICEBEAR_STYLES, humanizeDicebearStyle } from '../tokens/avatar';
import { ColorSpecPicker } from './ColorSpecPicker';
import type { AvatarShape, AvatarSource, AvatarVariant } from '../tokens/avatar';
import type { ColorSpec } from '../contracts/color.contract';

export interface AvatarEditDialogProps {
  readonly initialAvatar: AvatarConfig;
  readonly fullName: string;
  readonly onSave: (avatar: AvatarConfig) => Promise<void>;
  readonly onClose: () => void;
}

const PREVIEW_SIZE = 128;
const PICKER_BUTTON_SIZE = 40;
const ALERT_POSITION = 'bottom-right' as const;
const SELECTED_RING_CLASS = 'ring-2 ring-offset-2 ring-primary-500';

const generateRandomSeed = (): string => Math.random().toString(36).slice(2, 10);

// AvatarConfig's color fields store intensity/opacity as a plain `number` (libs/db stays
// ignorant of @inithium/ui's ColorSpec) - same boundary cast resolveAvatarConfigProps already
// makes for the same reason.
//
// Deliberately checks `color?.color` rather than just `color` - fontColor has no Mongoose-level
// default (unlike bgColor, which always gets DEFAULT_AVATAR_CONFIG's default applied), so on a
// brand-new user it comes back from the API as an empty-but-present `{}`, not `undefined`. A
// plain `color as ColorSpec | undefined` cast would let that `{}` through as "truthy", so the
// `?? fallback` pattern everywhere this is called would never trigger and this dialog would go
// on to save an invalid color object with no `color` field - which is exactly what the server's
// avatarColorSchema (color required) then 400s on.
const toColorSpec = (color: { color: string; intensity?: number; opacity?: number } | undefined): ColorSpec | undefined =>
  color?.color ? (color as ColorSpec) : undefined;

// The avatar/dicebear customization dialog - launched from ProfilePage's own edit-button overlay
// on the owner's avatar. Core ships procedural avatars only (initials or dicebear-generated
// looks); an uploaded-photo option is added by the storage plugin, which replaces this file
// wholesale with a variant that also wires @inithium/api-client's upload mutation into a
// MediaField upload/URL tab. See @inithium/api-client's `AvatarConfig.imageUrl` - present in the
// contract either way so it round-trips untouched when this dialog never sets it.
export const AvatarEditDialog = ({ initialAvatar, fullName, onSave, onClose }: AvatarEditDialogProps) => {
  const [variant, setVariant] = useState<AvatarVariant>(initialAvatar.variant);
  const [bgColor, setBgColor] = useState<ColorSpec>(toColorSpec(initialAvatar.style.bgColor) ?? DEFAULT_AVATAR_STYLE.bgColor);
  const [fontColor, setFontColor] = useState<ColorSpec>(
    toColorSpec(initialAvatar.style.fontColor) ?? resolveContrastColor(toColorSpec(initialAvatar.style.bgColor) ?? DEFAULT_AVATAR_STYLE.bgColor),
  );
  const [shape, setShape] = useState<AvatarShape>(initialAvatar.style.shape ?? DEFAULT_AVATAR_STYLE.shape);
  const [dicebearStyle, setDicebearStyle] = useState<string>(initialAvatar.dicebear?.style ?? DICEBEAR_STYLES[0]);

  // Right arrow always either steps forward into a look already seen, or generates and appends a
  // brand new one; left arrow only ever steps back through history - never discards it. Resets
  // whenever the user switches to a *different* dicebear style (a "next look" from style A
  // shouldn't carry over as style B's starting point).
  const [seedHistory, setSeedHistory] = useState<string[]>([initialAvatar.dicebear?.seed ?? generateRandomSeed()]);
  const [seedIndex, setSeedIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const currentSeed = seedHistory[seedIndex]!;

  const selectDicebearStyle = (style: string) => {
    setVariant('dicebear');
    if (style === dicebearStyle) return;
    setDicebearStyle(style);
    setSeedHistory([generateRandomSeed()]);
    setSeedIndex(0);
  };

  const goToPreviousSeed = () => setSeedIndex((index) => Math.max(0, index - 1));
  const goToNextSeed = () =>
    setSeedIndex((index) => {
      if (index + 1 < seedHistory.length) return index + 1;
      setSeedHistory((history) => [...history, generateRandomSeed()]);
      return index + 1;
    });

  const previewSource: AvatarSource =
    variant === 'dicebear' ? { variant: 'dicebear', style: dicebearStyle, seed: currentSeed, alt: fullName } : { variant: 'initials', name: fullName };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const avatar: AvatarConfig = {
        variant,
        style: { bgColor, fontColor, shape },
        ...(variant === 'dicebear' ? { dicebear: { style: dicebearStyle, seed: currentSeed } } : {}),
      };
      await onSave(avatar);
      onClose();
      alert.success('Avatar updated successfully.', { position: ALERT_POSITION });
    } catch {
      alert.danger('Could not save your avatar. Please try again.', { position: ALERT_POSITION });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', align: 'center', justify: 'center', gap: 16 }}>
        {variant === 'dicebear' && <IconButton icon="CaretLeft" label="Previous look" onClick={goToPreviousSeed} disabled={seedIndex === 0} />}
        <Avatar source={previewSource} styleConfig={{ bgColor, fontColor, shape }} size={PREVIEW_SIZE} />
        {variant === 'dicebear' && <IconButton icon="CaretRight" label="Next look" onClick={goToNextSeed} />}
      </Box>

      <Box flex={{ direction: 'row', gap: 8 }} className="flex-wrap justify-center">
        <Avatar
          source={{ variant: 'initials', name: fullName }}
          styleConfig={{ bgColor, fontColor, shape }}
          size={PICKER_BUTTON_SIZE}
          onClick={() => setVariant('initials')}
          className={variant === 'initials' ? SELECTED_RING_CLASS : undefined}
        />
        {DICEBEAR_STYLES.map((style) => (
          <Avatar
            key={style}
            source={{ variant: 'dicebear', style, seed: currentSeed, alt: humanizeDicebearStyle(style) }}
            size={PICKER_BUTTON_SIZE}
            onClick={() => selectDicebearStyle(style)}
            className={variant === 'dicebear' && dicebearStyle === style ? SELECTED_RING_CLASS : undefined}
          />
        ))}
      </Box>

      {variant === 'initials' && (
        <Box flex={{ direction: 'col', gap: 16 }}>
          <Text as="h3" className="text-sm font-semibold">
            Initials Style
          </Text>
          <ColorSpecPicker label="Background Color" value={bgColor} onValueChange={setBgColor} />
          <ColorSpecPicker label="Text Color" value={fontColor} onValueChange={setFontColor} />
          <RadioGroup label="Shape" value={shape} onValueChange={(value) => setShape(value as AvatarShape)}>
            <RadioGroupItem value="circle" label="Circle" />
            <RadioGroupItem value="square" label="Square" />
          </RadioGroup>
        </Box>
      )}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
