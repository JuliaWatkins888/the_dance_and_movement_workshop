import { Box, Input, Select, SelectItem } from '../components';

export interface SearchFilterFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface SearchFilterBarProps {
  readonly searchValue: string;
  readonly onSearchChange: (value: string) => void;
  readonly searchField: string;
  readonly onSearchFieldChange: (field: string) => void;
  readonly fieldOptions: SearchFilterFieldOption[];
  readonly placeholder?: string;
  readonly className?: string;
}

// Generic over fieldOptions rather than hardcoded to any one entity's fields - a future Pages
// module searching by title/slug reuses this unchanged, just with different fieldOptions.
export const SearchFilterBar = ({
  searchValue,
  onSearchChange,
  searchField,
  onSearchFieldChange,
  fieldOptions,
  placeholder = 'Search...',
  className,
}: SearchFilterBarProps) => (
  <Box flex={{ direction: 'row', gap: 12, align: 'center' }} className={className}>
    <Select value={searchField} onValueChange={onSearchFieldChange} className="w-40 shrink-0">
      {fieldOptions.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </Select>
    <Input
      value={searchValue}
      onChange={(event) => onSearchChange(event.target.value)}
      placeholder={placeholder}
      className="flex-1"
    />
  </Box>
);
