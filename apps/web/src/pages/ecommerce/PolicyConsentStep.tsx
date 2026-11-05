import { Box, Checkbox, Input, RichTextContent, Text } from '@inithium/ui';
import type { PolicySnapshotCategoryDto } from '@inithium/api-client';

const MIN_SIGNED_NAME_LENGTH = 2;

export interface PolicyConsentErrors {
  agreed?: string;
  signedName?: string;
}

export const validatePolicyConsent = (agreed: boolean, signedName: string): PolicyConsentErrors => ({
  ...(agreed ? {} : { agreed: 'Please confirm you have read and agree to the policies.' }),
  ...(signedName.trim().length >= MIN_SIGNED_NAME_LENGTH ? {} : { signedName: 'Please type your full legal name.' }),
});

interface PolicyConsentStepProps {
  readonly policies: PolicySnapshotCategoryDto[];
  readonly agreed: boolean;
  readonly signedName: string;
  readonly onAgreedChange: (agreed: boolean) => void;
  readonly onSignedNameChange: (name: string) => void;
  readonly errors?: PolicyConsentErrors;
  readonly disabled?: boolean;
}

// Shows the exact text the API returned with the version being signed, so what the person reads
// can't drift from what their signature records.
export const PolicyConsentStep = ({ policies, agreed, signedName, onAgreedChange, onSignedNameChange, errors = {}, disabled }: PolicyConsentStepProps) => (
  <Box flex={{ direction: 'col', gap: 16 }}>
    <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
      Please read the studio policies below. You can also{' '}
      <a href="/policies" target="_blank" rel="noopener noreferrer" className="text-surface-950 underline underline-offset-4 hover:text-accent-500">
        open them in a new tab
      </a>
      .
    </Text>
    {/* A plain div: Box takes no tabIndex, and keyboard users need focus here to scroll. */}
    <div tabIndex={0} aria-label="Studio policies" className="flex max-h-80 flex-col gap-4 overflow-y-auto rounded-lg border border-surface-300 p-4">
      {policies.map((category, categoryIndex) => (
        <Box key={`${categoryIndex}:${category.title}`} flex={{ direction: 'col', gap: 8 }}>
          <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            {category.title}
          </Text>
          {category.items.map((item, itemIndex) => (
            <Box key={`${itemIndex}:${item.title}`} flex={{ direction: 'col', gap: 4 }}>
              <Text as="h4" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-semibold">
                {item.title}
              </Text>
              <RichTextContent html={item.content} className="text-sm text-surface-800" />
            </Box>
          ))}
        </Box>
      ))}
    </div>
    <Checkbox
      label="I have read and agree to all studio policies"
      required
      checked={agreed}
      onCheckedChange={(checked) => onAgreedChange(checked === true)}
      disabled={disabled}
      error={Boolean(errors.agreed)}
      {...(errors.agreed ? { helperText: errors.agreed } : {})}
    />
    <Input
      label="Type your full legal name"
      required
      autoComplete="name"
      value={signedName}
      onChange={(event) => onSignedNameChange(event.target.value)}
      disabled={disabled}
      error={Boolean(errors.signedName)}
      helperText={errors.signedName ?? 'This serves as your signature.'}
    />
  </Box>
);
