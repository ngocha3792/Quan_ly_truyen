# Collaborative recommendation

Sprint 11 adds an item-item recommendation foundation beside the existing
heuristic story feed. Only completed reading, meaningful dwell (at least 30s),
follow/favorite and positive ratings are recorded as implicit signals; raw page
views are never written as recommendation interactions.

The nightly worker trains over an eight-week window and skips training before
42 days or 1,000 interactions. Co-visitation scores use Jaccard similarity and
are stored with a model version. Collaborative results exclude stories already
interacted with and expose a reason/fallback code; heuristic recommendations
remain the safe fallback for anonymous, opted-out, cold-start, or unavailable
models.

Users can disable personalization from their account profile. Recommendation
impressions store only context, IDs, algorithm, experiment and variant, with no
raw content. Variant assignment is deterministic by user ID so users do not
switch cohorts between requests.

The migration is `20260910120000_add_collaborative_recommendations`. It is safe
to deploy before activating a treatment; keep the experiment control-only until
the offline metrics and at least six to eight weeks of production analytics have
been reviewed. Unit tests cover signal weights and hybrid score composition.
