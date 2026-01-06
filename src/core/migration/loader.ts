import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '../../cli/utils/logger';

export interface Migration {
  name: string;
  version: string;
  content: string;
  checksum: string;
  path: string;
}

/**
 * Load and validate migrations from filesystem
 */
export class MigrationLoader {
  constructor(private migrationsDir: string) {}

  /**
   * Load all migrations from directory, sorted by version
   */
  async loadAll(): Promise<Migration[]> {
    try {
      const files = await readdir(this.migrationsDir);
      
      // Filter SQL files and sort by version number
      const sqlFiles = files
        .filter(f => f.endsWith('.sql'))
        .sort((a, b) => {
          const versionA = parseInt(a.match(/^(\d+)/)?.[1] || '0');
          const versionB = parseInt(b.match(/^(\d+)/)?.[1] || '0');
          return versionA - versionB;
        });

      const migrations: Migration[] = [];

      for (const file of sqlFiles) {
        const path = join(this.migrationsDir, file);
        const content = await readFile(path, 'utf-8');
        const version = file.match(/^(\d+)/)?.[1] || '0';
        const checksum = this.computeChecksum(content);

        migrations.push({
          name: file. replace(/\. sql$/, ''),
          version,
          content,
          checksum,
          path,
        });
      }

      return migrations;
    } catch (error) {
      throw new Error(
        `Failed to load migrations from ${this.migrationsDir}:  ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Create a new migration file
   */
  async create(name: string, content: string): Promise<Migration> {
    const timestamp = Date.now();
    const versionNumber = await this.getNextVersionNumber();
    const fileName = `${versionNumber}_${name}. sql`;
    const filePath = join(this.migrationsDir, fileName);

    // In real implementation, would write to file
    // For now, just return the migration object
    const checksum = this.computeChecksum(content);

    return {
      name:  fileName. replace(/\.sql$/, ''),
      version: String(versionNumber),
      content,
      checksum,
      path: filePath,
    };
  }

  /**
   * Compute SHA256 checksum of migration content
   */
  private computeChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get next available version number
   */
  private async getNextVersionNumber(): Promise<number> {
    try {
      const files = await readdir(this.migrationsDir);
      const versions = files
        .map(f => parseInt(f.match(/^(\d+)/)?.[1] || '0'))
        .filter(v => ! isNaN(v));
      
      return (Math.max(0, ... versions) || 0) + 1;
    } catch {
      return 1;
    }
  }
}