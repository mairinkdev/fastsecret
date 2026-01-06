import { z } from 'zod';

export const ConfigSchema = z.object({
  projectName: z.string().min(1),
  environments: z.record(
    z.object({
      database: z.object({
        host: z.string(),
        port: z.number().default(5432),
        user: z.string(),
        password: z.string(),
        database: z.string(),
      }),
      migrationsPath: z.string().default('./migrations'),
      schemaPath: z.string().default('./schema. sql'),
    })
  ),
  defaultEnvironment: z.string().default('dev'),
  validation: z.object({
    checkForDataLoss: z.boolean().default(true),
    requireApproval: z.boolean().default(false),
  }).optional(),
});

export type AtlasConfig = z.infer<typeof ConfigSchema>;

export const defaultConfig: AtlasConfig = {
  projectName: 'my-project',
  environments: {
    dev: {
      database: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'mydb_dev',
      },
      migrationsPath: './migrations',
      schemaPath: './schema. sql',
    },
  },
  defaultEnvironment: 'dev',
  validation: {
    checkForDataLoss:  true,
    requireApproval: false,
  },
};