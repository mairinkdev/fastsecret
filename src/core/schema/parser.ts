import { parse, TableNode, ColumnNode } from 'sql-ast-parser';

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?:  string;
  references?:  {
    table: string;
    column: string;
  };
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique:  boolean;
}

export interface ConstraintDefinition {
  name: string;
  type: 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
}

export interface ParsedSchema {
  tables: SchemaTable[];
  version: string;
  timestamp: number;
}

/**
 * Parse SQL schema definition into structured format
 * Handles common PostgreSQL DDL statements
 */
export function parseSchema(sqlContent: string): ParsedSchema {
  try {
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    const tables: SchemaTable[] = [];

    for (const statement of statements) {
      if (statement.toUpperCase().startsWith('CREATE TABLE')) {
        const table = parseCreateTable(statement);
        if (table) {
          tables.push(table);
        }
      }
    }

    return {
      tables,
      version:  '1.0',
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new Error(`Failed to parse schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse individual CREATE TABLE statement
 */
function parseCreateTable(sql: string): SchemaTable | null {
  // Simple regex-based parser for common patterns
  const tableNameMatch = sql.match(/CREATE TABLE\s+(? :IF\s+NOT\s+EXISTS\s+)?(?:"? (\w+)"?)/i);
  if (!tableNameMatch) return null;

  const tableName = tableNameMatch[1];
  const columnSection = sql.match(/\((.*)\)/s)?.[1] || '';
  
  const columns = parseColumns(columnSection);
  const indexes = parseIndexes(sql);
  const constraints = parseConstraints(sql);

  return {
    name: tableName,
    columns,
    indexes,
    constraints,
  };
}

/**
 * Parse column definitions from CREATE TABLE statement
 */
function parseColumns(columnSection: string): SchemaColumn[] {
  const columns: SchemaColumn[] = [];
  
  // Split by comma but respect parentheses
  const columnDefs = smartSplit(columnSection, ',');

  for (const colDef of columnDefs) {
    const trimmed = colDef.trim();
    if (trimmed.toUpperCase().startsWith('PRIMARY KEY') ||
        trimmed.toUpperCase().startsWith('FOREIGN KEY') ||
        trimmed.toUpperCase().startsWith('CONSTRAINT')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const name = parts[0].replace(/["]/g, '');
    const type = parts[1];
    const nullable = ! trimmed.toUpperCase().includes('NOT NULL');
    const primaryKey = trimmed.toUpperCase().includes('PRIMARY KEY');
    
    const defaultMatch = trimmed.match(/DEFAULT\s+([^ ,]+)/i);
    const defaultValue = defaultMatch? .[1];

    columns.push({
      name,
      type:  type.toUpperCase(),
      nullable,
      primaryKey,
      defaultValue,
    });
  }

  return columns;
}

/**
 * Parse index definitions
 */
function parseIndexes(sql: string): IndexDefinition[] {
  const indexes: IndexDefinition[] = [];
  
  const uniqueMatches = sql.matchAll(/CREATE\s+UNIQUE\s+INDEX\s+(\w+)\s+ON\s+\w+\s*\((.*?)\)/gi);
  for (const match of uniqueMatches) {
    indexes.push({
      name: match[1],
      columns: match[2].split(',').map(c => c.trim()),
      unique: true,
    });
  }

  return indexes;
}

/**
 * Parse constraint definitions
 */
function parseConstraints(sql: string): ConstraintDefinition[] {
  const constraints: ConstraintDefinition[] = [];
  
  const fkMatches = sql.matchAll(/CONSTRAINT\s+(\w+)\s+FOREIGN\s+KEY\s*\((.*?)\)/gi);
  for (const match of fkMatches) {
    constraints.push({
      name: match[1],
      type: 'FOREIGN_KEY',
      columns: match[2]. split(',').map(c => c.trim()),
    });
  }

  return constraints;
}

/**
 * Smart string split that respects parentheses
 */
function smartSplit(input: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of input) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === delimiter && depth === 0) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current) result.push(current);
  return result;
}