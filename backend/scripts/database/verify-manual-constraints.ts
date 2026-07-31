import { createScriptPrismaClient } from '../shared/prisma-client';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

const expectedIndexes = [
  'users_email_lower_unique',
  'users_username_lower_unique',
  'author_profiles_pen_name_lower_unique',
  'stories_slug_lower_unique',
  'categories_slug_lower_unique',
  'tags_slug_lower_unique',
  'story_categories_one_primary_per_story',
  'story_submissions_one_pending_per_story',
  'reports_open_story_unique',
  'reports_open_chapter_unique',
  'reports_open_comment_unique',
  'reports_open_user_unique',
] as const;

const expectedConstraints = [
  'ratings_score_between_1_and_5',
  'stories_rating_average_between_0_and_5',
  'chapters_number_positive',
  'library_entries_progress_between_0_and_100',
  'reading_progress_percent_between_0_and_100',
  'reading_sessions_positions_non_negative',
  'media_assets_size_non_negative',
  'reports_exactly_one_matching_target',
  'moderation_actions_exactly_one_target',
] as const;

void runScript({
  name: 'verify-manual-constraints',

  async execute({ logger }) {
    const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = current_schema()
    `;

    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE connamespace = (
        SELECT oid
        FROM pg_namespace
        WHERE nspname = current_schema()
      )
    `;

    const indexNames = new Set(indexes.map((row) => row.name));
    const constraintNames = new Set(constraints.map((row) => row.name));

    const missingIndexes = expectedIndexes.filter(
      (name) => !indexNames.has(name),
    );
    const missingConstraints = expectedConstraints.filter(
      (name) => !constraintNames.has(name),
    );

    logger.info('manual database objects checked', {
      expectedIndexes: expectedIndexes.length,
      missingIndexes: missingIndexes.length,
      expectedConstraints: expectedConstraints.length,
      missingConstraints: missingConstraints.length,
    });

    if (missingIndexes.length > 0 || missingConstraints.length > 0) {
      logger.warn('missing indexes', {
        names: missingIndexes.join(','),
      });
      logger.warn('missing constraints', {
        names: missingConstraints.join(','),
      });

      throw new ScriptError(
        'Manual database constraints are incomplete',
        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }
  },

  cleanup: () => prisma.$disconnect(),
});
