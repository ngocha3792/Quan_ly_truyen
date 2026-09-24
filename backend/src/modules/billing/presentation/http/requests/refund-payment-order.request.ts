import { IsString, Length } from 'class-validator';

export class RefundPaymentOrderRequest {
  @IsString()
  @Length(5, 500)
  reason!: string;
}

export class ManualRefundPaymentOrderRequest extends RefundPaymentOrderRequest {
  /** Mã giao dịch của lệnh chuyển trả, để đối chiếu lại trên sao kê. */
  @IsString()
  @Length(3, 160)
  transferReference!: string;
}
