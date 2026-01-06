import { CommanderError } from 'commander';
import { Pool } from 'pg';
import { config as loadEnv } from 'dotenv';
import { MigrationLoader } from '../../core/migration/loader';
import { MigrationExecutor } from '../../core/migration/executor';
import { loadConfig } from '../../config/loader';
import { logger } from '../utils/logger';

loadEnv();

export async function migrateCommand(options: {
  env:  string;
  dryRun?:  boolean;
  force?: boolean;
}): Promise<void> {
  try {
    const atlasConfig = await loadConfig('./atlas.yaml');
    const envConfig = atlasConfig.environments[options.env];

    if (!envConfig) {
      logger.error(`Environment "${options.env}" not found in atlas.yaml`);
      process.exit(1);
    }

    // Create database connection pool
    const pool = new Pool({
      host: envConfig.database.host,
      port: envConfig.database.port,
      user: envConfig.database.user,
      password: envConfig. database.password,
      database: envConfig.database.database,
    });

    logger.info(`Connecting to ${options.env} database...`);

    // Load migrations
    const loader = new MigrationLoader(envConfig.migrationsPath);
    const migrations = await loader.loadAll();

    if (migrations.length === 0) {
      logger.info('No migrations found');
      await pool.end();
      return;
    }

    logger.info(`Found ${migrations.length} migration(s)`);

    // Execute migrations
    const executor = new MigrationExecutor(pool);
    const result = await executor.execute(migrations, {
      dryRun: options.dryRun,
      force: options.force,
      onMigration: (name) => {
        // Can be used for progress tracking
      },
    });

    if (result.success) {
      if (result.migrationsRun.length > 0) {
        logger.success(
          `Applied ${result.migrationsRun.length} migration(s) in ${result.duration}ms`
        );
      }
    } else {
      logger.error(result.error || 'Migration failed');
      process.exit(1);
    }

    await pool.end();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}