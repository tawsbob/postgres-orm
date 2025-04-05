import { Schema, Model, Enum, Field, Relation, Extension, RowLevelSecurity, Role, Privilege, Policy, FieldType, FieldAttribute, Trigger, TriggerEvent, TriggerLevel, Index } from './types';
import { SQLGenerator } from '../migration/sqlGenerator';
import fs from 'fs';
import path from 'path';

/**
 * SchemaParserV1 - Enhanced schema parser for PostgreSQL schema definitions
 * Provides improved error handling, more robust parsing, and cleaner organization
 */
export default class SchemaParserV1 {
  /**
   * Main schema object that will be populated during parsing
   */
  private schema: Schema = {
    models: [],
    enums: [],
    extensions: [],
    roles: []
  };

  /**
   * Parse a field definition from a schema line
   * @param line The line containing the field definition
   * @returns Field object with parsed properties
   */
  private parseField(line: string): Field {
    try {
      // Split the line into parts, preserving quoted values
      const parts = this.splitFieldLine(line.trim());
      if (parts.length < 2) {
        throw new Error(`Invalid field format: ${line}`);
      }

      const name = parts[0];
      let typeWithModifiers = parts[1];
      
      // Extract array types (e.g., TEXT[])
      const isArray = typeWithModifiers.includes('[]');
      let type = isArray ? typeWithModifiers.replace('[]', '') : typeWithModifiers;
      
      // Handle types with precision and scale like DECIMAL(10,2)
      let length: number | undefined;
      let precision: number | undefined;
      let scale: number | undefined;
      
      const precisionMatch = type.match(/(\w+)\((\d+)(?:,(\d+))?\)/);
      if (precisionMatch) {
        type = precisionMatch[1];
        if (precisionMatch[3]) {
          // This is a DECIMAL(10,2) type format with precision and scale
          precision = parseInt(precisionMatch[2]);
          scale = parseInt(precisionMatch[3]);
        } else {
          // This is a VARCHAR(255) type format with just length
          length = parseInt(precisionMatch[2]);
        }
        
        // Remove the parentheses part from the type
        typeWithModifiers = isArray ? `${type}[]` : type;
      }
      
      const attributes: FieldAttribute[] = [];
      let defaultValue: string | undefined;

      // Process field attributes (start from index 2 as 0 is name and 1 is type)
      for (let i = 2; i < parts.length; i++) {
        const attr = parts[i];
        
        if (attr.startsWith('@')) {
          const attrName = attr.slice(1);
          
          if (attrName === 'id' || attrName === 'unique') {
            attributes.push(attrName);
          } else if (attrName === 'updatedAt') {
            attributes.push('updatedAt');
          } else if (attrName.startsWith('default(')) {
            // Extract default value, handling complex cases
            const defaultMatch = attr.match(/@default\((.*)\)/);
            if (defaultMatch) {
              defaultValue = defaultMatch[1];
              attributes.push('default');
            }
          } else if (attrName.startsWith('default')) {
            // Handle simple default without parentheses
            const defaultMatch = attr.match(/@default\s+(.+)/);
            if (defaultMatch) {
              defaultValue = defaultMatch[1];
              attributes.push('default');
            }
          }
        }
      }

      return {
        name,
        type: typeWithModifiers as FieldType,
        attributes,
        defaultValue,
        length,
        precision,
        scale
      };
    } catch (error) {
      throw new Error(`Failed to parse field: ${line}. ${(error as Error).message}`);
    }
  }

