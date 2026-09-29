import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components';
import { mergeClassNames } from '../theme/mergeClassNames';

export interface BreadcrumbItem {
  readonly label: string;
  // Omitted for the current page, which renders as plain text rather than a link.
  readonly to?: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
  readonly className?: string;
}

export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => (
  <nav aria-label="Breadcrumb" className={className}>
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 ? (
              <li aria-hidden="true" className="flex items-center text-surface-500">
                <Icon as="span" name="CaretRight" size={12} />
              </li>
            ) : null}
            <li className="flex min-w-0 items-center">
              {item.to && !isCurrent ? (
                <Link
                  to={item.to}
                  className="truncate font-medium text-surface-700 underline-offset-4 transition-colors hover:text-accent-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={mergeClassNames('truncate text-surface-950', isCurrent && 'font-semibold')}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  </nav>
);
