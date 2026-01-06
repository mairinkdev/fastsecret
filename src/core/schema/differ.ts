import { ParsedSchema, SchemaTable, SchemaColumn } from './parser';

export interface SchemaDiff {
  newTables: SchemaTable[];
  droppedTables: SchemaTable[];
  modifiedTables: TableDiff[];
  warnings: string[];
}

export interface TableDiff {
  tableName: string;
  newColumns: SchemaColumn[];
  droppedColumns: SchemaColumn[];
  modifiedColumns: ColumnDiff[];
}

export interface ColumnDiff {
  columnName: string;
  oldType?:  string;
  newType:  string;
  oldNullable?: boolean;
  newNullable:  boolean;
  defaultChanged?:  boolean;
}

/**
 * Detect differences between current and desired schema
 */
export function diffSchemas(current: ParsedSchema, desired: ParsedSchema): SchemaDiff {
  const diff: SchemaDiff = {
    newTables: [],
    droppedTables: [],
    modifiedTables: [],
    warnings: [],
  };

  const currentTableMap = new Map(current.tables.map(t => [t.name, t]));
  const desiredTableMap = new Map(desired.tables.map(t => [t.name, t]));

  // Detect new and dropped tables
  for (const [tableName, table] of desiredTableMap) {
    if (!currentTableMap.has(tableName)) {
      diff.newTables.push(table);
    }
  }

  for (const [tableName, table] of currentTableMap) {
    if (!desiredTableMap.has(tableName)) {
      diff.droppedTables.push(table);
      diff.warnings.push(`Table "${tableName}" will be DROPPED.  This is destructive! `);
    }
  }

  // Detect modifications in existing tables
  for (const [tableName, desiredTable] of desiredTableMap) {
    const currentTable = currentTableMap.get(tableName);
    if (!currentTable) continue;

    const tableDiff = diffTables(currentTable, desiredTable);
    if (tableDiff. newColumns.length > 0 ||
        tableDiff.droppedColumns.length > 0 ||
        tableDiff.modifiedColumns.length > 0) {
      diff.modifiedTables.push(tableDiff);

      // Warnings for data loss
      if (tableDiff.droppedColumns.length > 0) {
        diff.warnings. push(
          `Table "${tableName}" will lose columns: ${tableDiff.droppedColumns.map(c => c.name).join(', ')}`
        );
      }
    }
  }

  return diff;
}

/**
 * Diff individual tables
 */
function diffTables(current: SchemaTable, desired: SchemaTable): TableDiff {
  const currentColMap = new Map(current.columns.map(c => [c. name, c]));
  const desiredColMap = new Map(desired.columns.map(c => [c.name, c]));

  const newColumns:  SchemaColumn[] = [];
  const droppedColumns: SchemaColumn[] = [];
  const modifiedColumns: ColumnDiff[] = [];

  // New columns
  for (const [colName, col] of desiredColMap) {
    if (!currentColMap.has(colName)) {
      newColumns.push(col);
    }
  }

  // Dropped columns
  for (const [colName, col] of currentColMap) {
    if (!desiredColMap.has(colName)) {
      droppedColumns.push(col);
    }
  }

  // Modified columns
  for (const [colName, desiredCol] of desiredColMap) {
    const currentCol = currentColMap.get(colName);
    if (!currentCol) continue;

    const changes:  ColumnDiff = {
      columnName: colName,
      newType: desiredCol.type,
      newNullable: desiredCol. nullable,
    };

    if (currentCol. type !== desiredCol.type ||
        currentCol.nullable !== desiredCol.nullable ||
        currentCol.defaultValue !== desiredCol.defaultValue) {
      changes.oldType = currentCol.type;
      changes.oldNullable = currentCol.nullable;
      changes.defaultChanged = currentCol.defaultValue !== desiredCol.defaultValue;
      modifiedColumns.push(changes);
    }
  }

  return {
    tableName:  current.name,
    newColumns,
    droppedColumns,
    modifiedColumns,
  };
}