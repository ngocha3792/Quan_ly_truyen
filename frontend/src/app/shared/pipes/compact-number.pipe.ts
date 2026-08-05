import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'compactNumber', standalone: true })
export class CompactNumberPipe implements PipeTransform {
  transform(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
}
