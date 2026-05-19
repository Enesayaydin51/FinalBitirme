/**
 * PostgreSQL migration — gym-app-database/*.sql dosyalarını sırayla çalıştırır.
 * Kullanım: DATABASE_URL=... node scripts/migrate.js
 * veya yerel: npm run migrate (gym-app-backend/.env)
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function buildPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'gym_app_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
}

const ORDERED_FILES = [
  '01_create_users_table.sql',
  '02_create_gym_tables.sql',
  '03_create_user_details_table.sql',
  '04_add_gender_age_to_user_details.sql',
  '05_create_foods_table.sql',
  '07_exercise_program_table.sql',
  '08_create_nutrition_plans_table.sql',
  '09_create_exercise_survey_table.sql',
  '10_create_ai_exercise_programs_table.sql',
  '11_drop_old_training_program_tables.sql',
  '12_add_user_avatar.sql',
  '13_add_membership_to_users.sql',
  '14_achievements.sql',
  '15_user_xp_ledger.sql',
  '16_ai_weekly_usage.sql',
  'init_database.sql',
];

async function run() {
  const dbDir = path.join(__dirname, '..', 'gym-app-database');
  const pool = buildPool();

  try {
    const ping = await pool.query('SELECT NOW()');
    console.log('✅ DB bağlantısı:', ping.rows[0].now);

    for (const file of ORDERED_FILES) {
      const filePath = path.join(dbDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn('⚠️  Atlanıyor (yok):', file);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log('▶️ ', file);
      await pool.query(sql);
      console.log('   ✓ tamam');
    }

    console.log('\n✅ Tüm migration dosyaları uygulandı.');
  } catch (err) {
    console.error('❌ Migration hatası:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
