import { Model, Enum, Field, Relation, Role, Policy, Index } from '../parser/types';

export class SQLGenerator {
  private static readonly DEFAULT_SCHEMA = 'public';
  private static enumTypes: Set<string> = new Set<string>();

  /**
   * Register enum types to be recognized by the SQL generator
   * @param enums List of enums to register
   */
  static registerEnumTypes(enums: Enum[]): void {
    this.enumTypes.clear();
    for (const enumDef of enums) {
      this.enumTypes.add(enumDef.name);
    }
  }

  /**
   * Check if a type is a registered enum type
   * @param typeName The type name to check
   * @returns True if the type is an enum, false otherwise
   */
  static isEnumType(typeName: string): boolean {
    return this.enumTypes.has(typeName);
  }

  static generateCreateEnumSQL(enumType: Enum, schemaName: string = this.DEFAULT_SCHEMA): string {
    const values = enumType.values.map(value => `'${value}'`).join(', ');
    return `DO $$ BEGIN
  CREATE TYPE "${schemaName}"."${enumType.name}" AS ENUM (${values});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`;
  }

  static generateDropEnumSQL(enumType: Enum, schemaName: string = this.DEFAULT_SCHEMA): string {
    return `DROP TYPE IF EXISTS "${schemaName}"."${enumType.name}" CASCADE;`;
  }

  static generateCreateExtensionSQL(extensionName: string, version?: string): string {
    if (version) {
      return `CREATE EXTENSION IF NOT EXISTS "${extensionName}" VERSION '${version}';`;
    }
    return `CREATE EXTENSION IF NOT EXISTS "${extensionName}";`;
  }

  static generateDropExtensionSQL(extensionName: string): string {
    return `DROP EXTENSION IF EXISTS "${extensionName}";`;
  }

  static generateFieldSQL(field: Field, schemaName: string = this.DEFAULT_SCHEMA): string {
    let sql = `"${field.name}" `;
    
    // Handle array types
    if (field.type.endsWith('[]')) {
      const baseType = field.type.slice(0, -2);
      // Check if the base type is an enum
      if (this.isEnumType(baseType)) {
        sql += `"${schemaName}"."${baseType}"[]`;
      } else {
        sql += `${baseType}[]`;
      }
    } else {
      // Handle types with length/precision/scale
      if (field.type === 'VARCHAR' || field.type === 'CHAR') {
        // Handle character types with length
        if (field.length !== undefined) {
          sql += `${field.type}(${field.length})`;
        } else {
          sql += field.type;
        }
      } else if (field.type === 'DECIMAL' || field.type === 'NUMERIC') {
        // Handle numeric types with precision and scale
        if (field.precision !== undefined) {
          if (field.scale !== undefined) {
            sql += `${field.type}(${field.precision},${field.scale})`;
          } else {
            sql += `${field.type}(${field.precision})`;
          }
        } else {
          sql += field.type;
        }
      } else {
        // Check if the type is an enum
        if (this.isEnumType(field.type)) {
          sql += `"${schemaName}"."${field.type}"`;
        } else {
          sql += field.type;
        }
      }
    }

    // Add attributes
    if (field.attributes.includes('id')) {
      sql += ' PRIMARY KEY';
    }
    if (field.attributes.includes('unique')) {
      sql += ' UNIQUE';
    }
    if (field.attributes.includes('default')) {
      // Cast default value to enum type if the field is an enum
      if (this.isEnumType(field.type)) {
        sql += ` DEFAULT '${field.defaultValue}'::"${schemaName}"."${field.type}"`;
      } else {
        sql += ` DEFAULT ${field.defaultValue}`;
      }
    }

    return sql;
  }

  static generateCreateTableSQL(model: Model, schemaName: string = this.DEFAULT_SCHEMA): string {
    const fields = model.fields.map(field => this.generateFieldSQL(field, schemaName));
    return `DO $$ BEGIN
  CREATE TABLE "${schemaName}"."${model.name}" (\n  ${fields.join(',\n  ')}\n);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;`;
  }

