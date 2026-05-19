const dbConnection = require('../database/connection');

class AIWeeklyUsageRepository {
  constructor() {
    this.db = dbConnection;
  }

  async countThisWeekByUserIdAndFeature(userId, featureKey) {
    const query = `
      SELECT COUNT(*)::int AS c
      FROM ai_weekly_usage
      WHERE user_id = $1
        AND feature_key = $2
        AND created_at >= date_trunc('week', CURRENT_DATE)
    `;
    const result = await this.db.query(query, [userId, featureKey]);
    return result.rows[0]?.c ?? 0;
  }

  async recordUse(userId, featureKey) {
    const query = `
      INSERT INTO ai_weekly_usage (user_id, feature_key, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id, user_id, feature_key, created_at
    `;
    const result = await this.db.query(query, [userId, featureKey]);
    return result.rows[0] ?? null;
  }
}

module.exports = AIWeeklyUsageRepository;
