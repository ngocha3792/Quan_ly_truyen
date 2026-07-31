export interface SortOption<TField extends string = string> {
    field: TField;
    direction: 'asc' | 'desc';
}