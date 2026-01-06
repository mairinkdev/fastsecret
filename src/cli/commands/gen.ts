import { Pool } from 'pg';
import { readFile } from 'fs/promises';
import { config as loadEnv } from 'dotenv';
import { parseSchema } from '../../core/schema/parser';
import { MigrationLoader } from '../../core/migration/loader';
import { introspectSchema } from '../../core/database/introspection';
import { diffSchemas } from '../../core/schema/differ';
import { loadConfig } from '../../config/loader';
import { logger } from '../utils/logger';
import { generateSQL } from '../../core/migration/generator';

loadEnv();

export async function genCommand(options: {
  schema: string;
  env: string;
  name?:  string;
}): Promise<void> {
  try {
    const atlasConfig = await loadConfig('./atlas.yaml');
    const envConfig = atlasConfig.environments[options.env];

    if (!envConfig) {
      logger.error(`Environment "${options.env}" not found`);
      process.exit(1);
    }

    // Read desired schema
    const schemaContent = await readFile(options.schema, 'utf-8');
    const desiredSchema = parseSchema(schemaContent);

    logger.info('Reading current database schema...');

    // Connect and introspect current schema
    const pool = new Pool({
      host: envConfig.database.host,
      port: envConfig.database.port,
      user: envConfig.database.user,
      password: envConfig. database.password,
      database: envConfig.database.database,
    });

    const currentSchema = await introspectSchema(pool);

    // Diff schemas
    const diff = diffSchemas(currentSchema, desiredSchema);

    if (diff.newTables.length === 0 &&
        diff.droppedTables.length === 0 &&
        diff.modifiedTables.length === 0) {
      logger.info('✓ No schema changes detected');
      await pool.end();
      return;
    }

    // Show warnings
    if (diff.warnings.length > 0) {
      logger.warn('Schema changes detected:');
      for (const warning of diff.warnings) {
        logger.warn(`  • ${warning}`);
      }
    }

    // Generate migration SQL
    const migrationSQL = generateSQL(diff);

    logger.info('Generated migration SQL:');
    console.log('---\n' + migrationSQL + '\n---\n');

    // Create migration file
    const loader = new MigrationLoader(envConfig.migrationsPath);
    const migrationName = options.name || `schema_change_${Date.now()}`;
    const migration = await loader.create(migrationName, migrationSQL);

    logger.success(`Migration created: ${migration.name}`);
    logger.info(`Run "atlas migrate --env ${options.env}" to apply`);

    await pool.end();
  } catch (error) {
    logger.error(error instanceof Error ?  error.message : String(error));
    process.exit(1);
  }
}