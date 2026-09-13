import type { SettingDefinition } from './registry';

const contactRecipientEmailSetting: SettingDefinition = {
  key: 'contact.recipientEmail',
  label: 'Notification Recipient',
  description:
    'The email of the admin/editor account that receives a notification when someone submits the contact form (or sends a follow-up message). Must match an existing user’s email exactly. Leave blank to disable admin notifications - submissions are still saved either way.',
  group: 'Contact',
  order: 0,
  type: 'string',
  default: '',
};

export default contactRecipientEmailSetting;
