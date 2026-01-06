#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { planCommand } from './commands/plan';
import { migrateCommand } from './commands/migrate';
import { rollbackCommand } from './commands/rollback';
import { statusCommand } from './commands/status';
import { genCommand } from './commands/gen';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('atlas')
  .description('Schema-as-code migration tool for PostgreSQL')
  .version('0.1.0');

program
  .command('init [project-name]')
  .description('Initialize a new Atlas Lite project')
  .action(initCommand);

program
  .command('plan')
  .description('Detect schema drift across environments')
  .option('-e, --env <environment>', 'Target environment (dev, staging, prod)', 'dev')
  .action(planCommand);

program
  .command('migrate')
  .description('Run pending migrations on target environment')
  .option('-e, --env <environment>', 'Target environment', 'dev')
  .option('--dry-run', 'Show what would be executed without running')
  .option('--force', 'Skip safety checks (dangerous)')
  .action(migrateCommand);

program
  .command('rollback')
  .description('Rollback migrations')
  .option('-e, --env <environment>', 'Target environment', 'dev')
  .option('-n, --number <count>', 'Number of migrations to rollback', '1')
  .option('--force', 'Skip confirmation prompt')
  .action(rollbackCommand);

program
  .command('status')
  .description('Show migration status across environments')
  .option('--json', 'Output as JSON')
  .action(statusCommand);

program
  .command('gen')
  .description('Generate migration from schema diff')
  .option('--schema <path>', 'Path to desired schema file', 'schema.sql')
  .option('--env <environment>', 'Source environment to compare against', 'dev')
  .option('--name <name>', 'Migration name (auto-generated if not provided)')
  .action(genCommand);

program.on('command:*', () => {
  logger.error('Invalid command');
  program.help();
  process.exit(1);
});

if (process.argv.length < 3) {
  program.help();
}

program.parse();