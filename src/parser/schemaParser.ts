import { Schema, Model, Enum, Field, Relation, Extension, RowLevelSecurity, Role, Privilege } from './types';
import fs from 'fs';
import path from 'path';

export class SchemaParser {
  private schema: Schema = {
    models: [],
    enums: [],
    extensions: [],
    roles: []
  };

  private parseField(line: string): Field {
    const [name, ...rest] = line.trim().split(/\s+/);
    const typeMatch = rest[0].match(/(\w+)(?:\((\d+)(?:,(\d+))?\))?/);
    
    if (!typeMatch) {
      throw new Error(`Invalid field type: ${rest[0]}`);
    }

    const [, type, length, scale] = typeMatch;
    const attributes: string[] = [];
    let defaultValue: string | undefined;

    // Parse attributes
    rest.slice(1).forEach(attr => {
      if (attr.startsWith('@')) {
        const attrName = attr.slice(1);
        if (attrName === 'id' || attrName === 'unique') {
          attributes.push(attrName);
        } else if (attrName.startsWith('default(')) {
          defaultValue = attrName.slice(8, -1);
          attributes.push('default');
        }
      }
    });

    return {
      name,
      type: type as any,
      attributes: attributes as any[],
      defaultValue,
      length: length ? parseInt(length) : undefined,
      scale: scale ? parseInt(scale) : undefined
    };
  }

  private parseRelation(line: string): Relation {
    // Handle optional relations (with ?)
    const isOptional = line.includes('?');
    line = line.replace('?', '').trim();

    // Check for explicit relation with @relation attribute
    const relationMatch = line.match(/(\w+)\s+(\w+)\s+@relation\(([^)]+)\)/);
    if (relationMatch) {
      const [, name, model, options] = relationMatch;
      const relation: Relation = {
        name,
        model,
        type: 'one-to-many' // default type
      };

      // Parse relation options
      const fieldsMatch = options.match(/fields:\s*\[([^\]]+)\]/);
      const referencesMatch = options.match(/references:\s*\[([^\]]+)\]/);

      if (fieldsMatch) {
        relation.fields = fieldsMatch[1].split(',').map(f => f.trim());
      }
      if (referencesMatch) {
        relation.references = referencesMatch[1].split(',').map(r => r.trim());
      }

      // Determine relation type
      if (isOptional && !relation.fields) {
        relation.type = 'one-to-one';
      } else if (relation.fields && relation.references) {
        relation.type = 'one-to-one';
      } else if (line.includes('[]')) {
        relation.type = 'one-to-many';
      }

      return relation;
    }

    // Handle implicit relation (e.g., "orders Order[]")
    const implicitMatch = line.match(/(\w+)\s+(\w+)\[\]/);
    if (implicitMatch) {
      const [, name, model] = implicitMatch;
      return {
        name,
        model,
        type: 'one-to-many'
      };
    }

    throw new Error(`Invalid relation: ${line}`);
  }

  private parseEnum(content: string): Enum {
    const enumMatch = content.match(/enum\s+(\w+)\s*{([^}]+)}/);
    if (!enumMatch) {
      throw new Error('Invalid enum definition');
    }

    const [, name, values] = enumMatch;
    return {
      name,
      values: values.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
    };
  }

  private parseExtension(content: string): Extension {
    const extensionMatch = content.match(/extension\s+([\w-]+)/);
    if (!extensionMatch) {
      throw new Error('Invalid extension definition');
    }

    const [, name] = extensionMatch;
    return { name };
  }

  private parseRowLevelSecurity(line: string): RowLevelSecurity | undefined {
    const rlsMatch = line.match(/@@rowLevelSecurity\(([^)]+)\)/);
    if (!rlsMatch) return undefined;

    const options = rlsMatch[1];
    const enabledMatch = options.match(/enabled:\s*(true|false)/);
    const forceMatch = options.match(/force:\s*(true|false)/);

    return {
      enabled: enabledMatch ? enabledMatch[1] === 'true' : true,
      force: forceMatch ? forceMatch[1] === 'true' : false
    };
  }

  private parseRole(content: string): Role {
    const roleMatch = content.match(/role\s+(\w+)\s*{([^}]+)}/);
    if (!roleMatch) {
      throw new Error('Invalid role definition');
    }

    const [, name, privilegesContent] = roleMatch;
    const privileges: { privileges: Privilege[], on: string }[] = [];

    privilegesContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('//')) return;

      // Validate privilege syntax
      if (!line.match(/^privileges:\s*\[[^\]]+\]\s+on\s+\w+$/)) {
        throw new Error('Invalid role definition');
      }

      const privilegeMatch = line.match(/privileges:\s*\[([^\]]+)\]\s+on\s+(\w+)/);
      if (privilegeMatch) {
        const [, privilegesList, model] = privilegeMatch;
        // Parse JSON-style array and remove quotes
        const parsedPrivileges = privilegesList
          .split(',')
          .map(p => p.trim().replace(/"/g, '').toLowerCase() as Privilege);

        // Validate that all privileges are valid
        const validPrivileges: Privilege[] = ['select', 'insert', 'update', 'delete'];
        if (!parsedPrivileges.every(p => validPrivileges.includes(p))) {
          throw new Error('Invalid role definition');
        }

        privileges.push({
          privileges: parsedPrivileges,
          on: model
        });
      }
    });

    return { name, privileges };
  }

  private parseModel(content: string): Model {
    const modelMatch = content.match(/model\s+(\w+)\s*{([^}]+)}/);
    if (!modelMatch) {
      throw new Error('Invalid model definition');
    }

    const [, name, fieldsContent] = modelMatch;
    const fields: Field[] = [];
    const relations: Relation[] = [];
    let rowLevelSecurity: RowLevelSecurity | undefined;

    fieldsContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('//')) return;

      // Check for RLS configuration
      const rlsConfig = this.parseRowLevelSecurity(line);
      if (rlsConfig) {
        rowLevelSecurity = rlsConfig;
        return;
      }

      // Check for both explicit relations and implicit relations (array syntax)
      if (line.includes('@relation') || line.match(/\w+\s+\w+\[\]/)) {
        relations.push(this.parseRelation(line));
      } else {
        fields.push(this.parseField(line));
      }
    });

    return { name, fields, relations, rowLevelSecurity };
  }

  public parseSchema(schemaPath?: string, fileContent?: string): Schema {
    const content = schemaPath ? fs.readFileSync(schemaPath, 'utf-8') : fileContent;
    if (!content) {
      throw new Error('Schema path or file content is required');
    }
    // Parse extensions
    const extensionRegex = /extension\s+([\w-]+)/g;
    let extensionMatch;
    while ((extensionMatch = extensionRegex.exec(content)) !== null) {
      this.schema.extensions.push(this.parseExtension(extensionMatch[0]));
    }
    
    // Parse enums
    const enumRegex = /enum\s+\w+\s*{[^}]+}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(content)) !== null) {
      this.schema.enums.push(this.parseEnum(enumMatch[0]));
    }

    // Parse roles
    const roleRegex = /role\s+\w+\s*{[^}]+}/g;
    let roleMatch;
    while ((roleMatch = roleRegex.exec(content)) !== null) {
      this.schema.roles.push(this.parseRole(roleMatch[0]));
    }

    // Parse models
    const modelRegex = /model\s+\w+\s*{[^}]+}/g;
    let modelMatch;
    while ((modelMatch = modelRegex.exec(content)) !== null) {
      this.schema.models.push(this.parseModel(modelMatch[0]));
    }

    return this.schema;
  }
} 