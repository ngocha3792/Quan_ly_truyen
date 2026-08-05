import { Directive } from '@angular/core';

@Directive({
  selector: 'table[appDataTable]',
  standalone: true,
  host: {
    class: 'ui-data-table',
  },
})
export class DataTableDirective {}
