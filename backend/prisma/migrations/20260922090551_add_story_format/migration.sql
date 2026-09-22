-- CreateEnum
CREATE TYPE "story_format" AS ENUM ('novel', 'manga');

-- DropForeignKey
ALTER TABLE "author_earning_ledger" DROP CONSTRAINT "author_earning_ledger_allocation_id_fkey";

-- DropForeignKey
ALTER TABLE "author_earning_ledger" DROP CONSTRAINT "author_earning_ledger_payout_request_id_fkey";

-- DropForeignKey
ALTER TABLE "author_earning_ledger" DROP CONSTRAINT "author_earning_ledger_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_media_slices" DROP CONSTRAINT "chapter_media_slices_media_fkey";

-- DropForeignKey
ALTER TABLE "comment_anchors" DROP CONSTRAINT "comment_anchors_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "comment_anchors" DROP CONSTRAINT "comment_anchors_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "comment_regions" DROP CONSTRAINT "comment_regions_chapter_media_fkey";

-- DropForeignKey
ALTER TABLE "comment_regions" DROP CONSTRAINT "comment_regions_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "offline_package_chapters" DROP CONSTRAINT "offline_package_chapters_package_fkey";

-- DropForeignKey
ALTER TABLE "offline_package_media_pins" DROP CONSTRAINT "offline_package_media_pins_media_asset_fkey";

-- DropForeignKey
ALTER TABLE "offline_package_media_pins" DROP CONSTRAINT "offline_package_media_pins_package_fkey";

-- DropForeignKey
ALTER TABLE "offline_packages" DROP CONSTRAINT "offline_packages_session_fkey";

-- DropForeignKey
ALTER TABLE "offline_packages" DROP CONSTRAINT "offline_packages_user_fkey";

-- DropForeignKey
ALTER TABLE "offline_quotas" DROP CONSTRAINT "offline_quotas_user_fkey";

-- DropForeignKey
ALTER TABLE "payout_accounts" DROP CONSTRAINT "payout_accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "payout_accounts" DROP CONSTRAINT "payout_accounts_verified_by_fkey";

-- DropForeignKey
ALTER TABLE "payout_earning_reservations" DROP CONSTRAINT "payout_earning_reservations_earning_id_fkey";

-- DropForeignKey
ALTER TABLE "payout_earning_reservations" DROP CONSTRAINT "payout_earning_reservations_request_id_fkey";

-- DropForeignKey
ALTER TABLE "payout_requests" DROP CONSTRAINT "payout_requests_account_id_fkey";

-- DropForeignKey
ALTER TABLE "payout_requests" DROP CONSTRAINT "payout_requests_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "payout_requests" DROP CONSTRAINT "payout_requests_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reading_progress_sync_events" DROP CONSTRAINT "reading_progress_sync_events_story_id_fkey";

-- DropForeignKey
ALTER TABLE "reading_progress_sync_events" DROP CONSTRAINT "reading_progress_sync_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_impressions" DROP CONSTRAINT "recommendation_impressions_clicked_story_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_impressions" DROP CONSTRAINT "recommendation_impressions_experiment_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_impressions" DROP CONSTRAINT "recommendation_impressions_story_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_impressions" DROP CONSTRAINT "recommendation_impressions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "revenue_allocations" DROP CONSTRAINT "revenue_allocations_agreement_fk";

-- DropForeignKey
ALTER TABLE "revenue_allocations" DROP CONSTRAINT "revenue_allocations_purchase_fk";

-- DropForeignKey
ALTER TABLE "revenue_allocations" DROP CONSTRAINT "revenue_allocations_recipient_fk";

-- DropForeignKey
ALTER TABLE "revenue_allocations" DROP CONSTRAINT "revenue_allocations_refund_fk";

-- DropForeignKey
ALTER TABLE "revenue_journal_entries" DROP CONSTRAINT "revenue_journal_entries_user_id_fkey";

-- DropForeignKey
ALTER TABLE "revenue_policies" DROP CONSTRAINT "revenue_policies_platform_user_id_fkey";

-- DropForeignKey
ALTER TABLE "revenue_policies" DROP CONSTRAINT "revenue_policies_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "revenue_share_agreements" DROP CONSTRAINT "revenue_share_agreements_author_fk";

