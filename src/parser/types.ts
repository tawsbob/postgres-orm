export type FieldType = 
  | 'UUID'
  | 'VARCHAR'
  | 'CHAR'
  | 'TEXT'
  | 'SMALLINT'
  | 'INTEGER'
  | 'SERIAL'
  | 'DECIMAL'
  | 'NUMERIC'
  | 'BOOLEAN'
  | 'TIMESTAMP'
  | 'JSONB'
  | 'TEXT[]'
  | 'POINT'
  | string;

export type FieldAttribute = 
  | 'id'
  | 'unique'
  | 'default'
  | 'updatedAt';

export interface Field {
  name: string;
  type: FieldType;
  attributes: FieldAttribute[];
  defaultValue?: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
}

export interface Relation {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  model: string;
  fields?: string[];
  references?: string[];
}

export interface Index {
  fields: string[];
  name?: string;
  type?: string;
  unique?: boolean;
  where?: string;
}

export interface RowLevelSecurity {
  enabled: boolean;
  force: boolean;
}

export interface Policy {
  name: string;
  for: string[] | 'all';
  to: string;
  using: string;
  check?: string;
}

export type TriggerEvent = 'BEFORE INSERT' | 'AFTER INSERT' | 'BEFORE UPDATE' | 'AFTER UPDATE' | 'BEFORE DELETE' | 'AFTER DELETE';
export type TriggerLevel = 'FOR EACH ROW' | 'FOR EACH STATEMENT';

export interface Trigger {
  event: TriggerEvent;
  level: TriggerLevel;
  execute: string;
}

export interface Model {
  name: string;
  fields: Field[];
  relations: Relation[];
  rowLevelSecurity?: RowLevelSecurity;
  policies?: Policy[];
  triggers?: Trigger[];
  indexes?: Index[];
}

export interface Enum {
  name: string;
  values: string[];
}

export interface Extension {
  name: string;
  version?: string;
}

export type Privilege = 'select' | 'insert' | 'update' | 'delete';

export interface Role {
  name: string;
  privileges: {
    privileges: Privilege[];
    on: string;
  }[];
}

export interface Schema {
  models: Model[];
  enums: Enum[];
  extensions: Extension[];
  roles: Role[];
} 