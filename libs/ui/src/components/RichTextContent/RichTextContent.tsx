import { mergeClassNames } from '../../theme/mergeClassNames';

export interface RichTextContentProps {
  // Must already be sanitized server-side - this renders it as raw HTML.
  readonly html: string;
  readonly className?: string;
}

const BASE_CLASSES =
  '[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_a]:text-primary-600 [&_a]:underline';

export const RichTextContent = ({ html, className }: RichTextContentProps) => (
  <div className={mergeClassNames(BASE_CLASSES, className)} dangerouslySetInnerHTML={{ __html: html }} />
);