-- DropForeignKey
ALTER TABLE "revenue_share_agreements" DROP CONSTRAINT "revenue_share_agreements_creator_fk";

-- DropForeignKey
ALTER TABLE "revenue_share_agreements" DROP CONSTRAINT "revenue_share_agreements_platform_user_id_fkey";

-- DropForeignKey
ALTER TABLE "revenue_share_agreements" DROP CONSTRAINT "revenue_share_agreements_story_fk";

-- DropForeignKey
ALTER TABLE "story_recommendation_scores" DROP CONSTRAINT "story_recommendation_scores_source_story_id_fkey";

-- DropForeignKey
ALTER TABLE "story_recommendation_scores" DROP CONSTRAINT "story_recommendation_scores_target_story_id_fkey";

-- DropForeignKey
ALTER TABLE "tts_manifests" DROP CONSTRAINT "tts_manifests_chapter_fkey";

-- DropForeignKey
ALTER TABLE "tts_manifests" DROP CONSTRAINT "tts_manifests_connection_fkey";

-- DropForeignKey
ALTER TABLE "tts_manifests" DROP CONSTRAINT "tts_manifests_user_fkey";

-- DropForeignKey
ALTER TABLE "tts_quotas" DROP CONSTRAINT "tts_quotas_user_fkey";

-- DropForeignKey
ALTER TABLE "tts_segments" DROP CONSTRAINT "tts_segments_manifest_fkey";

-- DropForeignKey
ALTER TABLE "tts_usage" DROP CONSTRAINT "tts_usage_connection_fkey";

-- DropForeignKey
ALTER TABLE "tts_usage" DROP CONSTRAINT "tts_usage_manifest_fkey";

-- DropForeignKey
ALTER TABLE "tts_usage" DROP CONSTRAINT "tts_usage_user_fkey";

-- DropForeignKey
ALTER TABLE "tts_voice_connections" DROP CONSTRAINT "tts_voice_connections_user_fkey";

-- DropForeignKey
ALTER TABLE "user_story_interactions" DROP CONSTRAINT "user_story_interactions_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "user_story_interactions" DROP CONSTRAINT "user_story_interactions_story_id_fkey";

-- DropForeignKey
ALTER TABLE "user_story_interactions" DROP CONSTRAINT "user_story_interactions_user_id_fkey";

-- DropIndex
DROP INDEX "payout_requests_status_created_idx";

-- DropIndex
DROP INDEX "story_recommendation_scores_source_score_idx";

-- AlterTable
ALTER TABLE "author_earning_ledger" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chapter_media_slices" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "comment_anchors" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "comment_regions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "offline_packages" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "offline_quotas" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payout_accounts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payout_batches" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payout_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reading_progress_sync_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recommendation_experiments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recommendation_impressions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recommendation_models" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "revenue_allocations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "revenue_journal_entries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "revenue_policies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "revenue_share_agreements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "search_index_checkpoints" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "format" "story_format" NOT NULL DEFAULT 'novel';

-- AlterTable
ALTER TABLE "story_recommendation_scores" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tts_manifests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tts_quotas" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tts_segments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tts_usage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tts_voice_connections" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_story_interactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wallet_ledger_transactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "payout_batches_status_created_at_idx" ON "payout_batches"("status", "created_at");

-- CreateIndex
CREATE INDEX "stories_format_status_visibility_idx" ON "stories"("format", "status", "visibility");

-- CreateIndex
CREATE INDEX "story_recommendation_scores_source_story_id_collaborative_s_idx" ON "story_recommendation_scores"("source_story_id", "collaborative_score");

