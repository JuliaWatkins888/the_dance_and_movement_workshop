import { Box, Text } from '@inithium/ui';
import { useAppName } from '@inithium/api-client';

interface PolicySection {
  readonly title: string;
  readonly paragraphs: readonly string[];
}

// Blanket coverage of what the web app itself stores and why - account, session, and child
// registration data. Deliberately silent on studio operations (attendance, tuition, waivers,
// medical/emergency info, media release) since those are covered on the Policies page instead.
const buildSections = (appName: string): readonly PolicySection[] => [
  {
    title: '1. Information We Collect',
    paragraphs: [
      `Account Information: When you create a parent account with ${appName}, we collect your name, email address, and password.`,
      "Child Profile Information: Once you have an account, you may register one or more children under it. For each child, we collect information such as their name, age, and sex. This information is used solely to support registration and class enrollment and is not used or distributed for any other purpose.",
      'Session Data: We use a browser cookie or local storage to keep you signed in between visits, so you do not need to log in again every time you return to the site.',
    ],
  },
  {
    title: '2. How We Use This Information',
    paragraphs: [
      'To create, maintain, and secure your parent account.',
      'To keep you signed in and remember your session as you move around the site.',
      'To register and enroll the children on your account in classes.',
      'To communicate with you about your account or your enrollments.',
    ],
  },
  {
    title: '3. Cookies and Local Storage',
    paragraphs: [
      'The only cookie or local storage data we set is used to keep you signed in. We do not use cookies for advertising, and we do not track you across other websites.',
    ],
  },
  {
    title: "4. Children's Information",
    paragraphs: [
      'Information about a child is entered by a parent or guardian, not by the child, and is tied to that parent\'s account.',
      "This information is used only to register and enroll your child in classes. We do not share, sell, or publicly display it.",
      'You can review, update, or request removal of your child\'s information at any time by managing your account or contacting us directly.',
    ],
  },
  {
    title: '5. How We Share Information',
    paragraphs: [
      'We do not sell or rent your information, or your child\'s information, to anyone.',
      `We may share information with service providers who help us operate the site (such as hosting or database providers), solely to the extent needed to run ${appName}.`,
      'We may disclose information if required to do so by law.',
    ],
  },
  {
    title: '6. Data Security and Retention',
    paragraphs: [
      'We take reasonable steps to protect the information in your account, though no system can guarantee complete security.',
      'We retain account and child registration information for as long as your account remains active, or as needed to support your enrollment history. You may request that your account and its data be deleted at any time.',
    ],
  },
  {
    title: '7. Your Choices',
    paragraphs: [
      'You can review and update your account and child profile information at any time by signing in.',
      'You can contact us to request a copy of your information, or to request that your account and associated information be corrected or deleted.',
    ],
  },
  {
    title: '8. Changes to This Policy',
    paragraphs: [
      `This policy covers what ${appName} collects and how it is used, and may be updated from time to time. We will update the "Last updated" date below when we do.`,
    ],
  },
];

export const PrivacyPolicyPage = () => {
  const appName = useAppName();
  const sections = buildSections(appName);

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
          Privacy Policy
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          Last updated: July 2026
        </Text>
      </Box>

      <Box flex={{ direction: 'col', gap: 24 }}>
        {sections.map((section) => (
          <Box key={section.title} flex={{ direction: 'col', gap: 8 }}>
            <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-semibold">
              {section.title}
            </Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-base">
                {paragraph}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default PrivacyPolicyPage;
