import type { CreatePolicyCategoryInput, CreatePolicyItemInput } from '../contracts/policy.contract';

// The repository only creates a bare category (createCategory) or pushes one item at a time
// (createItem) - there's no "create with items" call, since the CMS never needs one (categories
// and their items are always created independently, one form at a time). This seed shape just
// carries the full nested content so ensureSeededPolicies can drive both calls in sequence.
export type PolicySeedCategory = CreatePolicyCategoryInput & { items: CreatePolicyItemInput[] };

// Ported verbatim (content-wise) from the studio's previous site iteration, where each item's
// text lived as a `readonly string[]` of paragraphs. This app's items store a single rich-HTML
// string instead (authored/edited via the CMS's Tiptap editor going forward), so each paragraph
// is simply wrapped in its own <p> here to preserve the original line breaks.
const toHtml = (paragraphs: readonly string[]): string => paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');

interface LegacyPolicySeedItem {
  title: string;
  content: readonly string[];
}

interface LegacyPolicySeedCategory {
  title: string;
  icon: string;
  items: readonly LegacyPolicySeedItem[];
}

const SEED_CATEGORIES: readonly LegacyPolicySeedCategory[] = [
  {
    title: 'Tuition',
    icon: 'CreditCard',
    items: [
      {
        title: 'Monthly Tuition Rates',
        content: [
          'Tuition is charged as a monthly flat rate and reserves your dancer’s place in class for the entire season. Tuition remains the same each month regardless of the number of class meetings due to holidays, scheduled studio closures, or calendar variations.',
          '30-minute class: $40/month',
          '45-minute class: $50/month',
          '60-minute class: $60/month',
          '75-minute class: $70/month',
          '90-minute class: $75/month',
        ],
      },
      {
        title: 'Private Lessons',
        content: [
          'Private lessons are available by appointment.',
          '30-minute private lesson: $45',
          '60-minute private lesson: $65',
        ],
      },
      {
        title: 'Drop-Ins',
        content: [
          'Classes with a Teacher Recommendation label are NOT eligible for a drop-in. Classes without this label are available for drop-ins at each teacher’s discretion. Non-adult class drop-ins are $22 per class.',
        ],
      },
      {
        title: 'Adult Classes',
        content: [
          'Adult classes may be attended on a drop-in basis for $22 per class. Adult class cards and package options may be offered throughout the season.',
        ],
      },
      {
        title: 'Registration Fee',
        content: [
          'A non-refundable annual registration fee of $30 per student is due upon enrollment each season.',
          'Families enrolling multiple dancers will receive a $5 discount on the registration fee for each additional student.',
          'Example: First student: $30. Second student: $25. Third student: $20.',
        ],
      },
      {
        title: 'Early Bird Registration',
        content: [
          'Families who complete registration and pay the registration fee by the studio’s Early Bird deadline will receive a discounted first month of classes. 10% off your first month using the code EARLYBIRD26.',
          'The Early Bird registration deadline will be announced prior to each season.',
        ],
      },
      {
        title: 'Multi-Class Discount',
        content: [
          'Students enrolled in three (3) or more weekly classes will receive a 5% discount on their monthly tuition.',
          'Students enrolled in five (5) or more weekly classes will receive a 10% discount on their monthly tuition.',
          'The discount applies to tuition only and does not apply to registration fees, private lessons, workshops, special events, costumes, recital fees, or merchandise.',
        ],
      },
      {
        title: 'Tuition Due Dates',
        content: [
          'Monthly tuition is due on the 1st of each month.',
          'Automatic payments are highly encouraged to ensure timely processing.',
        ],
      },
      {
        title: 'Credit Cards and Processing Fees',
        content: [
          'In an effort to cover the costs of credit card processing fees, we will charge 2.89% + $0.30 per transaction to every transaction paid with a Visa, Mastercard, or Discover credit card. The amount will not exceed the regulated amount of 3% per transaction. This does not apply to debit cards or other forms of payment.',
          'Note: ALL FAMILIES MUST HAVE A CREDIT CARD ON FILE. CREDIT CARDS WILL BE CHARGED UNLESS OTHERWISE NOTIFIED. IF A CASH OR CHECK PAYMENT IS NOT MADE BY THE END OF THE DAY ON THE FIRST OF THE MONTH, THE CREDIT CARD ON FILE WILL BE CHARGED.',
        ],
      },
      {
        title: 'Late Payments',
        content: [
          'Accounts with unpaid balances after the 10th of the month will incur a $15 late fee.',
          'Students with overdue accounts may be unable to participate in classes, performances, workshops, or special events until their account is brought current.',
        ],
      },
      {
        title: 'Returned Payments',
        content: ['A $35 fee will be assessed for all returned checks or declined electronic payments.'],
      },
      {
        title: 'Withdrawal Policy',
        content: [
          'Written notice of withdrawal must be submitted before the 1st day of the month to discontinue enrollment.',
          'Tuition is not prorated or refunded for partial months once payment has been processed.',
          'Students who discontinue attendance without providing written notice remain financially responsible for tuition until the studio receives official notification of withdrawal.',
        ],
      },
      {
        title: 'Missed Classes',
        content: [
          'No refunds or credits are provided for missed classes.',
          'When space permits, students may attend an age- and level-appropriate make-up class during the current season.',
        ],
      },
      {
        title: 'Refund Policy',
        content: [
          'Registration fees, tuition, private lessons, workshops, and special event fees are non-refundable, except in the event that The Dance and Movement Workshop cancels the class or event. This does not include classes that are cancelled temporarily due to inclement weather or teacher illness.',
          'If a class is discontinued and a costume has already been purchased, the student/family may NOT receive a refund on the costume and will NOT be able to return the costume. You will be able to keep the costume that was paid for.',
        ],
      },
      {
        title: 'Additional Fees',
        content: [
          'Additional fees may be assessed throughout the season, including but not limited to:',
          'Performance costume fees',
          'Recital participation fees',
          'Competition or convention fees (when applicable)',
          'Workshops and master classes',
          'Special events',
          'Families will receive advance notice of any additional required fees.',
        ],
      },
      {
        title: 'Our Commitment',
        content: [
          'At The Dance and Movement Workshop, tuition supports far more than weekly classes. It allows us to provide exceptional instructors, maintain professional sprung dance floors and studio facilities, invest in quality programming, and create a welcoming community where every dancer is encouraged to grow with confidence, creativity, and joy.',
          'We sincerely appreciate your trust and partnership and look forward to being a part of your dancer’s journey.',
        ],
      },
    ],
  },
  {
    title: 'Liability Waiver & Release',
    icon: 'Signature',
    items: [
      {
        title: 'Assumption of Risk and Release Agreement',
        content: [
          'IN CONSIDERATION of being permitted by The Dance and Movement Workshop, L.L.C., a Michigan limited liability company (“Proprietor”), to participate in any way in dance instructions, dance performances, and related activity (collectively, the “Activity”) I, for myself and for my personal representatives, assigns, heirs, and next of kin:',
          '1. ACKNOWLEDGE that I am not in any way required to participate in any Activity with the Proprietor. My choice to participate in the Activity is knowing, voluntary, and made for my personal enjoyment.',
          '2. ACKNOWLEDGE, agree, and represent that I understand the nature of the Activity and that I am qualified, in good health, and in proper physical condition to participate in such Activity. I further agree and warrant that, if at any time I believe conditions to be unsafe or that I am no longer in proper physical condition to participate in the Activity, I will immediately discontinue further participation in the Activity.',
          '3. ACKNOWLEDGE and agree to abide by facility dress codes. This includes wearing proper attire to dance class, as well as following proper street shoe etiquette. No dirty shoes are permitted in any dance space or other space being used by Proprietor for purposes of any Activity, and no attire that is inappropriate for movement or for a public setting, as determined in the sole discretion of the Proprietor, will be permitted in any such dance space or other space being used by Proprietor for purposes of any Activity (i.e. inappropriate pictures or words, clothing that is not stretchy/movement friendly, clothing that does not cover sensitive areas of the body or clothing that would cause a disturbance to others).',
          '4. AGREE to behave respectfully to all others involved in any Activity. I acknowledge that any student who is displaying any behavior deemed inappropriate by the instructor or wearing inappropriate attire, as set forth in Section 3 above, is subject to termination from any class or workshop they have registered for through the Proprietor. This behavior may include, but is not limited to, bullying, inappropriate language, discrimination, and disrespectful conduct. Any person removed from any such class or workshop offered by the Proprietor for displaying any behaviors deemed inappropriate by Proprietor, in its sole discretion, is not permitted a refund of any amount paid for such class or workshop.',
          '5. ACKNOWLEDGE that Proprietor advertises almost exclusively on social media, and I agree to release and waive any claim I may have regarding the use of my name, image, likeness, or other identifying information for this purpose. I authorize Proprietor to use all photos and videos taken related to the Activity on social media platforms. Any photos or videos taken of or related to any Activity are property of Proprietor. I will not oppose any effort by Proprietor to take down any social media posts depicting or related to any Activity that is not authorized by Proprietor.',
          '6. FULLY UNDERSTAND THAT: (a) the ACTIVITY INVOLVES RISKS AND DANGERS OF SERIOUS BODILY INJURY, INCLUDING PERMANENT DISABILITY, PARALYSIS, AND DEATH, to myself and/or others, that may occur as a result of, relating to, or arising out of my participation in the Activity (“RISKS”); (b) these Risks and dangers may be caused by my own actions or inaction, the actions or inaction of others participating in the Activity, the condition of the premises in which the Activity takes place, or THE NEGLIGENCE OF THE “RELEASEES” NAMED BELOW; (c) there may be OTHER RISK AND SOCIAL AND ECONOMIC LOSSES either not known to me or not readily foreseeable at this time; and I FULLY ACCEPT AND ASSUME ALL SUCH RISKS AND ALL RESPONSIBILITY FOR LOSSES, COSTS, AND DAMAGES I incur as a result of my participation or that of the minor in the Activity.',
          '7. HEREBY RELEASE, DISCHARGE, AND COVENANT NOT TO SUE Proprietor, its respective administrators, directors, instructors, agents, officers, members, shareholders, managers, volunteers, and employees, other participants, any sponsors, advertisers, and, if applicable, owner and lessors of premises on which the Activity takes place, (each considered one of the “RELEASEES” herein) FROM ALL LIABILITY, CLAIMS, DEMANDS, LOSSES, OR DAMAGES OCCURRING AS A RESULT OF, RELATING TO, OR ARISING OUT OF MY PARTICIPATION IN THE ACTIVITY, INCLUDING NEGLIGENT RESCUE OPERATIONS AND I FURTHER AGREE that if, I, or anyone on my behalf, makes a claim against any of the Releasees, I WILL INDEMNIFY, SAVE, AND HOLD HARMLESS EACH OF THE RELEASEES from any litigation expenses, attorney fees, loss, liability, damage, or cost which may incur as the result of such claim.',
          '8. AGREE that this Agreement is governed by Michigan law, irrespective of any choice of law provisions, and that any litigation arising out of or related to this Agreement must be litigated in a state or federal court in or closest to Rochester, Michigan.',
        ],
      },
      {
        title: 'Acknowledgment and Signature Statement',
        content: [
          'I AM NOT OBLIGATED TO SIGN THIS AGREEMENT. I HAVE READ THIS AGREEMENT, FULLY UNDERSTAND ITS TERMS, UNDERSTAND THAT I HAVE GIVEN UP SUBSTANTIAL RIGHTS BY SIGNING IT AND HAVE SIGNED IT FREELY AND WITHOUT INDUCEMENT OR ASSURANCE OF ANY NATURE. I INTEND IT TO BE A COMPLETE AND UNCONDITIONAL RELEASE OF ALL LIABILITY TO THE GREATEST EXTENT ALLOWED BY LAW. IF ANY PART OF THIS AGREEMENT IS HELD TO BE INVALID, THE BALANCE SHALL CONTINUE IN FULL FORCE AND EFFECT.',
          'I AM THE PARENT, STUDENT, AND/OR LEGAL GUARDIAN OF THE PERSON ENROLLED FOR CLASSES. I HAVE READ ALL OF THE ABOVE AND AGREE TO IT ON BEHALF OF MINOR. I UNDERSTAND THE NATURE OF THE ACTIVITY AND MINOR’S EXPERIENCE AND CAPABILITIES AND BELIEVE MINOR TO BE QUALIFIED, IN GOOD HEALTH, AND IN PROPER PHYSICAL CONDITION TO PARTICIPATE IN SUCH ACTIVITY. ON BEHALF OF MINOR AND MYSELF, I HEREBY RELEASE, DISCHARGE, COVENANT NOT TO SUE, AND AGREE TO INDEMNIFY AND SAVE AND HOLD HARMLESS EACH OF THE RELEASEES FROM ALL LIABILITY CLAIMS, DEMANDS, LOSSES, OR DAMAGES OCCURRING AS A RESULT OF, RELATING TO, OR ARISING OUT OF MY PARTICIPATION IN THE ACTIVITY, WHETHER CAUSED OR ALLEGED TO BE CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF THE “RELEASEES” OR OTHERWISE, INCLUDING NEGLIGENT RESCUE OPERATION. ON BEHALF OF MINOR AND MYSELF, I FURTHER AGREE THAT IF, DESPITE THIS RELEASE, I, THE MINOR, OR ANYONE ON THE MINOR’S BEHALF MAKES A CLAIM AGAINST ANY OF THE RELEASEES NAMED ABOVE, I WILL INDEMNIFY, SAVE, AND HOLD HARMLESS EACH OF THE RELEASEES FROM ANY LITIGATION EXPENSES, ATTORNEY FEES, LOSS, LIABILITY, DAMAGE, OR COST ANY MAY INCUR AS THE RESULT OF ANY SUCH CLAIM. I FURTHER WARRANT THAT I HAVE THE LEGAL AUTHORITY TO ENTER INTO THIS RELEASE ON BEHALF OF MINOR, AND I AGREE TO INDEMNIFY AND HOLD HARMLESS RELEASEES FROM ANY LIABILITY ARISING OUT OF MY LACK OF LEGAL AUTHORITY TO SIGN THIS DOCUMENT.',
        ],
      },
    ],
  },
  {
    title: 'Photo, Video & Media Release',
    icon: 'Camera',
    items: [
      {
        title: 'Media Release Consent',
        content: [
          'The Dance and Movement Workshop enjoys celebrating the accomplishments of our students and sharing the joy of dance with our community. Throughout the dance season, photographs, video recordings, and audio recordings may be taken during classes, rehearsals, performances, workshops, competitions, special events, and other studio activities.',
          'By signing this release, I, as the parent or legal guardian of the minor child listed below, grant permission to The Dance and Movement Workshop, its owners, employees, instructors, volunteers, and authorized representatives to photograph, videotape, and/or record my child.',
          'I understand that these images and recordings may be used for educational, promotional, and marketing purposes, including but not limited to:',
          'The Dance and Movement Workshop website',
          'Social media platforms (including Facebook, Instagram, TikTok, YouTube, and similar platforms)',
          'Printed advertisements and brochures',
          'Newsletters and email communications',
          'Press releases and newspaper publications',
          'Television or online news coverage',
          'Studio displays and promotional materials',
          'Grant applications and community partnership materials',
          'I understand that my child’s first name may occasionally be used in connection with photographs or videos. My child’s last name, home address, phone number, email address, school, or other personally identifying information will NOT be published without my separate written consent.',
          'I acknowledge that:',
          'The Dance and Movement Workshop may edit, crop, or modify photographs and videos for promotional purposes.',
          'I will not receive compensation for the use of my child’s image or likeness.',
          'All photographs, videos, and recordings become the property of The Dance and Movement Workshop.',
          'Once media is published online or shared with news organizations, The Dance and Movement Workshop cannot control how it may be shared or redistributed by others.',
          'I release and hold harmless The Dance and Movement Workshop, its owners, employees, instructors, volunteers, and representatives from any claims, demands, or liability arising from the lawful use of my child’s photograph, video, voice recording, or likeness as described above.',
        ],
      },
      {
        title: 'Opt-Out Option',
        content: [
          'I understand that participation in photographs and videos is voluntary. If I do not wish for my child to be photographed or recorded for promotional purposes, I must notify The Dance and Movement Workshop in writing. The studio will make every reasonable effort to honor this request; however, I understand that it may not always be possible to exclude my child from incidental appearances in group photographs, audience shots, or recordings of public performances.',
        ],
      },
    ],
  },
  {
    title: 'Medical Emergency Policy',
    icon: 'Stethoscope',
    items: [
      {
        title: 'Emergency Contact Information',
        content: [
          'The health and safety of our students is a top priority at The Dance and Movement Workshop. While every effort is made to provide a safe learning environment, accidents and medical emergencies can occur. This policy outlines how medical situations will be handled.',
          'Parents and legal guardians are responsible for providing accurate and current emergency contact information, medical information, allergies, medications, and any medical conditions that may affect their child’s participation. It is the responsibility of the parent or guardian to notify the studio immediately if this information changes during the dance season.',
        ],
      },
      {
        title: 'Minor Injuries',
        content: [
          'For minor injuries, such as small cuts, scrapes, bruises, or minor muscle discomfort, studio staff may provide basic first aid supplies, including bandages, ice packs, or assistance in resting the injured student. Parents or guardians will be informed of the injury at pick-up or as soon as reasonably possible.',
        ],
      },
      {
        title: 'Medical Emergencies',
        content: [
          'If a student experiences a serious injury or medical emergency, The Dance and Movement Workshop will:',
          'Call 911 or the appropriate emergency medical services immediately when deemed necessary.',
          'Administer reasonable first aid within the scope of staff training while awaiting emergency responders.',
          'Contact the student’s parent or legal guardian using the emergency contact information provided.',
          'If a parent or guardian cannot be reached, contact the emergency contact(s) listed on the student’s registration.',
          'If emergency transportation is necessary, the student may be transported by ambulance to the nearest appropriate medical facility. Any medical expenses, ambulance fees, or hospital charges remain the responsibility of the parent or legal guardian.',
        ],
      },
      {
        title: 'Authorization for Emergency Medical Treatment',
        content: [
          'By enrolling a student at The Dance and Movement Workshop, the parent or legal guardian authorizes studio staff to seek emergency medical treatment for the student if the parent or guardian cannot be reached in a timely manner and immediate medical attention is necessary. This authorization is limited to emergency situations where delaying treatment could jeopardize the student’s health or safety.',
        ],
      },
      {
        title: 'Medications',
        content: [
          'The Dance and Movement Workshop does NOT administer prescription or over-the-counter medications unless required by law or unless specific arrangements have been made in advance and approved by studio management. Parents are responsible for ensuring that students who require emergency medications, such as inhalers or epinephrine auto-injectors, bring them to the studio and are able to access them when needed.',
        ],
      },
      {
        title: 'Illness',
        content: [
          'Students who are ill, have a fever, are experiencing vomiting or diarrhea, or have a contagious condition should NOT attend classes until they are no longer contagious and are well enough to participate safely. The studio reserves the right to ask a student to leave class if illness symptoms develop during the day.',
        ],
      },
      {
        title: 'Assumption of Risk',
        content: [
          'Participation in dance and movement activities involves inherent physical risks, including the possibility of injury. By enrolling in classes, parents and legal guardians acknowledge these risks and agree to release The Dance and Movement Workshop, its owners, employees, instructors, and volunteers from liability for injuries that occur during normal participation, except where caused by gross negligence or willful misconduct.',
        ],
      },
    ],
  },
];

export const policySeeds: PolicySeedCategory[] = SEED_CATEGORIES.map((category, categoryIndex) => ({
  title: category.title,
  icon: category.icon,
  order: categoryIndex,
  items: category.items.map((item, itemIndex) => ({
    title: item.title,
    content: toHtml(item.content),
    order: itemIndex,
  })),
}));
