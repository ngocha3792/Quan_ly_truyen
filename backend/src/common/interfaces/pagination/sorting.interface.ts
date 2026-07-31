import type { SortDirection } from '@/common/enums';

export interface SortOption<TField extends string = string> {
    field: TField;
    direction: SortDirection;
}