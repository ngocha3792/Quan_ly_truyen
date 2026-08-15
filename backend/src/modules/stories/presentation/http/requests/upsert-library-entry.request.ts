import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { LibraryEntryStatus } from '../../../application';

const LIBRARY_STATUSES: readonly LibraryEntryStatus[] = [
  'PLAN_TO_READ',
  'READING',
  'COMPLETED',
  'ON_HOLD',
  'DROPPED',
];

export class UpsertLibraryEntryRequest {
  @IsOptional()
  @IsIn(LIBRARY_STATUSES)
  status?: LibraryEntryStatus;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