  static generateDropTableSQL(model: Model, schemaName: string = this.DEFAULT_SCHEMA): string {
    // First revoke all privileges on the table
    return `DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "${schemaName}"."${model.name}" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "${schemaName}"."${model.name}" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "${schemaName}"."${model.name}" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;`;
  }

  static generateCreateForeignKeySQL(
    model: Model,
    relation: Relation,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    if (!relation.fields || !relation.references) return '';

    const constraintName = `fk_${model.name}_${relation.name}`;
    const fields = relation.fields.map(f => `"${f}"`).join(', ');
    const references = relation.references.map(r => `"${r}"`).join(', ');

    return `ALTER TABLE "${schemaName}"."${model.name}"\n` +
           `ADD CONSTRAINT "${constraintName}"\n` +
           `FOREIGN KEY (${fields})\n` +
           `REFERENCES "${schemaName}"."${relation.model}" (${references});`;
  }

  static generateDropForeignKeySQL(
    model: Model,
    relation: Relation,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    if (!relation.fields || !relation.references) return '';

    const constraintName = `fk_${model.name}_${relation.name}`;
    return `ALTER TABLE "${schemaName}"."${model.name}"\n` +
           `DROP CONSTRAINT IF EXISTS "${constraintName}";`;
  }

  static generateCreateIndexSQL(
    model: Model,
    field: Field,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    if (!field.attributes.includes('unique')) return '';

    const indexName = `idx_${model.name}_${field.name}`;
    return `CREATE UNIQUE INDEX "${indexName}"\n` +
           `ON "${schemaName}"."${model.name}" ("${field.name}");`;
  }

  static generateDropIndexSQL(
    model: Model,
    field: Field,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    if (!field.attributes.includes('unique')) return '';

    const indexName = `idx_${model.name}_${field.name}`;
    return `DROP INDEX IF EXISTS "${schemaName}"."${indexName}";`;
  }

  static generateEnableRLSSQL(
    model: Model,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    return `ALTER TABLE "${schemaName}"."${model.name}" ENABLE ROW LEVEL SECURITY;`;
  }

  static generateDisableRLSSQL(
    model: Model,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    return `ALTER TABLE "${schemaName}"."${model.name}" DISABLE ROW LEVEL SECURITY;`;
  }

  static generateForceRLSSQL(
    model: Model,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    return `ALTER TABLE "${schemaName}"."${model.name}" FORCE ROW LEVEL SECURITY;`;
  }

  static generateNoForceRLSSQL(
    model: Model,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    return `ALTER TABLE "${schemaName}"."${model.name}" NO FORCE ROW LEVEL SECURITY;`;
  }

