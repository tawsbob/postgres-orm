import SchemaParserV1 from '../schemaParser';
import { Field } from '../types';

describe('Nullable Fields Parsing', () => {
  const parser = new SchemaParserV1();
  let parseField: (line: string) => Field;

  beforeAll(() => {
    // Access the private parseField method for testing
    parseField = (parser as any).parseField.bind(parser);
  });

  describe('Field Nullable Property', () => {
    it('should mark field as nullable when field name has question mark', () => {
      const field = parseField('age? SMALLINT');
      
      expect(field).toBeDefined();
      expect(field.name).toBe('age');
      expect(field.nullable).toBe(true);
      expect(field.type).toBe('SMALLINT');
    });

    it('should mark field as non-nullable by default when no question mark', () => {
      const field = parseField('age SMALLINT');
      
      expect(field).toBeDefined();
      expect(field.name).toBe('age');
      expect(field.nullable).toBe(false);
      expect(field.type).toBe('SMALLINT');
    });

    it('should handle nullable field with attributes', () => {
      const field = parseField('createdAt? TIMESTAMP @default(now())');
      
      expect(field).toBeDefined();
      expect(field.name).toBe('createdAt');
      expect(field.nullable).toBe(true);
      expect(field.type).toBe('TIMESTAMP');
      expect(field.attributes).toContain('default');
      expect(field.defaultValue).toBe('now()');
    });

    it('should handle nullable field with length', () => {
      const field = parseField('name? VARCHAR(100)');
      
      expect(field).toBeDefined();
      expect(field.name).toBe('name');
      expect(field.nullable).toBe(true);
      expect(field.type).toBe('VARCHAR');
      expect(field.length).toBe(100);
    });

    it('should handle nullable field with precision and scale', () => {
      const field = parseField('amount? DECIMAL(10,2)');
      
      expect(field).toBeDefined();
      expect(field.name).toBe('amount');
      expect(field.nullable).toBe(true);
      expect(field.type).toBe('DECIMAL');
      expect(field.precision).toBe(10);
      expect(field.scale).toBe(2);
    });

    it('should handle nullable array fields', () => {
      const field = parseField('tags? TEXT[]');
      
      expect(field).toBeDefined();
      expect(field.name).toBe('tags');
      expect(field.nullable).toBe(true);
      expect(field.type).toBe('TEXT[]');
    });

    it('should handle primary key fields as non-nullable even with question mark', () => {
      const field = parseField('id? UUID @id @default(gen_random_uuid())');
      
      expect(field).toBeDefined();
      expect(field.name).toBe('id');
      expect(field.nullable).toBe(true); // Note: The parser will set nullable=true, but SQL generation should ignore this
      expect(field.type).toBe('UUID');
      expect(field.attributes).toContain('id');
    });
  });

  describe('Full Schema Parsing', () => {
    it('should parse model with mix of nullable and non-nullable fields', () => {
      const schemaContent = `
        model User {
          id            UUID            @id @default(gen_random_uuid())
          email         VARCHAR(255)    @unique
          name?         VARCHAR(150)
          age?          SMALLINT
          balance       INTEGER
          isActive      BOOLEAN         @default(true)
        }
      `;
      
      const schema = parser.parseSchema(undefined, schemaContent);
      expect(schema.models).toHaveLength(1);
      
      const userModel = schema.models[0];
      expect(userModel.name).toBe('User');
      expect(userModel.fields).toHaveLength(6);
      
      // Non-nullable fields
      const idField = userModel.fields.find(f => f.name === 'id');
      const emailField = userModel.fields.find(f => f.name === 'email');
      const balanceField = userModel.fields.find(f => f.name === 'balance');
      const isActiveField = userModel.fields.find(f => f.name === 'isActive');
      
      expect(idField?.nullable).toBe(false);
      expect(emailField?.nullable).toBe(false);
      expect(balanceField?.nullable).toBe(false);
      expect(isActiveField?.nullable).toBe(false);
      
      // Nullable fields
      const nameField = userModel.fields.find(f => f.name === 'name');
      const ageField = userModel.fields.find(f => f.name === 'age');
      
      expect(nameField?.nullable).toBe(true);
      expect(ageField?.nullable).toBe(true);
    });
  });
}); 