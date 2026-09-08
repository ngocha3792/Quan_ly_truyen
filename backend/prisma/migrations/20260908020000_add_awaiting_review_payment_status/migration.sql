ALTER TYPE "payment_order_status" ADD VALUE IF NOT EXISTS 'awaiting_review' AFTER 'pending';
