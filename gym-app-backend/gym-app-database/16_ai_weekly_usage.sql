-- Free plan AI quota tracking.
-- Her AI destekli özellik ücretsiz planda haftada 1 kullanım hakkı verir; Pro kullanıcılar bu tabloya takılmaz.
CREATE TABLE IF NOT EXISTS ai_weekly_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_key VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_weekly_usage_user_feature_created
    ON ai_weekly_usage(user_id, feature_key, created_at DESC);

COMMENT ON TABLE ai_weekly_usage IS 'Ücretsiz planda AI destekli özelliklerin haftalık kullanım kayıtları';
COMMENT ON COLUMN ai_weekly_usage.feature_key IS 'nutrition_question | nutrition_plan | food_suggestions | exercise_program | plate_analyze | form_score';
