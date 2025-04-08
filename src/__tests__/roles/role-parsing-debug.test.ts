import SchemaParserV1 from '../../parser/schemaParser';

describe('Role Parsing Debug Tests', () => {
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    schemaParser = new SchemaParserV1();
  });

  test('should correctly parse a basic role from raw schema', () => {
    // Create a raw schema with a simple role
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      role userRole {
        privileges: ["select", "insert", "update"] on User
      }
    `;

    // Let's try to manually apply the regex to extract role blocks
    const roleBlockRegex = /role\s+\w+\s*{[\s\S]*?}/g;
    const matches = rawSchema.match(roleBlockRegex);
    
    console.log('Regex matches:', matches);
    
    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);
    
    console.log('Parsed schema roles:', JSON.stringify(schema.roles, null, 2));
    
    // Expectations
    expect(schema.roles.length).toBe(1);
    expect(schema.roles[0].name).toBe('userRole');
    expect(schema.roles[0].privileges.length).toBe(1);
    expect(schema.roles[0].privileges[0].on).toBe('User');
    expect(schema.roles[0].privileges[0].privileges).toContain('select');
    expect(schema.roles[0].privileges[0].privileges).toContain('insert');
    expect(schema.roles[0].privileges[0].privileges).toContain('update');
  });

  test('should correctly parse a role with "all" privileges', () => {
    // Create a raw schema with a role having "all" privileges
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      role adminRole {
        privileges: "all" on User
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);
    
    console.log('Parsed schema roles:', JSON.stringify(schema.roles, null, 2));
    
    // Expectations
    expect(schema.roles.length).toBe(1);
    expect(schema.roles[0].name).toBe('adminRole');
    expect(schema.roles[0].privileges.length).toBe(1);
    expect(schema.roles[0].privileges[0].on).toBe('User');
    expect(schema.roles[0].privileges[0].privileges).toEqual(['select', 'insert', 'update', 'delete']);
  });

  test('should correctly parse a role with multiple table privileges', () => {
    // Create a raw schema with a role having privileges on multiple tables
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      model Post {
        id UUID @id
        title VARCHAR(255)
        content TEXT
      }

      role editorRole {
        privileges: ["select", "insert", "update"] on User
        privileges: ["select", "insert", "update", "delete"] on Post
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);
    
    console.log('Parsed schema roles:', JSON.stringify(schema.roles, null, 2));
    
    // Expectations
    expect(schema.roles.length).toBe(1);
    expect(schema.roles[0].name).toBe('editorRole');
    expect(schema.roles[0].privileges.length).toBe(2);
    
    // Check User privileges
    const userPrivileges = schema.roles[0].privileges.find(p => p.on === 'User');
    expect(userPrivileges).toBeDefined();
    expect(userPrivileges?.privileges).toContain('select');
    expect(userPrivileges?.privileges).toContain('insert');
    expect(userPrivileges?.privileges).toContain('update');
    
    // Check Post privileges
    const postPrivileges = schema.roles[0].privileges.find(p => p.on === 'Post');
    expect(postPrivileges).toBeDefined();
    expect(postPrivileges?.privileges).toContain('select');
    expect(postPrivileges?.privileges).toContain('insert');
    expect(postPrivileges?.privileges).toContain('update');
    expect(postPrivileges?.privileges).toContain('delete');
  });
}); 