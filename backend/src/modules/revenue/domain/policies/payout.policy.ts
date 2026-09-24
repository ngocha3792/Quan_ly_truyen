export interface PayoutPolicySnapshot {
  minimumPayoutCredits: string;
  feeBasisPoints: number;
  taxBasisPoints: number;
  fiatMinorPerCredit: string;
}

export const MAX_PAYOUT_CREDITS = 9_000_000_000_000_000n;
export const MAX_FIAT_MINOR_AMOUNT = 9_223_372_036_854_775_807n;

export function calculatePayoutAmounts(
  gross: bigint,
  policy: PayoutPolicySnapshot,
) {
  if (gross <= 0n || gross < BigInt(policy.minimumPayoutCredits)) {
    throw new Error('PAYOUT_MINIMUM');
  }
  if (
    ![policy.feeBasisPoints, policy.taxBasisPoints].every(
      (value) => Number.isInteger(value) && value >= 0,
    ) ||
    policy.feeBasisPoints + policy.taxBasisPoints >= 10_000 ||
    BigInt(policy.fiatMinorPerCredit) <= 0n ||
    BigInt(policy.fiatMinorPerCredit) > 1_000_000n
  ) {
    throw new Error('PAYOUT_POLICY_INVALID');
  }
  const fee = (gross * BigInt(policy.feeBasisPoints)) / 10_000n;
  const tax = (gross * BigInt(policy.taxBasisPoints)) / 10_000n;
  const net = gross - fee - tax;
  const fiatAmountMinor = net * BigInt(policy.fiatMinorPerCredit);
  if (gross > MAX_PAYOUT_CREDITS || fiatAmountMinor > MAX_FIAT_MINOR_AMOUNT)
    throw new Error('PAYOUT_AMOUNT_TOO_LARGE');
  return {
    gross,
    fee,
    tax,
    net,
    fiatAmountMinor,
  };
}

export function reserveEarningParts(
  earnings: readonly { id: string; amount: bigint; reservedAmount: bigint }[],
  gross: bigint,
) {
  const remainingByEntry = earnings.map((entry) => ({
    id: entry.id,
    amount: entry.amount - entry.reservedAmount,
  }));
  const available = remainingByEntry.reduce(
    (sum, entry) => sum + entry.amount,
    0n,
  );
  if (gross <= 0n || available < gross)
    throw new Error('PAYOUT_INSUFFICIENT_EARNINGS');
  let needed = gross;
  const reservations: { earningId: string; amount: bigint }[] = [];
  for (const entry of remainingByEntry) {
    if (entry.amount <= 0n || needed <= 0n) continue;
    const amount = entry.amount < needed ? entry.amount : needed;
    reservations.push({ earningId: entry.id, amount });
    needed -= amount;
  }
  if (needed !== 0n) throw new Error('PAYOUT_INSUFFICIENT_EARNINGS');
  return reservations;
}
