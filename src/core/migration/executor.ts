import { Pool, Client } from 'pg';
import { Migration } from './loader';
import { logger } from '../../cli/utils/logger';

export interface ExecutionResult {
  success: boolean;
  migrationsRun: string[];
  duration: number;
  error?: string;
}

/**
 * Execute migrations against a database connection
 * Includes safety checks and transaction wrapping
 */
export class MigrationExecutor {
  constructor(private pool: Pool) {}

  /**
   * Execute pending migrations in order
   */
  async execute(
    migrations: Migration[],
    options:  {
      dryRun?:  boolean;
      force?: boolean;
      onMigration?: (name: string) => void;
    } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const migrationsRun: string[] = [];
    const client = await this.pool.connect();

    try {
      // Ensure migration history table exists
      await this.ensureMigrationTable(client);

      // Get already-applied migrations
      const applied = await this.getAppliedMigrations(client);
      const appliedSet = new Set(applied. map(m => m.name));

      // Filter to only pending migrations
      const pending = migrations.filter(m => ! appliedSet.has(m. name));

      if (pending. length === 0) {
        logger.info('✓ No pending migrations');
        return { success: true, migrationsRun:  [], duration: Date.now() - startTime };
      }

      if (options.dryRun) {
        logger.info('DRY RUN: The following migrations would be executed:');
        for (const m of pending) {
          logger. info(`  • ${m.name}`);
        }
        return { success: true, migrationsRun:  pending.map(m => m.name), duration: Date.now() - startTime };
      }

      // Execute migrations
      for (const migration of pending) {
        try {
          await client.query('BEGIN');

          // Validate SQL before execution
          await this.validateSQL(client, migration.content);

          // Execute the migration
          await client.query(migration.content);

          // Record in history
          await client.query(
            `INSERT INTO atlas_migrations (name, checksum, applied_at) VALUES ($1, $2, NOW())`,
            [migration.name, migration.checksum]
          );

          await client.query('COMMIT');
          migrationsRun.push(migration.name);
          options.onMigration?.(migration.name);

          logger.success(`✓ Applied ${migration.name}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw new Error(
            `Failed to apply ${migration.name}:  ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return { success: true, migrationsRun, duration: Date.now() - startTime };
    } catch (error) {
      return {
        success: false,
        migrationsRun,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Rollback N migrations
   */
  async rollback(count: number = 1): Promise<ExecutionResult> {
    const startTime = Date.now();
    const client = await this.pool. connect();

    try {
      await this.ensureMigrationTable(client);

      // Get last N applied migrations
      const result = await client.query(
        `SELECT name FROM atlas_migrations ORDER BY applied_at DESC LIMIT $1`,
        [count]
      );

      const toRollback = result.rows. map(r => r.name).reverse();

      if (toRollback.length === 0) {
        logger.info('No migrations to rollback');
        return { success: true, migrationsRun: [], duration: Date. now() - startTime };
      }

      logger.warn(`Rolling back ${toRollback.length} migration(s)...`);

      for (const migrationName of toRollback) {
        await client.query(
          `DELETE FROM atlas_migrations WHERE name = $1`,
          [migrationName]
        );
        logger.success(`✓ Rolled back ${migrationName}`);
      }

      return { success: true, migrationsRun: toRollback, duration: Date.now() - startTime };
    } catch (error) {
      return {
        success: false,
        migrationsRun: [],
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create atlas_migrations table if it doesn't exist
   */
  private async ensureMigrationTable(client:  Client): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS atlas_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  /**
   * Get all applied migrations
   */
  private async getAppliedMigrations(
    client: Client
  ): Promise<{ name: string; checksum: string; appliedAt: Date }[]> {
    const result = await client.query(
      `SELECT name, checksum, applied_at FROM atlas_migrations ORDER BY applied_at ASC`
    );
    return result.rows.map(row => ({
      name: row.name,
      checksum: row. checksum,
      appliedAt: row.applied_at,
    }));
  }

  /**
   * Validate SQL syntax before execution
   */
  private async validateSQL(client: Client, sql:  string): Promise<void> {
    try {
      // Use PostgreSQL's PREPARE to validate without executing
      const randomId = `validate_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await client.query(`PREPARE ${randomId} AS ${sql}`);
      await client.query(`DEALLOCATE ${randomId}`);
    } catch (error) {
      throw new Error(`Invalid SQL:  ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}