  static generateRLSSQL(
    model: Model,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string[] {
    const sql: string[] = [];
    
    if (model.rowLevelSecurity) {
      if (model.rowLevelSecurity.enabled) {
        sql.push(this.generateEnableRLSSQL(model, schemaName));
      } else {
        sql.push(this.generateDisableRLSSQL(model, schemaName));
      }

      if (model.rowLevelSecurity.force) {
        sql.push(this.generateForceRLSSQL(model, schemaName));
      } else {
        sql.push(this.generateNoForceRLSSQL(model, schemaName));
      }
    }

    return sql;
  }

  static generateCreateRoleSQL(role: Role, schemaName: string = this.DEFAULT_SCHEMA): string[] {
    const sql: string[] = [];
    
    // Create the role with error handling
    sql.push(`DO $$ BEGIN
  CREATE ROLE "${role.name}";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`);
    
    // Grant privileges for each model
    role.privileges.forEach(privilege => {
      const privileges = privilege.privileges.map(p => p.toUpperCase()).join(', ');
      sql.push(`GRANT ${privileges} ON "${schemaName}"."${privilege.on}" TO "${role.name}";`);
    });

    return sql;
  }

  static generateDropRoleSQL(role: Role, schemaName: string = this.DEFAULT_SCHEMA): string[] {
    return [`DROP ROLE IF EXISTS "${role.name}";`];
  }

  static generateCreatePolicySQL(
    model: Model, 
    policy: Policy,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    const forActions = Array.isArray(policy.for) 
      ? policy.for.map(action => action.toUpperCase()).join(', ')
      : 'ALL';
    
    let sql = `CREATE POLICY "${policy.name}" ON "${schemaName}"."${model.name}"
    FOR ${forActions}
    TO ${policy.to}
    USING (${policy.using})`;
    
    if (policy.check) {
      sql += `\n    WITH CHECK (${policy.check})`;
    }
    
    return sql + ';';
  }

  static generateDropPolicySQL(
    model: Model,
    policy: Policy,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    return `DROP POLICY IF EXISTS "${policy.name}" ON "${schemaName}"."${model.name}";`;
  }

  static generateAddColumnSQL(tableName: string, field: Field, schemaName: string = this.DEFAULT_SCHEMA): string {
    const fieldDefinition = this.generateFieldSQL(field, schemaName);
    
    return `ALTER TABLE "${schemaName}"."${tableName}" 
  ADD COLUMN ${fieldDefinition};`;
  }

  static generateDropColumnSQL(tableName: string, fieldName: string, schemaName: string = this.DEFAULT_SCHEMA): string {
    return `ALTER TABLE "${schemaName}"."${tableName}" 
  DROP COLUMN IF EXISTS "${fieldName}";`;
  }

  static generateAlterColumnSQL(
    tableName: string, 
    oldField: Field, 
    newField: Field, 
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    // Start with changing the data type
    let alterSql = `ALTER TABLE "${schemaName}"."${tableName}" 
  ALTER COLUMN "${newField.name}"`;

    // Check if type has changed or any of its parameters (length, precision, scale)
    const typeChanged = oldField.type !== newField.type;
    const lengthChanged = 
      (oldField.length === undefined && newField.length !== undefined) || 
      (oldField.length !== undefined && newField.length === undefined) || 
      (oldField.length !== newField.length);
    
    const precisionChanged = 
      (oldField.precision === undefined && newField.precision !== undefined) || 
      (oldField.precision !== undefined && newField.precision === undefined) || 
      (oldField.precision !== newField.precision);
    
    const scaleChanged = 
      (oldField.scale === undefined && newField.scale !== undefined) || 
      (oldField.scale !== undefined && newField.scale === undefined) || 
      (oldField.scale !== newField.scale);

    if (typeChanged || lengthChanged || precisionChanged || scaleChanged) {
      let typeDefinition = '';
      
      // Handle array types
      if (newField.type.endsWith('[]')) {
        const baseType = newField.type.slice(0, -2);
        // Check if the base type is an enum
        if (this.isEnumType(baseType)) {
          typeDefinition = `"${schemaName}"."${baseType}"[]`;
        } else {
          typeDefinition = `${baseType}[]`;
        }
      } else {
        // Handle types with length/precision
        if (newField.length !== undefined) {
          if (newField.precision !== undefined && newField.scale !== undefined) {
            // Handle numeric types with precision and scale
            typeDefinition = `${newField.type}(${newField.precision},${newField.scale})`;
          } else {
            // Handle types with just length like VARCHAR
            typeDefinition = `${newField.type}(${newField.length})`;
          }
        } else {
          // Check if the type is an enum
          if (this.isEnumType(newField.type)) {
            typeDefinition = `"${schemaName}"."${newField.type}"`;
          } else {
            typeDefinition = newField.type;
          }
        }
      }

      alterSql += ` TYPE ${typeDefinition} USING "${newField.name}"::${typeDefinition}`;
    }

    // Handle default value changes
    const oldDefault = oldField.attributes.includes('default') ? oldField.defaultValue : null;
    const newDefault = newField.attributes.includes('default') ? newField.defaultValue : null;

    if (oldDefault !== newDefault) {
      if (newDefault) {
        // Cast default value to enum type if the field is an enum
        if (this.isEnumType(newField.type)) {
          alterSql += `,\n  ALTER COLUMN "${newField.name}" SET DEFAULT '${newField.defaultValue}'::"${schemaName}"."${newField.type}"`;
        } else {
          alterSql += `,\n  ALTER COLUMN "${newField.name}" SET DEFAULT ${newField.defaultValue}`;
        }
      } else {
        alterSql += `,\n  ALTER COLUMN "${newField.name}" DROP DEFAULT`;
      }
    }

    // Handle NOT NULL constraint
    // Instead of checking for 'notNull' attribute which doesn't exist,
    // we'll check for the absence of 'optional' attribute or equivalent logic
    const oldNullable = !oldField.attributes.some(attr => attr === 'default' || attr === 'id'); 
    const newNullable = !newField.attributes.some(attr => attr === 'default' || attr === 'id');
    
    if (oldNullable && !newNullable) {
      alterSql += `,\n  ALTER COLUMN "${newField.name}" SET NOT NULL`;
    } else if (!oldNullable && newNullable) {
      alterSql += `,\n  ALTER COLUMN "${newField.name}" DROP NOT NULL`;
    }

    // Handle unique constraint changes
    const oldUnique = oldField.attributes.includes('unique');
    const newUnique = newField.attributes.includes('unique');

    if (!oldUnique && newUnique) {
      const indexName = `idx_${tableName}_${newField.name}`;
      alterSql += `;\n\nCREATE UNIQUE INDEX "${indexName}" ON "${schemaName}"."${tableName}" ("${newField.name}")`;
    } else if (oldUnique && !newUnique) {
      const indexName = `idx_${tableName}_${oldField.name}`;
      alterSql += `;\n\nDROP INDEX IF EXISTS "${schemaName}"."${indexName}"`;
    }

    return alterSql + ';';
  }

  /**
   * Generate SQL to create an index based on the Index type
   * 
   * @param model Model the index belongs to
   * @param index Index definition
   * @param schemaName Schema name
   * @returns SQL statement to create the index
   */
  static generateCreateIndexFromIndexTypeSQL(
    model: Model,
    index: Index,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    const tableName = model.name;
    // Use the custom name if provided, otherwise generate a unique name based on all properties
    const indexName = index.name || this.generateUniqueIndexName(tableName, index);
    const fields = index.fields.map(field => `"${field}"`).join(', ');
    const uniqueClause = index.unique ? 'UNIQUE ' : '';
    const typeClause = index.type ? `USING ${index.type}` : '';
    const whereClause = index.where ? `WHERE ${index.where}` : '';

    return `CREATE ${uniqueClause}INDEX "${indexName}" ON "${schemaName}"."${tableName}" ${typeClause} (${fields}) ${whereClause};`;
  }

  /**
   * Generate SQL to drop an index
   * 
   * @param model Model the index belongs to
   * @param index Index definition
   * @param schemaName Schema name
   * @returns SQL statement to drop the index
   */
  static generateDropIndexFromIndexTypeSQL(
    model: Model,
    index: Index,
    schemaName: string = this.DEFAULT_SCHEMA
  ): string {
    const tableName = model.name;
    const indexName = index.name || this.generateUniqueIndexName(tableName, index);
    
    return `DROP INDEX IF EXISTS "${schemaName}"."${indexName}";`;
  }

  /**
   * Generate a unique name for an index that includes all its properties
   * 
   * @param tableName Table name
   * @param index Index definition
   * @returns Unique index name
   */
  private static generateUniqueIndexName(tableName: string, index: Index): string {
    const fieldsPart = index.fields.join('_');
    const typePart = index.type ? `_${index.type.toLowerCase()}` : '';
    const uniquePart = index.unique ? '_unique' : '';
    const wherePart = index.where ? '_filtered' : '';
    
    return `idx_${tableName}_${fieldsPart}${typePart}${uniquePart}${wherePart}`;
  }
} 