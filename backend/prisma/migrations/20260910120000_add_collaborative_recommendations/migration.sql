BEGIN;

CREATE TYPE interaction_type AS ENUM (
  'chapter_completed', 'chapter_dwell', 'story_followed',
  'story_favorited', 'story_rated'
);

ALTER TABLE users ADD COLUMN recommendation_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE user_story_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  interaction_type interaction_type NOT NULL,
  weight numeric(5,4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  dwell_seconds integer,
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT user_story_interactions_dwell_check CHECK (dwell_seconds IS NULL OR dwell_seconds >= 0),
  CONSTRAINT user_story_interactions_unique UNIQUE (user_id, story_id, interaction_type, chapter_id)
);
CREATE INDEX user_story_interactions_user_created_idx ON user_story_interactions(user_id, created_at);
CREATE INDEX user_story_interactions_story_type_idx ON user_story_interactions(story_id, interaction_type);
CREATE INDEX user_story_interactions_created_idx ON user_story_interactions(created_at);

CREATE TABLE story_recommendation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  target_story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  collaborative_score numeric(8,6) NOT NULL CHECK (collaborative_score >= 0 AND collaborative_score <= 1),
  co_occurrence_count integer NOT NULL CHECK (co_occurrence_count >= 1),
  calculated_at timestamptz(3) NOT NULL,
  model_version varchar(20) NOT NULL,
  CONSTRAINT story_recommendation_scores_pair_version_unique UNIQUE (source_story_id, target_story_id, model_version),
  CONSTRAINT story_recommendation_scores_distinct_stories CHECK (source_story_id <> target_story_id)
);
CREATE INDEX story_recommendation_scores_source_score_idx ON story_recommendation_scores(source_story_id, collaborative_score DESC);
CREATE INDEX story_recommendation_scores_calculated_idx ON story_recommendation_scores(calculated_at);

CREATE TABLE recommendation_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version varchar(20) NOT NULL UNIQUE,
  algorithm varchar(50) NOT NULL,
  start_date timestamptz(3) NOT NULL,
  end_date timestamptz(3) NOT NULL,
  interaction_count integer NOT NULL CHECK (interaction_count >= 0),
  unique_users integer NOT NULL CHECK (unique_users >= 0),
  unique_stories integer NOT NULL CHECK (unique_stories >= 0),
  parameters jsonb NOT NULL,
  hit_rate_at_10 numeric(5,4),
  ndcg_at_10 numeric(5,4),
  coverage numeric(5,4),
  diversity numeric(5,4),
  is_active boolean NOT NULL DEFAULT false,
  trained_at timestamptz(3) NOT NULL,
  activated_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX recommendation_models_active_trained_idx ON recommendation_models(is_active, trained_at);

CREATE TABLE recommendation_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description text,
  control_percent integer NOT NULL CHECK (control_percent BETWEEN 0 AND 100),
  treatment_percent integer NOT NULL CHECK (treatment_percent BETWEEN 0 AND 100),
  target_user_ids text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  started_at timestamptz(3),
  ended_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_experiments_percent_check CHECK (control_percent + treatment_percent <= 100)
);

CREATE TABLE recommendation_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  context varchar(50) NOT NULL,
  story_id uuid REFERENCES stories(id) ON DELETE SET NULL,
  recommended_story_ids text[] NOT NULL,
  algorithm varchar(50) NOT NULL,
  experiment_id uuid REFERENCES recommendation_experiments(id) ON DELETE SET NULL,
  variant varchar(20),
  clicked_story_id uuid REFERENCES stories(id) ON DELETE SET NULL,
  click_position integer,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX recommendation_impressions_user_created_idx ON recommendation_impressions(user_id, created_at);
CREATE INDEX recommendation_impressions_experiment_variant_idx ON recommendation_impressions(experiment_id, variant);
CREATE INDEX recommendation_impressions_context_created_idx ON recommendation_impressions(context, created_at);

COMMIT;
