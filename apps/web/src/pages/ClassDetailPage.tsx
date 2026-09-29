import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, Breadcrumbs, Button, Divider, Loader, Pill, Text } from '@inithium/ui';
import { useGetClassCourseBySlugQuery, usePageParams } from '@inithium/api-client';
import type { CatalogSectionDto, ClassPlanOptionDto } from '@inithium/api-client';
import {
  LEVEL_LABELS,
  formatAgeRange,
  formatCents,
  formatDateRange,
  formatDays,
  formatInstructors,
  formatOpenings,
  formatTimeRange,
  planDetail,
  planPriceLabel,
  planTitle,
} from './classes/classFormat';
import { ProgramBanner } from './classes/ProgramBanner';

const planKey = (plan: ClassPlanOptionDto): string => `${plan.kind}:${plan.semesterId ?? ''}`;

interface ChoiceCardProps {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onSelect: (value: string) => void;
  readonly children: ReactNode;
}

// A native radio styled as a selectable card, so keyboard and screen-reader behavior come for
// free while the whole card stays the click target.
const ChoiceCard = ({ name, value, checked, disabled, onSelect, children }: ChoiceCardProps) => (
  <label
    className={[
      'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500',
      checked ? 'border-primary-500 bg-primary-500/10' : 'border-surface-300 hover:border-surface-500',
      disabled ? 'cursor-not-allowed opacity-60' : '',
    ].join(' ')}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      disabled={disabled}
      onChange={() => onSelect(value)}
      className="mt-1 accent-primary-500"
    />
    <span className="flex min-w-0 flex-1 flex-col gap-1">{children}</span>
  </label>
);

const SectionChoice = ({ section }: { section: CatalogSectionDto }) => (
  <>
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
      {formatDays(section.daysOfWeek)} · {formatTimeRange(section.startTime, section.endTime)}
    </Text>
    <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
      with {formatInstructors(section.instructors)}
    </Text>
    <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
      {section.semesters.map((semester) => semester.name).join(' & ')} · {formatDateRange(section.startDate, section.endDate)}
    </Text>
    <Text
      as="span"
      textColor={section.openings <= 0 ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 600 }}
      className="text-xs font-medium"
    >
      {formatOpenings(section.openings)}
    </Text>
  </>
);

const PlanChoice = ({ plan }: { plan: ClassPlanOptionDto }) => (
  <>
    <span className="flex items-baseline justify-between gap-3">
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        {planTitle(plan)}
      </Text>
      <span className="flex items-baseline gap-2">
        {plan.fullPriceCents !== undefined && plan.fullPriceCents > plan.amountCents ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="text-sm line-through">
            {formatCents(plan.fullPriceCents)}
          </Text>
        ) : null}
        <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
          {planPriceLabel(plan)}
        </Text>
      </span>
    </span>
    <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
      {planDetail(plan)}
    </Text>
  </>
);

const DetailBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box flex={{ direction: 'col', gap: 6 }}>
    <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
      {title}
    </Text>
    {children}
  </Box>
);

