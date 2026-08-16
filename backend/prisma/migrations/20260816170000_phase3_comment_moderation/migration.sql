-- Phase 3 keeps DELETED for owner self-deletion and adds distinct moderator states.
ALTER TYPE "moderation_status" ADD VALUE IF NOT EXISTS 'pending' AFTER 'visible';
ALTER TYPE "moderation_status" ADD VALUE IF NOT EXISTS 'removed' AFTER 'hidden';

ALTER TYPE "moderation_action_type" ADD VALUE IF NOT EXISTS 'hold_comment' AFTER 'hide_comment';
ALTER TYPE "moderation_action_type" ADD VALUE IF NOT EXISTS 'restore_comment' BEFORE 'delete_comment';
ALTER TYPE "moderation_action_type" ADD VALUE IF NOT EXISTS 'warn_user' AFTER 'delete_comment';
