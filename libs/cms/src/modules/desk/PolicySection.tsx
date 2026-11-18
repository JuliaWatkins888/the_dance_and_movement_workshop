import { Box, Input, RadioGroup, RadioGroupItem, Text } from '@inithium/ui';
import type { PolicyConsentStatusDto } from '@inithium/api-client';

export interface DeskConsentDraft {
  method: 'desk' | 'paper';
  signedName: string;
}

interface PolicySectionProps {
  readonly policy: PolicyConsentStatusDto | undefined;
  readonly value: DeskConsentDraft;
  readonly onChange: (next: DeskConsentDraft) => void;
  readonly showErrors: boolean;
}

const yearNames = (policy: PolicyConsentStatusDto): string =>
  policy.outstandingSchoolYears.map((year) => year.name ?? 'the current school year').join(' and ');

export const validateDeskConsent = (policy: PolicyConsentStatusDto | undefined, value: DeskConsentDraft): string | undefined =>
  policy?.required && value.signedName.trim().length < 2 ? 'Enter the name the family signed with.' : undefined;

export const PolicySection = ({ policy, value, onChange, showErrors }: PolicySectionProps) => {
  if (!policy) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        Add a class or workshop to check the family’s policy signature.
      </Text>
    );
  }
  if (!policy.required) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        Nothing to sign: the family has already signed the current studio policies for these items.
      </Text>
    );
  }

  const error = showErrors ? validateDeskConsent(policy, value) : undefined;
  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
        {`The family needs to agree to the studio policies for ${yearNames(policy)} before registering.`}
      </Text>
      <Box bgColor={{ color: 'surface', intensity: 100 }} borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 12 }} className="max-h-72 overflow-y-auto rounded border">
        {policy.policies.map((category) => (
          <Box key={category.title} flex={{ direction: 'col', gap: 4 }} className="mb-3">
            <Text as="h4" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
              {category.title}
            </Text>
            {category.items.map((item) => (
              <Box key={item.title} flex={{ direction: 'col' }}>
                <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
                  {item.title}
                </Text>
                <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
                  {item.content}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <RadioGroup label="How the family signs" value={value.method} onValueChange={(method) => onChange({ ...value, method: method as DeskConsentDraft['method'] })}>
        <RadioGroupItem value="desk" label="The family reads the policies above and types their name here" />
        <RadioGroupItem value="paper" label="The family signed a paper copy of the current policies" />
      </RadioGroup>
      <Input
        label={value.method === 'paper' ? 'Name as signed on the paper copy' : 'Family member’s full name (typed by them)'}
        required
        value={value.signedName}
        onChange={(event) => onChange({ ...value, signedName: event.target.value })}
        error={Boolean(error)}
        {...(error ? { helperText: error } : {})}
      />
    </Box>
  );
};
