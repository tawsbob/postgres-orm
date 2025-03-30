import { Model, Enum, Field, Relation, Role } from '../parser/types';

export class SQLGenerator {
  private static readonly DEFAULT_SCHEMA = 'public';

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

  static generateCreateExtensionSQL(extensionName: string): string {
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
      if (baseType === 'UserRole' || baseType === 'OrderStatus') {
        sql += `"${schemaName}"."${baseType}"[]`;
      } else {
        sql += `${baseType}[]`;
      }
    } else {
      // Handle types with length/precision
      if (field.length) {
        sql += `${field.type}(${field.length}${field.scale ? `,${field.scale}` : ''})`;
      } else {
        // Check if the type is an enum
        if (field.type === 'UserRole' || field.type === 'OrderStatus') {
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
      if (field.type === 'UserRole' || field.type === 'OrderStatus') {
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
    const sql: string[] = [];
    
    // First revoke all privileges from all tables in the schema
    sql.push(`DO $$ BEGIN
  -- Try to revoke specific privileges first
  ${role.privileges.map(privilege => {
    const privileges = privilege.privileges.map(p => p.toUpperCase()).join(', ');
    return `
  BEGIN
    REVOKE ${privileges} ON "${schemaName}"."${privilege.on}" FROM "${role.name}";
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;`;
  }).join('')}

  -- Revoke all remaining privileges to be thorough
  BEGIN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schemaName}" FROM "${role.name}";
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${schemaName}" FROM "${role.name}";
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "${schemaName}" FROM "${role.name}";
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    REVOKE ALL PRIVILEGES ON SCHEMA "${schemaName}" FROM "${role.name}";
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  -- Reassign and drop ownership in separate exception blocks
  BEGIN
    REASSIGN OWNED BY "${role.name}" TO postgres;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    DROP OWNED BY "${role.name}";
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
END $$;`);
    
    // Finally drop the role
    sql.push(`DROP ROLE IF EXISTS "${role.name}";`);
    
    return sql;
  }
} 