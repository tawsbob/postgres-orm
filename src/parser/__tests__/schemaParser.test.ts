import { SchemaParser } from '../schemaParser';
import { Schema } from '../types';

describe('SchemaParser', () => {
  let parser: SchemaParser;

  beforeEach(() => {
    parser = new SchemaParser();
  });

  test('should parse enums correctly', () => {
    const schema = parser.parseSchema('schema/database.schema');
    
    expect(schema.enums).toHaveLength(2);
    expect(schema.enums[0].name).toBe('UserRole');
    expect(schema.enums[0].values).toContain('ADMIN');
    expect(schema.enums[0].values).toContain('USER');
    expect(schema.enums[0].values).toContain('GUEST');
  });

  test('should parse models correctly', () => {
    const schema = parser.parseSchema('schema/database.schema');
    
    expect(schema.models).toHaveLength(5);
    const userModel = schema.models.find(m => m.name === 'User');
    expect(userModel).toBeDefined();
    expect(userModel?.fields).toHaveLength(10);
    expect(userModel?.relations).toHaveLength(2);
  });

  test('should parse fields with attributes correctly', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const userModel = schema.models.find(m => m.name === 'User');
    
    const idField = userModel?.fields.find(f => f.name === 'id');
    expect(idField?.type).toBe('UUID');
    expect(idField?.attributes).toContain('id');
    expect(idField?.attributes).toContain('default');
  });

  test('should parse relations correctly', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const userModel = schema.models.find(m => m.name === 'User');
    
    // Test optional one-to-one relation
    const profileRelation = userModel?.relations.find(r => r.name === 'profile');
    expect(profileRelation?.model).toBe('Profile');
    expect(profileRelation?.type).toBe('one-to-one');

    // Test one-to-many relation
    const ordersRelation = userModel?.relations.find(r => r.name === 'orders');
    expect(ordersRelation?.model).toBe('Order');
    expect(ordersRelation?.type).toBe('one-to-many');
  });

  test('should parse relation fields and references correctly', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const profileModel = schema.models.find(m => m.name === 'Profile');
    
    const userRelation = profileModel?.relations.find(r => r.name === 'user');
    expect(userRelation?.fields).toEqual(['userId']);
    expect(userRelation?.references).toEqual(['id']);
  });

  test('should parse extensions correctly', () => {
    const schema = parser.parseSchema('schema/database.schema');
    
    expect(schema.extensions.map(e => e.name)).toContain('pgcrypto');
    expect(schema.extensions.map(e => e.name)).toContain('postgis');
    expect(schema.extensions.map(e => e.name)).toContain('uuid-ossp');
  });

  test('should parse row level security configuration correctly', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const postModel = schema.models.find(m => m.name === 'User');
    
    expect(postModel?.rowLevelSecurity).toBeDefined();
    expect(postModel?.rowLevelSecurity?.enabled).toBe(true);
    expect(postModel?.rowLevelSecurity?.force).toBe(true);
  });

  describe('parseSchema', () => {
    it('should parse a schema with roles', () => {
      const schemaContent = `
        role blogUser {
          privileges: ["select", "insert", "update"] on Post
        }

        role admin {
          privileges: ["select", "insert", "update", "delete"] on Post
          privileges: ["select"] on User
        }

        role testRole {
          privileges: "all" on Post
        }

        model Post {
          id UUID @id
          title VARCHAR(255)
        }

        model User {
          id UUID @id
          name VARCHAR(255)
        }
      `;

      const schema = parser.parseSchema(undefined, schemaContent);

      expect(schema.roles).toHaveLength(3);
      
      // Check blogUser role
      const blogUser = schema.roles.find(r => r.name === 'blogUser');
      expect(blogUser).toBeDefined();
      expect(blogUser?.privileges).toHaveLength(1);
      expect(blogUser?.privileges[0].privileges).toEqual(['select', 'insert', 'update']);
      expect(blogUser?.privileges[0].on).toBe('Post');

      // Check admin role
      const admin = schema.roles.find(r => r.name === 'admin');
      expect(admin).toBeDefined();
      expect(admin?.privileges).toHaveLength(2);
      expect(admin?.privileges[0].privileges).toEqual(['select', 'insert', 'update', 'delete']);
      expect(admin?.privileges[0].on).toBe('Post');
      expect(admin?.privileges[1].privileges).toEqual(['select']);
      expect(admin?.privileges[1].on).toBe('User');

      // Check models are still parsed correctly
      expect(schema.models).toHaveLength(2);
      expect(schema.models[0].name).toBe('Post');
      expect(schema.models[1].name).toBe('User');
    });

    it('should handle invalid role syntax', () => {
      const schemaContent = `
        role invalidRole {
          invalid syntax
        }
      `;

      expect(() => parser.parseSchema(undefined, schemaContent)).toThrow('Invalid role definition');
    });
  });
}); 