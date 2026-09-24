import { PrismaService } from '@/infrastructure/database';

interface ReconciliationRow {
  purchaseGrossCredits: string;
  allocatedGrossCredits: string;
  refundedCredits: string;
  refundedAllocationCredits: string;
  expectedEarningsCredits: string;
  earningsCredits: string;
  paidCredits: string;
  transferredFiatMinor: string;
  journalBalanceCredits: string;
  matchedPurchaseCount: number;
  legacyUnallocatedPurchaseCount: number;
  requestCount: number;
  reservationMismatchCount: number;
  unbalancedEventCount: number;
  allocationMismatchCount: number;
  refundMismatchCount: number;
  earningMismatchCount: number;
  mismatchedRequests: string[];
  unbalancedEvents: string[];
  mismatchedPurchases: string[];
  mismatchedRefunds: string[];
  mismatchedEarnings: string[];
}

// One statement gives a consistent PostgreSQL snapshot and aggregates the full
// ledger in the database. Diagnostic identifiers are bounded independently of
// total mismatch counts so large ledgers cannot create an unbounded response.
export async function readRevenueReconciliation(prisma: PrismaService) {
  const [row] = await prisma.$queryRaw<ReconciliationRow[]>`
    WITH allocation_by_purchase AS (
      SELECT purchase_id,
        COALESCE(sum(net_amount) FILTER (WHERE NOT is_refund), 0) AS allocated,
        COALESCE(-sum(net_amount) FILTER (WHERE is_refund), 0) AS compensated,
        bool_or(NOT is_refund) AS has_original
      FROM revenue_allocations GROUP BY purchase_id
    ), matched_purchases AS (
      SELECT p.id, p.credit_price, a.allocated, a.compensated,
        CASE WHEN p.status IN ('refunded', 'reversed') THEN p.credit_price ELSE 0 END AS refund_gross
      FROM chapter_purchases p JOIN allocation_by_purchase a ON a.purchase_id = p.id
      WHERE a.has_original
    ), allocations_totals AS (
      SELECT COALESCE(sum(net_amount) FILTER (WHERE NOT is_refund), 0) AS gross,
        COALESCE(-sum(net_amount) FILTER (WHERE is_refund), 0) AS refunds,
        COALESCE(sum(net_amount) FILTER (WHERE allocation_type <> 'PLATFORM_FEE'), 0) AS earnings
      FROM revenue_allocations
    ), earning_by_allocation AS (
      SELECT allocation_id, sum(amount) AS amount FROM author_earning_ledger GROUP BY allocation_id
    ), earning_mismatches AS (
      SELECT a.id FROM revenue_allocations a
      LEFT JOIN earning_by_allocation e ON e.allocation_id = a.id
      WHERE a.allocation_type <> 'PLATFORM_FEE' AND COALESCE(e.amount, 0) <> a.net_amount
    ), journal_by_event AS (
      SELECT event_key, sum(amount) AS amount FROM revenue_journal_entries GROUP BY event_key
    ), unbalanced_journal AS (
      SELECT event_key FROM journal_by_event WHERE amount <> 0
    ), reservations_by_request AS (
      SELECT request_id, sum(amount) AS amount FROM payout_earning_reservations GROUP BY request_id
    ), reservation_mismatches AS (
      SELECT r.id FROM payout_requests r
      LEFT JOIN reservations_by_request held ON held.request_id = r.id
      WHERE r.idempotency_key IS NOT NULL AND COALESCE(held.amount, 0) <> r.gross_amount
    )
    SELECT
      COALESCE((SELECT sum(credit_price) FROM matched_purchases), 0)::text AS "purchaseGrossCredits",
      (SELECT gross FROM allocations_totals)::text AS "allocatedGrossCredits",
      COALESCE((SELECT sum(refund_gross) FROM matched_purchases), 0)::text AS "refundedCredits",
      (SELECT refunds FROM allocations_totals)::text AS "refundedAllocationCredits",
      (SELECT earnings FROM allocations_totals)::text AS "expectedEarningsCredits",
      COALESCE((SELECT sum(amount) FROM author_earning_ledger), 0)::text AS "earningsCredits",
      COALESCE((SELECT sum(net_amount) FROM payout_requests WHERE status = 'COMPLETED'), 0)::text AS "paidCredits",
      COALESCE((SELECT sum(fiat_amount_minor) FROM payout_requests WHERE status = 'COMPLETED'), 0)::text AS "transferredFiatMinor",
      COALESCE((SELECT sum(amount) FROM journal_by_event), 0)::text AS "journalBalanceCredits",
      (SELECT count(*) FROM matched_purchases)::int AS "matchedPurchaseCount",
      (SELECT count(*) FROM chapter_purchases p WHERE NOT EXISTS (
        SELECT 1 FROM revenue_allocations a WHERE a.purchase_id = p.id AND NOT a.is_refund
      ))::int AS "legacyUnallocatedPurchaseCount",
      (SELECT count(*) FROM payout_requests)::int AS "requestCount",
      (SELECT count(*) FROM reservation_mismatches)::int AS "reservationMismatchCount",
      (SELECT count(*) FROM unbalanced_journal)::int AS "unbalancedEventCount",
      (SELECT count(*) FROM matched_purchases WHERE credit_price <> allocated)::int AS "allocationMismatchCount",
      (SELECT count(*) FROM matched_purchases WHERE refund_gross <> compensated)::int AS "refundMismatchCount",
      (SELECT count(*) FROM earning_mismatches)::int AS "earningMismatchCount",
      ARRAY(SELECT id::text FROM reservation_mismatches ORDER BY id LIMIT 100) AS "mismatchedRequests",
      ARRAY(SELECT event_key FROM unbalanced_journal ORDER BY event_key LIMIT 100) AS "unbalancedEvents",
      ARRAY(SELECT id::text FROM matched_purchases WHERE credit_price <> allocated ORDER BY id LIMIT 100) AS "mismatchedPurchases",
      ARRAY(SELECT id::text FROM matched_purchases WHERE refund_gross <> compensated ORDER BY id LIMIT 100) AS "mismatchedRefunds",
      ARRAY(SELECT id::text FROM earning_mismatches ORDER BY id LIMIT 100) AS "mismatchedEarnings"
  `;
  const allocationDifference =
    BigInt(row.purchaseGrossCredits) - BigInt(row.allocatedGrossCredits);
  const refundDifference =
    BigInt(row.refundedCredits) - BigInt(row.refundedAllocationCredits);
  const earningsDifference =
    BigInt(row.earningsCredits) - BigInt(row.expectedEarningsCredits);
  const absolute = (value: bigint) => (value < 0n ? -value : value);
  const difference =
    absolute(allocationDifference) +
    absolute(refundDifference) +
    absolute(earningsDifference);
  return {
    ...row,
    allocationDifferenceCredits: allocationDifference.toString(),
    refundDifferenceCredits: refundDifference.toString(),
    earningsDifferenceCredits: earningsDifference.toString(),
    differenceCredits: difference.toString(),
    healthy:
      difference === 0n &&
      row.allocationMismatchCount === 0 &&
      row.refundMismatchCount === 0 &&
      row.earningMismatchCount === 0 &&
      row.reservationMismatchCount === 0 &&
      row.unbalancedEventCount === 0,
    generatedAt: new Date().toISOString(),
    currency: 'VND',
  };
}
