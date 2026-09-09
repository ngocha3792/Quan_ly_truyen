import { IsString, Length } from 'class-validator';

export class RefundPaymentOrderRequest {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
