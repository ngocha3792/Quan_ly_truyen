import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AdminAdjustWalletRequest {
  @IsIn(['CREDIT', 'DEBIT'])
  direction!: 'CREDIT' | 'DEBIT';

  @Matches(/^[1-9]\d{0,15}$/u)
  amount!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
