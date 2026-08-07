import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'relativeTime',
  standalone: true,
})
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return 'Không xác định';
    }

    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();

    if (!Number.isFinite(timestamp)) {
      return 'Không xác định';
    }

    const difference = Date.now() - timestamp;

    if (difference < 0) {
      return 'Vừa xong';
    }

    const seconds = Math.floor(difference / 1000);

    if (seconds < 45) {
      return 'Vừa xong';
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes} phút trước`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours} giờ trước`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `${days} ngày trước`;
    }

    const weeks = Math.floor(days / 7);

    if (weeks < 5) {
      return `${weeks} tuần trước`;
    }

    const months = Math.floor(days / 30);

    if (months < 12) {
      return `${months} tháng trước`;
    }

    const years = Math.floor(days / 365);

    return `${years} năm trước`;
  }
}
