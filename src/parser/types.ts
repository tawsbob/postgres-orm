export type FieldType = 
  | 'UUID'
  | 'VARCHAR'
  | 'TEXT'
  | 'SMALLINT'
  | 'INTEGER'
  | 'SERIAL'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'TIMESTAMP'
  | 'JSONB'
  | 'TEXT[]'
  | 'POINT'
  | 'UserRole'
  | 'OrderStatus';

export type FieldAttribute = 
  | 'id'
  | 'unique'
  | 'default';

export interface Field {
  name: string;
  type: FieldType;
  attributes: FieldAttribute[];
  defaultValue?: string;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface Relation {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  model: string;
  fields?: string[];
  references?: string[];
}

export interface RowLevelSecurity {
  enabled: boolean;
  force: boolean;
}

export interface Model {
  name: string;
  fields: Field[];
  relations: Relation[];
  rowLevelSecurity?: RowLevelSecurity;
}

export interface Enum {
  name: string;
  values: string[];
}

export interface Extension {
  name: string;
}

export interface Schema {
  models: Model[];
  enums: Enum[];
  extensions: Extension[];
} 