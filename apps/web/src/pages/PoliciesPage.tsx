import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Box, Icon, Loader, Text } from '@inithium/ui';
import type { IconName } from '@inithium/ui';
import { useListPoliciesQuery } from '@inithium/api-client';
import type { PolicyCategoryDto } from '@inithium/api-client';

// Rendered as raw HTML (dangerouslySetInnerHTML) - safe because this content is sanitized
// server-side on every write (see libs/api-core/src/schemas/policy.schema.ts) before it's ever
// persisted, so nothing reaching this page can carry a <script> tag or an event handler
// attribute.
const PolicyItemBody = ({ html }: { readonly html: string }) => (
  <div
    className="[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_a]:text-primary-600 [&_a]:underline"
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

interface CategoryItemsProps {
  readonly category: PolicyCategoryDto;
}

// The inner accordion level - a flat, divided list of that category's items, independently
// collapsed by default from the outer category accordion (see PoliciesPage below).
const CategoryItems = ({ category }: CategoryItemsProps) => (
  <Accordion type="multiple" className="flex flex-col">
    {category.items.map((item) => (
      <AccordionItem key={item.id} value={item.id} className="border-b border-surface-200 last:border-b-0">
        <AccordionTrigger>{item.title}</AccordionTrigger>
        <AccordionContent>
          <PolicyItemBody html={item.content} />
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
);

export const PoliciesPage = () => {
  const { data, isLoading } = useListPoliciesQuery();

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
          Studio Policies
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          Tuition, our liability waiver, media release, and medical emergency information for studio families.
        </Text>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : (
        // `items-start` is the fix for the previous layout's uneven-column problem: without it,
        // CSS grid stretches every card in a row to match its tallest row-mate, so expanding one
        // category would visually inflate its shorter neighbor too. With it, each category card's
        // own accordion state drives its own height independently.
        <Accordion type="multiple" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {(data ?? []).map((category) => (
            <AccordionItem key={category.id} value={category.id} className="overflow-hidden rounded-lg border border-surface-300">
              <Box className="px-4">
                <AccordionTrigger>
                  <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                    {category.icon ? <Icon name={category.icon as IconName} size={20} /> : null}
                    <Text as="span" className="text-base font-semibold">
                      {category.title}
                    </Text>
                  </Box>
                </AccordionTrigger>
              </Box>
              <AccordionContent>
                <Box className="px-4">
                  <CategoryItems category={category} />
                </Box>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Box>
  );
};

export default PoliciesPage;
