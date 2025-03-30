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
    
    expect(schema.extensions).toHaveLength(3);
    expect(schema.extensions.map(e => e.name)).toContain('pgcrypto');
    expect(schema.extensions.map(e => e.name)).toContain('postgis');
    expect(schema.extensions.map(e => e.name)).toContain('uuid-ossp');
  });
}); 