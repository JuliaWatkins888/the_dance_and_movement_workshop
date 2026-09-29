import type { CreateCourseInput } from '../contracts/course.contract';
import type { CreateProgramInput } from '../contracts/program.contract';
import type { DayOfWeek } from '../contracts/class-section.contract';

// The studio's Fall 2026 – Spring 2027 catalog, restructured from its Jackrabbit export (one row
// per time slot) into program -> course -> section. Times and instructors follow the studio's
// "9/26 Updated" schedule sheet, which is the source of truth wherever the two disagreed;
// Jackrabbit rows missing from that sheet were dropped.

export const SEED_SCHOOL_YEAR = {
  name: '2026–2027',
  registrationOpensAt: '2026-07-13',
  semesters: [
    { key: 'semester-1', name: 'Semester 1', startDate: '2026-09-14', endDate: '2026-12-20' },
    { key: 'semester-2', name: 'Semester 2', startDate: '2027-01-02', endDate: '2027-05-15' },
  ],
} as const;

export type SeedSemesterKey = (typeof SEED_SCHOOL_YEAR.semesters)[number]['key'];

const FULL_YEAR: SeedSemesterKey[] = ['semester-1', 'semester-2'];
const SEMESTER_1_ONLY: SeedSemesterKey[] = ['semester-1'];

export const SEED_SECTION_CAPACITY = 10;

export interface SeedSection {
  // Matched against staff members' linked user names at seed time.
  instructors: string[];
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  semesters: SeedSemesterKey[];
}

export type SeedCourse = Omit<CreateCourseInput, 'programId' | 'order' | 'isPublished'> & {
  isPublished?: boolean;
  sections: SeedSection[];
};

export type SeedProgram = Omit<CreateProgramInput, 'order' | 'isPublished'> & { courses: SeedCourse[] };

const JULIA = 'Julia Watkins';
const LILA = 'Lila Hodgin';
const HANNAH = 'Hannah Rivera';
const MACI = 'Maci McClure';
const AMY = 'Amy Guilmette';

const section = (
  instructors: string[],
  day: DayOfWeek,
  startTime: string,
  endTime: string,
  semesters: SeedSemesterKey[] = FULL_YEAR,
): SeedSection => ({ instructors, day, startTime, endTime, semesters });

const CONTEMPORARY_DRESS_CODE = 'Athletic wear or traditional dance attire. Socks, dance turners, or bare feet are all acceptable.';

