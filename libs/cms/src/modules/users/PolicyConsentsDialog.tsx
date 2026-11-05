import { useState } from 'react';
import { alert, Box, Button, Divider, Input, RichTextContent, Select, SelectItem, Text } from '@inithium/ui';
import {
  readApiError,
  useListSchoolYearsAdminQuery,
  useListUserPolicyConsentsQuery,
  useRecordPaperPolicyConsentMutation,
} from '@inithium/api-client';
import type { AdminUser, PolicyConsentDto } from '@inithium/api-client';
import { describeConsentMethod, formatConsentTimestamp, printPolicyConsent } from './printPolicyConsent';

const ALERT_POSITION = 'bottom-right' as const;
const MIN_SIGNED_NAME_LENGTH = 2;

const ConsentRow = ({ consent, accountEmail }: { readonly consent: PolicyConsentDto; readonly accountEmail: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePrint = () => {
    if (!printPolicyConsent(consent, accountEmail)) {
      alert.danger('Your browser blocked the print window. Allow popups for this site and try again.', { position: ALERT_POSITION });
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }} padding={{ top: 12, bottom: 12 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0">
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
            {`${consent.schoolYearName ?? 'No school year'} · ${consent.signedName}`}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {`${describeConsentMethod(consent)} · ${formatConsentTimestamp(consent.agreedAt)}`}
          </Text>
          {consent.ipAddress ? (
            <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
              {`IP ${consent.ipAddress}`}
            </Text>
          ) : null}
        </Box>
        <Box flex={{ direction: 'row', gap: 8 }} className="shrink-0">
          <Button variant={{ kind: 'outlined', color: 'surface' }} onClick={() => setIsExpanded((value) => !value)}>
            {isExpanded ? 'Hide text' : 'View text'}
          </Button>
          <Button variant={{ kind: 'outlined', color: 'surface' }} onClick={handlePrint}>
            Print
          </Button>
        </Box>
      </Box>
      {isExpanded ? (
        <Box
          flex={{ direction: 'col', gap: 12 }}
          padding={{ base: 12 }}
          borderColor={{ color: 'surface', intensity: 300 }}
          className="max-h-80 overflow-y-auto rounded border"
        >
          {consent.policySnapshot.map((category, categoryIndex) => (
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
        </Box>
      ) : null}
    </Box>
  );
};

const PaperConsentForm = ({ user }: { readonly user: AdminUser }) => {
  const { data: schoolYears = [] } = useListSchoolYearsAdminQuery();
  const [recordPaperConsent, { isLoading }] = useRecordPaperPolicyConsentMutation();
  const [schoolYearId, setSchoolYearId] = useState('');
  const [signedName, setSignedName] = useState('');

  const handleSubmit = async () => {
    try {
      await recordPaperConsent({ userId: user.id, schoolYearId, signedName: signedName.trim() }).unwrap();
      setSignedName('');
      alert.success('Paper signature recorded.', { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not record this signature.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        Record a paper signature
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        Use this when the family signed a paper copy of the current policies. It’s saved under your name and can’t be edited afterward.
      </Text>
      <Select label="School year" value={schoolYearId} onValueChange={setSchoolYearId} disabled={isLoading}>
        {schoolYears.map((year) => (
          <SelectItem key={year.id} value={year.id}>
            {year.name}
          </SelectItem>
        ))}
      </Select>
      <Input
        label="Name as signed on the paper copy"
        value={signedName}
        onChange={(event) => setSignedName(event.target.value)}
        disabled={isLoading}
      />
      <Button
        variant={{ kind: 'filled', color: 'primary' }}
        onClick={handleSubmit}
        disabled={isLoading || !schoolYearId || signedName.trim().length < MIN_SIGNED_NAME_LENGTH}
        className="self-end"
      >
        {isLoading ? 'Saving…' : 'Record signature'}
      </Button>
    </Box>
  );
};

export const PolicyConsentsDialog = ({ user }: { readonly user: AdminUser }) => {
  const { data: consents = [], isLoading } = useListUserPolicyConsentsQuery(user.id);

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      {isLoading ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          Loading signatures...
        </Text>
      ) : consents.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          This account hasn’t signed the studio policies yet.
        </Text>
      ) : (
        <Box>
          {consents.map((consent, index) => (
            <Box key={consent.id}>
              {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
              <ConsentRow consent={consent} accountEmail={user.email} />
            </Box>
          ))}
        </Box>
      )}
      <Divider color={{ color: 'surface', intensity: 300 }} />
      <PaperConsentForm user={user} />
    </Box>
  );
};
