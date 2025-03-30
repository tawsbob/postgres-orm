import { Schema, Model, Enum, Field, Relation } from './types';
import fs from 'fs';
import path from 'path';

export class SchemaParser {
  private schema: Schema = {
    models: [],
    enums: []
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

    const relationMatch = line.match(/(\w+)\s+(\w+)\s+@relation\(([^)]+)\)/);
    if (!relationMatch) {
      throw new Error(`Invalid relation: ${line}`);
    }

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

  private parseModel(content: string): Model {
    const modelMatch = content.match(/model\s+(\w+)\s*{([^}]+)}/);
    if (!modelMatch) {
      throw new Error('Invalid model definition');
    }

    const [, name, fieldsContent] = modelMatch;
    const fields: Field[] = [];
    const relations: Relation[] = [];

    fieldsContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('//')) return;

      if (line.includes('@relation')) {
        relations.push(this.parseRelation(line));
      } else {
        fields.push(this.parseField(line));
      }
    });

    return { name, fields, relations };
  }

  public parseSchema(schemaPath: string): Schema {
    const content = fs.readFileSync(schemaPath, 'utf-8');
    
    // Parse enums
    const enumRegex = /enum\s+\w+\s*{[^}]+}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(content)) !== null) {
      this.schema.enums.push(this.parseEnum(enumMatch[0]));
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