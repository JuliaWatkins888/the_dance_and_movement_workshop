import type { PolicyConsentDto } from '@inithium/api-client';

export const formatConsentTimestamp = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });

export const describeConsentMethod = (consent: PolicyConsentDto): string =>
  consent.method === 'paper'
    ? `Paper copy, recorded by ${consent.recordedByName ?? 'staff'}`
    : 'Signed online';

// Opens the record as its own plain document, so the printout has no CMS chrome and always prints
// black on white regardless of the viewer's theme. Returns false when a popup blocker refuses.
export const printPolicyConsent = (consent: PolicyConsentDto, accountEmail: string): boolean => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  const { document: doc } = printWindow;

  const append = (parent: HTMLElement, tag: string, text: string): HTMLElement => {
    const element = doc.createElement(tag);
    element.textContent = text;
    parent.appendChild(element);
    return element;
  };

  doc.title = `Policy signature - ${consent.signedName}`;
  doc.body.style.fontFamily = 'serif';
  doc.body.style.margin = '2rem';

  append(doc.body, 'h1', 'Studio Policy Signature');
  append(doc.body, 'p', `Signed name: ${consent.signedName}`);
  append(doc.body, 'p', `Account: ${accountEmail}`);
  append(doc.body, 'p', `School year: ${consent.schoolYearName ?? 'Not applicable'}`);
  append(doc.body, 'p', `Date: ${formatConsentTimestamp(consent.agreedAt)}`);
  append(doc.body, 'p', `Method: ${describeConsentMethod(consent)}`);
  if (consent.ipAddress) append(doc.body, 'p', `IP address: ${consent.ipAddress}`);
  if (consent.userAgent) append(doc.body, 'p', `Browser: ${consent.userAgent}`);
  append(doc.body, 'p', `Policy version: ${consent.policyVersionHash}`);
  doc.body.appendChild(doc.createElement('hr'));
  append(doc.body, 'h2', 'Policies as agreed');

  for (const category of consent.policySnapshot) {
    append(doc.body, 'h3', category.title);
    for (const item of category.items) {
      append(doc.body, 'h4', item.title);
      // Sanitized server-side before it was ever published, then copied into this record.
      const body = doc.createElement('div');
      body.innerHTML = item.content;
      doc.body.appendChild(body);
    }
  }

  printWindow.focus();
  printWindow.print();
  return true;
};