  /**
   * Helper method to split a field line, respecting quoted values
   * @param line The line to split
   * @returns Array of parts
   */
  private splitFieldLine(line: string): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let inQuotes = false;
    let inParentheses = 0;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === ' ' && !inQuotes && inParentheses === 0 && currentPart) {
        parts.push(currentPart);
        currentPart = '';
        // Skip consecutive spaces
        while (i + 1 < line.length && line[i + 1] === ' ') i++;
      } else {
        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === '(' && !inQuotes) {
          inParentheses++;
        } else if (char === ')' && !inQuotes) {
          inParentheses--;
        }
        
        currentPart += char;
      }
    }
    
    if (currentPart) {
      parts.push(currentPart);
    }
    
    return parts;
  }

  /**
   * Parse a relation definition
   * @param line The line containing the relation definition
   * @returns Relation object with parsed properties
   */
  private parseRelation(line: string): Relation {
    try {
      // Handle optional relations (with ?)
      const isOptional = line.includes('?');
      line = line.replace('?', '').trim();

      // Check for explicit relation with @relation attribute
      const relationMatch = line.match(/(\w+)\s+(\w+)(?:\[\])?\s*@relation\((?:"([^"]+)",\s*)?([^)]+)\)/);
      if (relationMatch) {
        const [, name, model, relationName, options] = relationMatch;
        const relation: Relation = {
          name,
          model,
          type: line.includes('[]') ? 'one-to-many' : 'one-to-one'
        };

        if (relationName) {
          relation.name = relationName;
        }

        // Parse relation options
        const fieldsMatch = options.match(/fields:\s*\[([^\]]+)\]/);
        const referencesMatch = options.match(/references:\s*\[([^\]]+)\]/);

        if (fieldsMatch) {
          relation.fields = fieldsMatch[1].split(',').map(f => f.trim());
        }
        if (referencesMatch) {
          relation.references = referencesMatch[1].split(',').map(r => r.trim());
        }

        return relation;
      }

      // Handle simple relations (e.g., "orders Order[]")
      const simpleMatch = line.match(/(\w+)\s+(\w+)(\[\])?/);
      if (simpleMatch) {
        const [, name, model, isArray] = simpleMatch;
        return {
          name,
          model,
          type: isArray ? 'one-to-many' : 'one-to-one'
        };
      }

      throw new Error(`Invalid relation format: ${line}`);
    } catch (error) {
      throw new Error(`Failed to parse relation: ${line}. ${(error as Error).message}`);
    }
  }

  /**
   * Parse an enum definition
   * @param content The content containing the enum definition
   * @returns Enum object with parsed name and values
   */
  private parseEnum(content: string): Enum {
    try {
      const enumMatch = content.match(/enum\s+(\w+)\s*{([^}]+)}/);
      if (!enumMatch) {
        throw new Error('Invalid enum definition');
      }

      const [, name, valuesContent] = enumMatch;
      return {
        name,
        values: valuesContent.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('//'))
      };
    } catch (error) {
      throw new Error(`Failed to parse enum: ${content}. ${(error as Error).message}`);
    }
  }

  /**
   * Parse an extension definition
   * @param content The content containing the extension definition
   * @returns Extension object with parsed name
   */
  private parseExtension(content: string): Extension {
    try {
      const extensionMatch = content.match(/extension\s+([\w-]+)(?:\s*\(version=['"]([^'"]+)['"]\))?/);
      if (!extensionMatch) {
        throw new Error('Invalid extension definition');
      }

      const name = extensionMatch[1];
      const version = extensionMatch[2];
      
      return { 
        name,
        ...(version ? { version } : {})
      };
    } catch (error) {
      throw new Error(`Failed to parse extension: ${content}. ${(error as Error).message}`);
    }
  }

  /**
   * Parse row level security configuration
   * @param line The line containing the RLS configuration
   * @returns RowLevelSecurity object or undefined if not found
   */
  private parseRowLevelSecurity(line: string): RowLevelSecurity | undefined {
    try {
      const rlsMatch = line.match(/@@rowLevelSecurity\(([^)]+)\)/);
      if (!rlsMatch) return undefined;

      const options = rlsMatch[1];
      const enabledMatch = options.match(/enabled:\s*(true|false)/);
      const forceMatch = options.match(/force:\s*(true|false)/);

      return {
        enabled: enabledMatch ? enabledMatch[1] === 'true' : true,
        force: forceMatch ? forceMatch[1] === 'true' : false
      };
    } catch (error) {
      throw new Error(`Failed to parse row level security: ${line}. ${(error as Error).message}`);
    }
  }

  /**
   * Parse a security policy definition
   * @param policyText The text containing the policy definition
   * @returns Policy object with parsed properties
   */
  private parsePolicy(policyText: string): Policy {
    try {
      const nameMatch = policyText.match(/"([^"]+)"/);
      if (!nameMatch) {
        throw new Error(`Missing policy name in: ${policyText}`);
      }

      const name = nameMatch[1];
      
      // Parse the 'for' field (can be an array or 'all')
      let forValue: string[] | 'all' = [];
      const forArrayMatch = policyText.match(/for:\s*\[(.*?)\]/);
      const forStringMatch = policyText.match(/for:\s*"([^"]+)"/);
      
      if (forArrayMatch) {
        forValue = forArrayMatch[1]
          .split(',')
          .map(p => p.trim().replace(/"/g, ''))
          .filter(Boolean) as string[];
      } else if (forStringMatch && forStringMatch[1] === 'all') {
        forValue = 'all';
      }

      // Parse 'to' and 'using' fields
      const toMatch = policyText.match(/to:\s*"([^"]+)"/);
      const usingMatch = policyText.match(/using:\s*"([^"]+)"/);
      
      // Parse optional 'check' field
      const checkMatch = policyText.match(/check:\s*"([^"]+)"/);

      if (!toMatch || !usingMatch) {
        throw new Error(`Missing required policy fields in: ${policyText}`);
      }

      const policy: Policy = {
        name,
        for: forValue,
        to: toMatch[1],
        using: usingMatch[1],
      };
      
      // Add check clause if it exists
      if (checkMatch) {
        policy.check = checkMatch[1];
      }

      return policy;
    } catch (error) {
      throw new Error(`Failed to parse policy: ${policyText}. ${(error as Error).message}`);
    }
  }

  /**
   * Parse a role definition
   * @param content The content containing the role definition
   * @returns Role object with parsed properties
   */
  private parseRole(content: string): Role {
    try {
      const roleMatch = content.match(/role\s+(\w+)\s*{([^}]+)}/);
      if (!roleMatch) {
        throw new Error('Invalid role definition');
      }

      const [, name, privilegesContent] = roleMatch;
      const privileges: { privileges: Privilege[], on: string }[] = [];

      const lines = privilegesContent.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));

      for (const line of lines) {
        // Match privileges (both array syntax and 'all' string)
        const privilegeMatch = line.match(/privileges:\s*(?:\[(.*?)\]|"([^"]+)")\s+on\s+(\w+)/);
        if (!privilegeMatch) continue;

        let privs: Privilege[] = [];
        
        // Handle 'all' privilege
        if (privilegeMatch[2] === 'all') {
          privs = ['select', 'insert', 'update', 'delete'];
        } else if (privilegeMatch[1]) {
          // Process array of privileges
          privs = privilegeMatch[1]
            .split(',')
            .map(p => p.trim().replace(/"/g, ''))
            .filter(Boolean) as Privilege[];
        }

        privileges.push({
          privileges: privs,
          on: privilegeMatch[3]
        });
      }

      if (privileges.length === 0) {
        throw new Error('No privileges defined for role');
      }

      return { name, privileges };
    } catch (error) {
      throw new Error(`Failed to parse role: ${content}. ${(error as Error).message}`);
    }
  }

  /**
   * Parse a trigger definition
   * @param triggerText The text containing the trigger definition
   * @returns Trigger object with parsed properties
   */
  private parseTrigger(triggerText: string): Trigger {
    try {
      // Extract the event type (BEFORE UPDATE, AFTER INSERT, etc.)
      const eventMatch = triggerText.match(/@@trigger\("([^"]+)"/);
      if (!eventMatch) {
        throw new Error(`Missing trigger event in: ${triggerText}`);
      }
      
      const event = eventMatch[1] as TriggerEvent;
      
      // Extract level (FOR EACH ROW or FOR EACH STATEMENT)
      const levelMatch = triggerText.match(/level:\s*"([^"]+)"/);
      if (!levelMatch) {
        throw new Error(`Missing trigger level in: ${triggerText}`);
      }
      
      const level = levelMatch[1] as TriggerLevel;
      
      // Extract the execute code - handling multiline strings with triple quotes
      const executeMatch = triggerText.match(/execute:\s*"""([\s\S]*?)"""/);
      if (!executeMatch) {
        throw new Error(`Missing or invalid trigger execute in: ${triggerText}`);
      }
      
      const execute = executeMatch[1].trim();
      
      return {
        event,
        level,
        execute
      };
    } catch (error) {
      throw new Error(`Failed to parse trigger: ${triggerText}. ${(error as Error).message}`);
    }
  }

  /**
   * Parse an index definition from a schema line
   * @param indexText The text containing the index definition
   * @returns Index object with parsed properties
   */
  private parseIndex(indexText: string): Index {
    try {
      // Basic pattern for @@index directive: @@index([field1, field2])
      const basicIndexMatch = indexText.match(/@@index\(\s*\[([^\]]+)\]\s*\)/);
      
      // Pattern for complex index with options: @@index([field1, field2], { options })
      const complexIndexMatch = indexText.match(/@@index\(\s*\[([^\]]+)\]\s*,\s*{([^}]+)}\s*\)/);
      
      if (!basicIndexMatch && !complexIndexMatch) {
        throw new Error('Invalid index definition');
      }

      // Extract fields
      const fieldsString = basicIndexMatch ? basicIndexMatch[1] : complexIndexMatch![1];
      const fields = fieldsString.split(',').map(f => f.trim());
      
      // Initialize index object with fields
      const index: Index = { fields };
      
      // If it's a complex index with options, parse those options
      if (complexIndexMatch) {
        const optionsText = complexIndexMatch[2];
        
        // Parse name
        const nameMatch = optionsText.match(/name:\s*["']([^"']+)["']/);
        if (nameMatch) {
          index.name = nameMatch[1];
        }
        
        // Parse type
        const typeMatch = optionsText.match(/type:\s*["']([^"']+)["']/);
        if (typeMatch) {
          index.type = typeMatch[1];
        }
        
        // Parse unique attribute
        const uniqueMatch = optionsText.match(/unique:\s*(true|false)/);
        if (uniqueMatch) {
          index.unique = uniqueMatch[1] === 'true';
        }
        
        // Parse where clause - handle both single and double quotes properly
        // This regex captures the content between where: and the next comma or closing brace
        const wherePattern = /where:\s*["']([^,}]+)(?:[,}]|$)/;
        const whereMatch = optionsText.match(wherePattern);
        if (whereMatch) {
          // Extract the where clause, removing any trailing quotes
          let whereClause = whereMatch[1].trim();
          // If the where clause ends with a quote, remove it
          if (whereClause.endsWith("'") || whereClause.endsWith('"')) {
            whereClause = whereClause.slice(0, -1);
          }
          index.where = whereClause;
        }
      }
      
      return index;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse index: ${errorMsg}`);
    }
  }

  /**
   * Parse a model definition
   * @param content The content containing the model definition
   * @returns Model object with parsed properties
   */
  private parseModel(content: string): Model {
    try {
      const modelMatch = content.match(/model\s+(\w+)\s*{([\s\S]+?)}\s*$/);
      if (!modelMatch) {
        throw new Error('Invalid model definition');
      }

      const [, name, modelContent] = modelMatch;
      const fields: Field[] = [];
      const relations: Relation[] = [];
      let rowLevelSecurity: RowLevelSecurity | undefined;
      const policies: Policy[] = [];
      const triggers: Trigger[] = [];
      const indexes: Index[] = [];

      // Process the model content line by line
      const lines = modelContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith('//')) continue;

        // Handle row level security
        if (line.includes('@@rowLevelSecurity')) {
          rowLevelSecurity = this.parseRowLevelSecurity(line);
          continue;
        }

        // Handle policies
        if (line.includes('@@policy')) {
          // Collect the full policy text (may span multiple lines)
          let policyText = line;
          let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          
          while (braceCount > 0 && i + 1 < lines.length) {
            i++;
            const nextLine = lines[i].trim();
            policyText += ' ' + nextLine;
            
            braceCount += (nextLine.match(/{/g) || []).length;
            braceCount -= (nextLine.match(/}/g) || []).length;
          }
          
          policies.push(this.parsePolicy(policyText));
          continue;
        }

        // Handle triggers
        if (line.includes('@@trigger')) {
          // Collect the full trigger text (may span multiple lines)
          let triggerText = line;
          let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          
          while (braceCount > 0 && i + 1 < lines.length) {
            i++;
            const nextLine = lines[i].trim();
            triggerText += ' ' + nextLine;
            
            braceCount += (nextLine.match(/{/g) || []).length;
            braceCount -= (nextLine.match(/}/g) || []).length;
          }
          
          triggers.push(this.parseTrigger(triggerText));
          continue;
        }

        // Handle indexes
        if (line.includes('@@index')) {
          // Collect the full index text (may span multiple lines)
          let indexText = line;
          let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          let parenCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
          
          while ((braceCount > 0 || parenCount > 0) && i + 1 < lines.length) {
            i++;
            const nextLine = lines[i].trim();
            indexText += ' ' + nextLine;
            
            braceCount += (nextLine.match(/{/g) || []).length;
            braceCount -= (nextLine.match(/}/g) || []).length;
            parenCount += (nextLine.match(/\(/g) || []).length;
            parenCount -= (nextLine.match(/\)/g) || []).length;
          }
          
          indexes.push(this.parseIndex(indexText));
          continue;
        }

        // Skip any other directive lines that start with @@
        if (line.startsWith('@@')) {
          continue;
        }

        // Handle relations with @relation attribute
        if (line.includes('@relation')) {
          relations.push(this.parseRelation(line));
          continue;
        }
        
        // Check if it's a basic field or an implicit relation
        const parts = this.splitFieldLine(line);
        if (parts.length >= 2) {
          const potentialType = parts[1];
          
          // Check if it's an implicit relation (type is a model name with square brackets)
          if (potentialType.endsWith('[]') && !['TEXT[]', 'VARCHAR[]', 'UUID[]', 'INTEGER[]'].includes(potentialType)) {
            // It's likely a relation like "orders Order[]"
            relations.push(this.parseRelation(line));
          } else if (this.isBasicField(line)) {
            // It's a regular field
            fields.push(this.parseField(line));
          }
        }
      }

      return { name, fields, relations, rowLevelSecurity, policies, triggers, indexes };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse model: ${errorMsg}`);
    }
  }

  /**
   * Helper to determine if a line represents a basic field definition
   * @param line The line to check
   * @returns true if the line contains a basic field definition
   */
  private isBasicField(line: string): boolean {
    // First split the line to get the potential type
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return false;
    
    // If the second part (the type) is a known SQL type or enum type
    const potentialType = parts[1].replace(/\[\]$/, '').replace(/\(\d+(?:,\d+)?\)$/, '');
    
    // List of built-in PostgreSQL types we support
    const sqlTypes = [
      'UUID', 'VARCHAR', 'TEXT', 'SMALLINT', 'INTEGER', 'SERIAL', 
      'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'JSONB', 'POINT'
    ];
    
    // Check if it's one of our SQL types (exact match or with array notation)
    if (sqlTypes.includes(potentialType)) {
      return true;
    }
    
    // Check if it's a relation by looking for @relation
    if (line.includes('@relation')) {
      return false;
    }
    
    // Check if it's an enum type by comparing with known enum names
    const isEnumType = this.schema.enums.some(e => e.name === potentialType);
    
    // It's a basic field if it's an enum type or not a relation
    return isEnumType || !parts[1].endsWith('[]');
  }

  /**
   * Parse the schema from file or content string
   * @param schemaPath Path to the schema file
   * @param fileContent Schema content as string
   * @returns Parsed schema
   */
  public parseSchema(schemaPath?: string, fileContent?: string): Schema {
    try {
      // Get content either from file or provided content
      const content = schemaPath ? fs.readFileSync(path.resolve(schemaPath), 'utf-8') : fileContent;
      if (!content) {
        throw new Error('Schema path or file content is required');
      }
      
      // Reset schema before parsing
      this.schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: []
      };
      
      // Parse extensions
      const extensionRegex = /extension\s+([\w-]+)(?:\s*\(version=['"]([^'"]+)['"]\))?/g;
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

      // First, extract all models and roles as raw blocks to separate them correctly
      const modelBlocks: string[] = [];
      const roleBlocks: string[] = [];
      
      // Extract model blocks
      const modelBlockRegex = /model\s+\w+\s*{[\s\S]*?(?:^}|\n\s*})\s*$/gm;
      let modelBlockMatch;
      while ((modelBlockMatch = modelBlockRegex.exec(content)) !== null) {
        modelBlocks.push(modelBlockMatch[0]);
      }
      
      // Extract role blocks
      const roleBlockRegex = /role\s+\w+\s*{[\s\S]*?^}/gm;
      let roleBlockMatch;
      while ((roleBlockMatch = roleBlockRegex.exec(content)) !== null) {
        roleBlocks.push(roleBlockMatch[0]);
      }
      
      // Parse roles from extracted blocks
      for (const roleBlock of roleBlocks) {
        try {
          this.schema.roles.push(this.parseRole(roleBlock));
        } catch (error) {
          console.error(`Error parsing role: ${(error as Error).message}`);
        }
      }
      
      // Parse models from extracted blocks
      for (const modelBlock of modelBlocks) {
        try {
          this.schema.models.push(this.parseModel(modelBlock));
        } catch (error) {
          console.error(`Error parsing model: ${(error as Error).message}`);
        }
      }

      // Register the enum types with SQLGenerator
      if (this.schema.enums && this.schema.enums.length > 0) {
        SQLGenerator.registerEnumTypes(this.schema.enums);
      }
      
      return this.schema;
    } catch (error) {
      throw new Error(`Failed to parse schema: ${(error as Error).message}`);
    }
  }
} 