export const SEED_PROGRAMS: SeedProgram[] = [
  {
    name: 'Early Childhood',
    slug: 'early-childhood',
    description: 'Playful first steps into dance for our youngest movers, with and without a grown-up.',
    minAgeYears: 1,
    maxAgeYears: 4,
    courses: [
      {
        name: 'Dance Buddies',
        slug: 'dance-buddies',
        description:
          'Dance Buddies is an interactive dance class designed for young children and their grown-ups! This class encourages creativity, coordination, and connection through playful movement and bonding time. Grown-ups and little ones will explore basic dance skills together through obstacle courses, play with props, and dance games. It’s the perfect way to build confidence and spark imagination!',
        dressCode:
          'Tighter fitting t-shirts or tank tops and leggings or sweatpants. NO denim. Leotards, tutus, skirts and tights (traditional dance attire) are more than welcome! Please have long hair pulled back in a ponytail or bun. Ballet or jazz shoes are required, either style and any color will be accepted.',
        styles: ['Creative Movement'],
        minAgeYears: 1,
        maxAgeYears: 3,
        monthlyPriceCents: 4000,
        sections: [section([JULIA], 'Tuesday', '10:00', '10:30'), section([JULIA], 'Wednesday', '10:00', '10:30')],
      },
      {
        name: 'Mini Movers',
        slug: 'mini-movers',
        description:
          'Join us for a high-energy class where toddlers (ages 2.5 – 4 years) can explore the art of dance! Our Mini Movers class is designed to encourage creativity, improve coordination, and build confidence through fun, interactive dance activities. Each week, students will have the chance to express themselves while developing important motor skills, balance, and social abilities. With playful songs, imaginative games, and plenty of wiggle time, your toddler will love every moment of this introductory dance class.',
        dressCode:
          'Tighter fitting t-shirts or tank tops and leggings or sweatpants. NO denim. Leotards, tutus, skirts and tights (traditional dance attire) are more than welcome! Please have long hair pulled back in a ponytail or bun. Ballet shoes are required in “ballet pink” OR color matched to skin tone.',
        styles: ['Creative Movement'],
        minAgeYears: 2.5,
        maxAgeYears: 4,
        monthlyPriceCents: 4000,
        sections: [
          section([JULIA], 'Tuesday', '10:30', '11:00'),
          section([LILA], 'Tuesday', '18:00', '18:30'),
          section([JULIA], 'Thursday', '16:30', '17:00'),
        ],
      },
    ],
  },
  {
    name: 'Petite Performers',
    slug: 'petite-performers',
    description: 'Combination classes that introduce two dance styles at once, building coordination, rhythm, and confidence.',
    minAgeYears: 4,
    maxAgeYears: 6,
    courses: [
      {
        name: 'Petite Performers: Jazz/Hip Hop',
        slug: 'petite-performers-jazz-hip-hop',
        description:
          'Introduce your little one to the magic of dance in our Jazz/Hip Hop Combo class, where the pizazz of jazz meets hip hop’s groove! This class combines the grace and discipline of jazz with the rhythm and energy of hip hop dance. Young dancers will build coordination, balance, and musicality, all while having fun! Jazz basics teach flexibility and balance, while hip hop introduces flow and stylized movement.',
        dressCode:
          'NO denim. Tighter fitting t-shirts or tank tops and leggings or sweatpants OR leotards with skin colored tights. Please have long hair pulled back in a ponytail or bun. Black jazz shoes are required.',
        styles: ['Jazz', 'Hip Hop'],
        minAgeYears: 4,
        maxAgeYears: 6,
        monthlyPriceCents: 5000,
        sections: [
          section([JULIA], 'Monday', '17:30', '18:15'),
          section([JULIA], 'Tuesday', '11:00', '11:45'),
          section([LILA], 'Tuesday', '17:15', '18:00'),
        ],
      },
      {
        name: 'Petite Performers: Ballet/Tap',
        slug: 'petite-performers-ballet-tap',
        description:
          'Introduce your little one to the magic of dance in our Ballet/Tap Combo class, where the elegance of ballet meets the rhythm of tap! This class combines the grace and discipline of ballet with the rhythm and energy of tap dance. Young dancers will build coordination, balance, and musicality, all while having fun! Ballet basics teach poise and flexibility, while tap introduces rhythm and timing through lively, percussive movements.',
        dressCode:
          'NO denim. Leotards, tutus, skirts and tights (traditional dance attire) only. Any color or pattern, as long as it’s proper ballet/dance attire. Please have long hair pulled back in a ponytail or bun. For this class they need both ballet and tap shoes. Please have black tap shoes and either “ballet pink” ballet shoes or skin colored.',
        styles: ['Ballet', 'Tap'],
        minAgeYears: 4,
        maxAgeYears: 6,
        monthlyPriceCents: 5000,
        sections: [section([JULIA], 'Wednesday', '17:00', '17:45'), section([HANNAH], 'Thursday', '17:00', '17:45')],
      },
    ],
  },
  {
    name: 'Kids',
    slug: 'kids',
    description: 'Technique-focused classes that build a strong foundation in ballet and jazz.',
    minAgeYears: 7,
    maxAgeYears: 10,
    courses: [
      {
        name: 'Ballet (Ages 7–10)',
        slug: 'ballet-ages-7-10',
        description:
          'This foundational class introduces dancers to the beauty and discipline of ballet in a welcoming and supportive environment. Students will learn basic ballet positions, steps, and terminology while developing coordination, posture, musicality, and confidence. Through age-appropriate technique, dancers build strength and a love for this classical style of dance. Perfect for first-time ballerinas and those ready to further their training.',
        dressCode:
          'NO denim. Leotards, tutus, skirts and tights in skin colored tone (traditional dance attire) are required. Please have long hair pulled back in a ponytail or bun. Ballet shoes are required in “ballet pink” OR color matched to skin tone.',
        styles: ['Ballet'],
        minAgeYears: 7,
        maxAgeYears: 10,
        monthlyPriceCents: 5000,
        sections: [section([JULIA], 'Monday', '16:45', '17:30', SEMESTER_1_ONLY)],
      },
      {
        name: 'Ballet & Jazz (Ages 7–10)',
        slug: 'ballet-jazz-ages-7-10',
        description:
          'The best of both worlds! This combination class pairs the grace and discipline of ballet with the energy and style of jazz. Dancers build ballet technique through positions, barre work, and terminology, then switch gears to jazz with turns, kicks, leaps, and fun, upbeat choreography. A great fit for dancers who want a well-rounded foundation in two classic styles.',
        dressCode:
          'NO denim. Leotards and skin colored tights (traditional dance attire) are required. Please have long hair pulled back in a ponytail or bun. Ballet shoes (“ballet pink” OR color matched to skin tone) and black jazz shoes are required.',
        styles: ['Ballet', 'Jazz'],
        minAgeYears: 7,
        maxAgeYears: 10,
        monthlyPriceCents: 6000,
        sections: [section([JULIA], 'Wednesday', '17:45', '18:45')],
      },
    ],
  },
  {
    name: 'Teens',
    slug: 'teens',
    description: 'Deeper technique and artistry for tweens and teens, from contemporary to tap.',
    minAgeYears: 11,
    courses: [
      {
        name: 'Contemporary (Ages 11+)',
        slug: 'contemporary-ages-11',
        description:
          'This expressive class blends elements of modern, ballet, and jazz techniques to help dancers explore movement with emotion, freedom, and creativity. Dancers will work on fluidity, floor work, improvisation, and dynamic transitions while building strength and artistry. Contemporary dance encourages personal expression and storytelling through movement, making each class a unique journey. Perfect for dancers looking to connect technique with emotion and explore their individual style.',
        dressCode: CONTEMPORARY_DRESS_CODE,
        styles: ['Contemporary'],
        minAgeYears: 11,
        maxAgeYears: 19,
        monthlyPriceCents: 5000,
        sections: [section([JULIA], 'Monday', '18:30', '19:15')],
      },
      {
        name: 'Beginning Ballet (Ages 11+)',
        slug: 'beginning-ballet-ages-11',
        description:
          'This foundational class introduces dancers to the beauty and discipline of ballet in a welcoming and supportive environment. Students will learn basic ballet positions, steps, and terminology while developing coordination, posture, musicality, and confidence. Through age-appropriate technique, dancers build strength and a love for this classical style of dance. Perfect for first-time ballerinas and those ready to further their training.',
        dressCode:
          'NO denim. Leotards, tutus, skirts and tights in skin colored tone (traditional dance attire) are required. Please have long hair pulled back in a ponytail or bun. Ballet shoes are required in “ballet pink” OR color matched to skin tone.',
        styles: ['Ballet'],
        level: 'beginner',
        minAgeYears: 11,
        maxAgeYears: 19,
        monthlyPriceCents: 6000,
        sections: [section([HANNAH], 'Thursday', '18:30', '19:30', SEMESTER_1_ONLY)],
      },
      {
        name: 'Tap (Ages 11+)',
        slug: 'tap-ages-11',
        description:
          'Get ready to make music with your feet! This energetic and upbeat class teaches rhythm, timing, and coordination through classic tap dance technique. Dancers will learn foundational steps, combinations, and terminology while developing musicality, precision, and performance skills. With a focus on clear sounds and creative expression, this class is perfect for dancers who love to move, groove, and make music with their feet!',
        dressCode: 'Athletic wear or traditional dance attire. Black tap shoes are required.',
        styles: ['Tap'],
        minAgeYears: 11,
        maxAgeYears: 19,
        monthlyPriceCents: 5000,
        sections: [section([MACI, JULIA], 'Friday', '17:00', '17:45')],
      },
      {
        // Price, ages, and semesters were never set in Jackrabbit - seeded as a draft for an admin
        // to complete before it goes live.
        name: 'Jazz Private Lesson',
        slug: 'jazz-private-lesson',
        description:
          'Private jazz lessons offer focused, one-on-one instruction tailored to each dancer’s goals, whether that’s refining technique, preparing a solo, or building confidence with turns, leaps, and style. A great complement to group classes.',
        styles: ['Jazz'],
        monthlyPriceCents: 0,
        isPublished: false,
        sections: [section([HANNAH], 'Thursday', '17:45', '18:15')],
      },
    ],
  },
  {
    name: 'Adult Dance',
    slug: 'adult-dance',
    description: 'Ballet, jazz, and contemporary for adults of every background, whether you’re returning to dance or just starting out.',
    minAgeYears: 18,
    courses: [
      {
        name: 'Adult Ballet',
        slug: 'adult-ballet',
        description:
          'For adult dancers of all levels. Whether you’re returning to ballet or trying it for the first time, this class offers a supportive, low-pressure environment where adults can enjoy the beauty and discipline of ballet. The class focuses on alignment, posture, flexibility, and grace through classic barre work and combinations. It’s a great way to build strength, improve coordination, and reconnect with the joy of movement—no tutu required!',
        dressCode: 'Athletic wear or traditional dance attire. Ballet shoes or socks are required.',
        styles: ['Ballet'],
        minAgeYears: 18,
        monthlyPriceCents: 6000,
        sections: [section([LILA], 'Tuesday', '19:30', '20:30'), section([JULIA], 'Wednesday', '10:30', '11:30')],
      },
      {
        name: 'Adult Jazz',
        slug: 'adult-jazz',
        description:
          'Sharp, energetic, and full of personality, this class brings the fun of jazz dance to adult dancers of all levels. Each class includes a full-body warm-up, across-the-floor progressions with turns, kicks, and leaps, and an upbeat combination that builds musicality, style, and confidence. Whether you’re returning to dance or trying something new, just bring your energy!',
        dressCode: CONTEMPORARY_DRESS_CODE,
        styles: ['Jazz'],
        minAgeYears: 18,
        monthlyPriceCents: 6000,
        sections: [section([JULIA], 'Wednesday', '18:45', '19:45')],
      },
      {
        name: 'Adult Contemporary',
        slug: 'adult-contemporary',
        description:
          'Designed for adult dancers of every background, this class explores the fluid, expressive language of contemporary dance. Each class includes a full-body warm-up, technique work focused on floor work, release, and dynamic transitions, and a combination that invites personal expression. Build strength, flexibility, and artistry in a supportive environment.',
        dressCode: CONTEMPORARY_DRESS_CODE,
        styles: ['Contemporary'],
        minAgeYears: 18,
        monthlyPriceCents: 6000,
        sections: [section([JULIA], 'Monday', '19:15', '20:15')],
      },
      {
        name: 'Adult Jazz/Contemporary',
        slug: 'adult-jazz-contemporary',
        description:
          'Designed for adult dancers of all backgrounds, it combines the sharp, dynamic movement of jazz with the fluid, expressive qualities of contemporary dance. This class is the perfect blend of style, strength, and self-expression. Each class includes a full-body warm-up, technique-building exercises, and a combination that encourages creativity and musicality. Whether you’re returning to dance or trying something new, you’ll leave with a renewed passion for the art of dance.',
        dressCode: CONTEMPORARY_DRESS_CODE,
        styles: ['Jazz', 'Contemporary'],
        minAgeYears: 18,
        monthlyPriceCents: 6000,
        sections: [section([HANNAH], 'Thursday', '19:30', '20:30')],
      },
    ],
  },
  {
    name: 'Movement & Wellness',
    slug: 'movement-and-wellness',
    description: 'Yoga and somatic movement classes to stretch, strengthen, and restore.',
    courses: [
      {
        name: 'Slow Flow Yoga',
        slug: 'slow-flow-yoga',
        description:
          'Slow down, breathe, and move with intention. Slow Flow Yoga links gentle, mindful movement with the breath, moving through poses at an unhurried pace to build strength, balance, and flexibility. Each class closes with time for deep relaxation. Modifications are always offered, making this class welcoming for every body and every level of experience.',
        styles: ['Yoga'],
        monthlyPriceCents: 6000,
        sections: [section([LILA], 'Tuesday', '18:30', '19:30')],
      },
      {
        name: 'Yin Yoga',
        slug: 'yin-yoga',
        description:
          'Yin Yoga is a style of yoga that engages your body in deep stretches. Most of the work is done on the floor and you’ll hold poses for a few minutes at a time. It’s a beautiful way to work on your flexibility while deeply relaxing. This simple Yoga class is perfect for any age 16+. Modifications will always be available for those less mobile, and everyone is welcome no matter your knowledge on the subject!',
        styles: ['Yoga'],
        minAgeYears: 16,
        monthlyPriceCents: 6000,
        sections: [section([JULIA], 'Friday', '17:45', '18:45')],
      },
      {
        name: 'Essential Level Spiral Body Techniques®',
        slug: 'spiral-body-techniques',
        description:
          'Spiral Body Techniques® (SBT) is the dance and movement framework developed by choreographer Molly Shanahan. This class will be taught by Amy Guilmette, who is among the first cohorts of teachers certified as an Essential Level SBT teacher in 2024. www.mollyshanahanspiralbody.com.',
        styles: ['Somatic Movement'],
        minAgeYears: 15,
        monthlyPriceCents: 7000,
        sections: [section([AMY], 'Saturday', '12:00', '13:15')],
      },
    ],
  },
];