export const ClassDetailPage = () => {
  const { slug } = usePageParams();
  const { data: course, isLoading, isError } = useGetClassCourseBySlugQuery(slug ?? '', { skip: !slug });
  const [searchParams] = useSearchParams();
  const requestedSectionId = searchParams.get('section');
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | undefined>(undefined);

  const selectedSection = course?.sections.find((section) => section.id === sectionId);

  // Preselects the time slot picked on the program page, or the only one when there's no choice.
  useEffect(() => {
    const requested = course?.sections.find((section) => section.id === requestedSectionId);
    if (requested) setSectionId(requested.id);
    else if (course?.sections.length === 1) setSectionId(course.sections[0]?.id);
  }, [course, requestedSectionId]);

  // A different time slot can offer different plans (e.g. no full-year option).
  useEffect(() => {
    setSelectedPlanKey(selectedSection?.planOptions[0] ? planKey(selectedSection.planOptions[0]) : undefined);
  }, [selectedSection]);

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (!course || isError) {
    return (
      <Box flex={{ direction: 'col', align: 'start', gap: 12 }} padding={{ base: 32 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Class not found
        </Text>
        <Button asChild variant={{ kind: 'outlined', color: 'primary' }}>
          <Link to="/classes">Browse all classes</Link>
        </Button>
      </Box>
    );
  }

  return (
    <Box flex={{ direction: 'col' }} className="w-full">
      <ProgramBanner program={course.program} />

      <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }} className="mx-auto w-full max-w-5xl">
        <Breadcrumbs
          items={[
            { label: 'Classes', to: '/classes' },
            { label: course.program.name, to: `/programs/${course.program.slug}` },
            { label: course.name },
          ]}
        />

        <Box flex={{ direction: 'col', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm font-semibold uppercase tracking-wide">
            {course.program.name}
          </Text>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
            {course.name}
          </Text>
          <Box flex={{ direction: 'row', gap: 6, align: 'center' }} className="flex-wrap">
            <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
              {formatAgeRange(course.minAgeYears, course.maxAgeYears)}
            </Pill>
            {course.level ? (
              <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-950">
                {LEVEL_LABELS[course.level]}
              </Pill>
            ) : null}
            {course.styles.map((style) => (
              <Pill key={style} color={{ color: 'secondary', intensity: 500 }} className="text-secondary-foreground-500">
                {style}
              </Pill>
            ))}
          </Box>
        </Box>

        <Box className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
          <Box flex={{ direction: 'col', gap: 20 }}>
            {course.description ? (
              <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="whitespace-pre-line">
                {course.description}
              </Text>
            ) : null}
            {course.dressCode ? (
              <DetailBlock title="Dress code">
                <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
                  {course.dressCode}
                </Text>
              </DetailBlock>
            ) : null}
          </Box>

          <Box
            flex={{ direction: 'col', gap: 20 }}
            bgColor={{ color: 'surface', intensity: 100 }}
            borderColor={{ color: 'surface', intensity: 300 }}
            className="h-fit rounded-lg border p-5"
          >
            {course.sections.length === 0 ? (
              <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                This class isn’t currently open for registration. Check back soon!
              </Text>
            ) : (
              <>
                <DetailBlock title="1. Choose a time">
                  <div role="radiogroup" aria-label="Class time" className="flex flex-col gap-2">
                    {course.sections.map((section) => (
                      <ChoiceCard
                        key={section.id}
                        name="section"
                        value={section.id}
                        checked={section.id === sectionId}
                        onSelect={setSectionId}
                      >
                        <SectionChoice section={section} />
                      </ChoiceCard>
                    ))}
                  </div>
                </DetailBlock>

                <Divider />

                <DetailBlock title="2. Choose how to pay">
                  {selectedSection ? (
                    <div role="radiogroup" aria-label="Payment plan" className="flex flex-col gap-2">
                      {selectedSection.planOptions.map((plan) => (
                        <ChoiceCard
                          key={planKey(plan)}
                          name="plan"
                          value={planKey(plan)}
                          checked={planKey(plan) === selectedPlanKey}
                          onSelect={setSelectedPlanKey}
                        >
                          <PlanChoice plan={plan} />
                        </ChoiceCard>
                      ))}
                    </div>
                  ) : (
                    <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                      Pick a time above to see pricing.
                    </Text>
                  )}
                  <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                    Semester and full-year plans are paid up front and can’t be withdrawn. Monthly plans can be withdrawn
                    anytime; you just won’t be charged for the following month.
                  </Text>
                </DetailBlock>

                {/* Registration wires into the ecommerce cart in the next pass. */}
                <Button variant={{ kind: 'filled', color: 'primary' }} className="w-full" disabled>
                  Online registration coming soon
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ClassDetailPage;