-- AddForeignKey
ALTER TABLE "revenue_share_agreements" ADD CONSTRAINT "revenue_share_agreements_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_share_agreements" ADD CONSTRAINT "revenue_share_agreements_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_share_agreements" ADD CONSTRAINT "revenue_share_agreements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_allocations" ADD CONSTRAINT "revenue_allocations_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "chapter_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_allocations" ADD CONSTRAINT "revenue_allocations_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "revenue_share_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_allocations" ADD CONSTRAINT "revenue_allocations_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_allocations" ADD CONSTRAINT "revenue_allocations_refunds_allocation_id_fkey" FOREIGN KEY ("refunds_allocation_id") REFERENCES "revenue_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_earning_ledger" ADD CONSTRAINT "author_earning_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_earning_ledger" ADD CONSTRAINT "author_earning_ledger_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "revenue_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_earning_ledger" ADD CONSTRAINT "author_earning_ledger_payout_request_id_fkey" FOREIGN KEY ("payout_request_id") REFERENCES "payout_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "payout_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payout_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_earning_reservations" ADD CONSTRAINT "payout_earning_reservations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payout_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_earning_reservations" ADD CONSTRAINT "payout_earning_reservations_earning_id_fkey" FOREIGN KEY ("earning_id") REFERENCES "author_earning_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_regions" ADD CONSTRAINT "comment_regions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_regions" ADD CONSTRAINT "comment_regions_chapter_id_media_asset_id_fkey" FOREIGN KEY ("chapter_id", "media_asset_id") REFERENCES "chapter_media"("chapter_id", "media_asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_media_slices" ADD CONSTRAINT "chapter_media_slices_chapter_id_media_asset_id_fkey" FOREIGN KEY ("chapter_id", "media_asset_id") REFERENCES "chapter_media"("chapter_id", "media_asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_story_interactions" ADD CONSTRAINT "user_story_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_story_interactions" ADD CONSTRAINT "user_story_interactions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_story_interactions" ADD CONSTRAINT "user_story_interactions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_recommendation_scores" ADD CONSTRAINT "story_recommendation_scores_source_story_id_fkey" FOREIGN KEY ("source_story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_recommendation_scores" ADD CONSTRAINT "story_recommendation_scores_target_story_id_fkey" FOREIGN KEY ("target_story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_impressions" ADD CONSTRAINT "recommendation_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_impressions" ADD CONSTRAINT "recommendation_impressions_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "recommendation_experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_packages" ADD CONSTRAINT "offline_packages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_packages" ADD CONSTRAINT "offline_packages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_package_chapters" ADD CONSTRAINT "offline_package_chapters_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "offline_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_package_media_pins" ADD CONSTRAINT "offline_package_media_pins_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "offline_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_package_media_pins" ADD CONSTRAINT "offline_package_media_pins_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_quotas" ADD CONSTRAINT "offline_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_voice_connections" ADD CONSTRAINT "tts_voice_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_manifests" ADD CONSTRAINT "tts_manifests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_manifests" ADD CONSTRAINT "tts_manifests_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_manifests" ADD CONSTRAINT "tts_manifests_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "tts_voice_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_segments" ADD CONSTRAINT "tts_segments_manifest_id_fkey" FOREIGN KEY ("manifest_id") REFERENCES "tts_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_usage" ADD CONSTRAINT "tts_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_usage" ADD CONSTRAINT "tts_usage_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "tts_voice_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_usage" ADD CONSTRAINT "tts_usage_manifest_id_fkey" FOREIGN KEY ("manifest_id") REFERENCES "tts_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_quotas" ADD CONSTRAINT "tts_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_anchors" ADD CONSTRAINT "comment_anchors_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_anchors" ADD CONSTRAINT "comment_anchors_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress_sync_events" ADD CONSTRAINT "reading_progress_sync_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress_sync_events" ADD CONSTRAINT "reading_progress_sync_events_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "author_earning_ledger_user_status_idx" RENAME TO "author_earning_ledger_user_id_status_available_at_idx";

-- RenameIndex
ALTER INDEX "chapter_consistency_issues_chapter_id_is_dismissed_is_resolved_" RENAME TO "chapter_consistency_issues_chapter_id_is_dismissed_is_resol_idx";

-- RenameIndex
ALTER INDEX "chapter_entitlements_chapter_status_idx" RENAME TO "chapter_entitlements_chapter_id_status_idx";

-- RenameIndex
ALTER INDEX "chapter_entitlements_purchase_key" RENAME TO "chapter_entitlements_purchase_id_key";

-- RenameIndex
ALTER INDEX "chapter_entitlements_user_chapter_key" RENAME TO "chapter_entitlements_user_id_chapter_id_key";

-- RenameIndex
ALTER INDEX "chapter_monetization_access_updated_idx" RENAME TO "chapter_monetization_access_type_updated_at_idx";

-- RenameIndex
ALTER INDEX "chapter_monetization_price_band_idx" RENAME TO "chapter_monetization_price_band_id_idx";

-- RenameIndex
ALTER INDEX "chapter_pricing_versions_actor_created_idx" RENAME TO "chapter_pricing_versions_changed_by_id_created_at_idx";

-- RenameIndex
ALTER INDEX "chapter_pricing_versions_chapter_version_key" RENAME TO "chapter_pricing_versions_chapter_id_version_key";

-- RenameIndex
ALTER INDEX "chapter_purchases_chapter_created_idx" RENAME TO "chapter_purchases_chapter_id_created_at_idx";

-- RenameIndex
ALTER INDEX "chapter_purchases_user_history_idx" RENAME TO "chapter_purchases_user_id_created_at_id_idx";

-- RenameIndex
ALTER INDEX "credit_packages_active_sort_idx" RENAME TO "credit_packages_is_active_sort_order_idx";

-- RenameIndex
ALTER INDEX "monetization_price_bands_active_sort_idx" RENAME TO "monetization_price_bands_is_active_sort_order_idx";

-- RenameIndex
ALTER INDEX "payment_orders_provider_status_updated_idx" RENAME TO "payment_orders_provider_status_updated_at_idx";

-- RenameIndex
ALTER INDEX "payment_orders_status_expiry_idx" RENAME TO "payment_orders_status_expires_at_idx";

-- RenameIndex
ALTER INDEX "payment_orders_user_created_idx" RENAME TO "payment_orders_user_id_created_at_id_idx";

-- RenameIndex
ALTER INDEX "payout_accounts_user_active_idx" RENAME TO "payout_accounts_user_id_is_active_idx";

-- RenameIndex
ALTER INDEX "payout_requests_user_status_idx" RENAME TO "payout_requests_user_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "recommendation_impressions_context_created_idx" RENAME TO "recommendation_impressions_context_created_at_idx";

-- RenameIndex
ALTER INDEX "recommendation_impressions_experiment_variant_idx" RENAME TO "recommendation_impressions_experiment_id_variant_idx";

-- RenameIndex
ALTER INDEX "recommendation_impressions_user_created_idx" RENAME TO "recommendation_impressions_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "recommendation_models_active_trained_idx" RENAME TO "recommendation_models_is_active_trained_at_idx";

-- RenameIndex
ALTER INDEX "revenue_allocations_purchase_idx" RENAME TO "revenue_allocations_purchase_id_idx";

-- RenameIndex
ALTER INDEX "revenue_allocations_recipient_status_idx" RENAME TO "revenue_allocations_recipient_user_id_status_settled_at_idx";

-- RenameIndex
ALTER INDEX "revenue_share_agreements_story_effective_idx" RENAME TO "revenue_share_agreements_story_id_effective_from_effective__idx";

-- RenameIndex
ALTER INDEX "revenue_share_agreements_story_version_key" RENAME TO "revenue_share_agreements_story_id_version_key";

-- RenameIndex
ALTER INDEX "story_recommendation_scores_calculated_idx" RENAME TO "story_recommendation_scores_calculated_at_idx";

-- RenameIndex
ALTER INDEX "story_recommendation_scores_pair_version_unique" RENAME TO "story_recommendation_scores_source_story_id_target_story_id_key";

-- RenameIndex
ALTER INDEX "user_story_interactions_created_idx" RENAME TO "user_story_interactions_created_at_idx";

-- RenameIndex
ALTER INDEX "user_story_interactions_story_type_idx" RENAME TO "user_story_interactions_story_id_interaction_type_idx";

-- RenameIndex
ALTER INDEX "user_story_interactions_unique" RENAME TO "user_story_interactions_user_id_story_id_interaction_type_c_key";

-- RenameIndex
ALTER INDEX "user_story_interactions_user_created_idx" RENAME TO "user_story_interactions_user_id_created_at_idx";
