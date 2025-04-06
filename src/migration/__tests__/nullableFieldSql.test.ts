import { SQLGenerator } from '../sqlGenerator';
import { Field, Model, FieldType, FieldAttribute } from '../../parser/types';

describe('Nullable Field SQL Generation', () => {
  beforeAll(() => {
    // Register a test enum type
    SQLGenerator.registerEnumTypes([
      { name: 'UserRole', values: ['ADMIN', 'USER', 'PUBLIC'] }
    ]);
  });

  describe('Field SQL Generation', () => {
    it('should add NOT NULL constraint to non-nullable fields', () => {
      const field: Field = {
        name: 'name',
        type: 'VARCHAR' as FieldType,
        attributes: [],
        length: 255,
        nullable: false
      };

      const sql = SQLGenerator.generateFieldSQL(field);
      expect(sql).toContain('NOT NULL');
    });

    it('should not add NOT NULL constraint to nullable fields', () => {
      const field: Field = {
        name: 'description',
        type: 'TEXT' as FieldType,
        attributes: [],
        nullable: true
      };

      const sql = SQLGenerator.generateFieldSQL(field);
      expect(sql).not.toContain('NOT NULL');
    });

    it('should not add NOT NULL constraint to primary key fields', () => {
      const field: Field = {
        name: 'id',
        type: 'UUID' as FieldType,
        attributes: ['id' as FieldAttribute],
        nullable: false
      };

      const sql = SQLGenerator.generateFieldSQL(field);
      expect(sql).toContain('PRIMARY KEY');
      expect(sql).not.toContain('NOT NULL'); // PRIMARY KEY implies NOT NULL
    });

    it('should respect nullable status even for fields with default values', () => {
      const nonNullableField: Field = {
        name: 'isActive',
        type: 'BOOLEAN' as FieldType,
        attributes: ['default' as FieldAttribute],
        defaultValue: 'true',
        nullable: false
      };

      const nullableField: Field = {
        name: 'lastLogin',
        type: 'TIMESTAMP' as FieldType,
        attributes: ['default' as FieldAttribute],
        defaultValue: 'now()',
        nullable: true
      };

      const nonNullableSql = SQLGenerator.generateFieldSQL(nonNullableField);
      const nullableSql = SQLGenerator.generateFieldSQL(nullableField);

      expect(nonNullableSql).toContain('NOT NULL');
      expect(nullableSql).not.toContain('NOT NULL');
    });

    it('should correctly handle nullable enum type fields', () => {
      const field: Field = {
        name: 'role',
        type: 'UserRole' as FieldType,
        attributes: [],
        nullable: true
      };

      const sql = SQLGenerator.generateFieldSQL(field);
      expect(sql).toContain('"public"."UserRole"');
      expect(sql).not.toContain('NOT NULL');
    });
  });

  describe('Table SQL Generation', () => {
    it('should generate table with mixed nullable and non-nullable fields', () => {
      const model: Model = {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute, 'default' as FieldAttribute],
            defaultValue: 'gen_random_uuid()',
            nullable: false
          },
          {
            name: 'email',
            type: 'VARCHAR' as FieldType,
            attributes: ['unique' as FieldAttribute],
            length: 255,
            nullable: false
          },
          {
            name: 'name',
            type: 'VARCHAR' as FieldType,
            length: 150,
            attributes: [],
            nullable: true
          },
          {
            name: 'age',
            type: 'SMALLINT' as FieldType,
            attributes: [],
            nullable: true
          },
          {
            name: 'balance',
            type: 'INTEGER' as FieldType,
            attributes: [],
            nullable: false
          },
          {
            name: 'role',
            type: 'UserRole' as FieldType,
            attributes: ['default' as FieldAttribute],
            defaultValue: 'USER',
            nullable: false
          }
        ],
        relations: []
      };

      const sql = SQLGenerator.generateCreateTableSQL(model);
      
      // Check non-nullable fields have NOT NULL constraint
      expect(sql).toContain('"email" VARCHAR(255) UNIQUE NOT NULL');
      expect(sql).toContain('"balance" INTEGER NOT NULL');
      expect(sql).toContain('"role" "public"."UserRole" DEFAULT \'USER\'::"public"."UserRole" NOT NULL');
      
      // Check nullable fields don't have NOT NULL constraint
      expect(sql).not.toContain('"name" VARCHAR(150) NOT NULL');
      expect(sql).not.toContain('"age" SMALLINT NOT NULL');
      
      // Check primary key doesn't have redundant NOT NULL
      expect(sql).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
      expect(sql).not.toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
    });
  });

  describe('Alter Column SQL Generation', () => {
    it('should generate SQL to add NOT NULL constraint when field changes from nullable to non-nullable', () => {
      const oldField: Field = {
        name: 'description',
        type: 'TEXT' as FieldType,
        attributes: [],
        nullable: true
      };

      const newField: Field = {
        name: 'description',
        type: 'TEXT' as FieldType,
        attributes: [],
        nullable: false
      };

      const sql = SQLGenerator.generateAlterColumnSQL('Product', oldField, newField);
      expect(sql).toContain('ALTER COLUMN "description" SET NOT NULL');
    });

    it('should generate SQL to drop NOT NULL constraint when field changes from non-nullable to nullable', () => {
      const oldField: Field = {
        name: 'phoneNumber',
        type: 'VARCHAR' as FieldType,
        attributes: [],
        length: 20,
        nullable: false
      };

      const newField: Field = {
        name: 'phoneNumber',
        type: 'VARCHAR' as FieldType,
        attributes: [],
        length: 20,
        nullable: true
      };

      const sql = SQLGenerator.generateAlterColumnSQL('User', oldField, newField);
      expect(sql).toContain('ALTER COLUMN "phoneNumber" DROP NOT NULL');
    });

    it('should not change nullability when it remains the same', () => {
      const oldField: Field = {
        name: 'count',
        type: 'INTEGER' as FieldType,
        attributes: [],
        nullable: false
      };

      const newField: Field = {
        name: 'count',
        type: 'BIGINT' as FieldType,
        attributes: [],
        nullable: false
      };

      const sql = SQLGenerator.generateAlterColumnSQL('Stats', oldField, newField);
      expect(sql).toContain('ALTER COLUMN "count" TYPE BIGINT');
      expect(sql).not.toContain('SET NOT NULL');
      expect(sql).not.toContain('DROP NOT NULL');
    });

    it('should handle changing type and nullability together', () => {
      const oldField: Field = {
        name: 'description',
        type: 'VARCHAR' as FieldType,
        length: 255,
        attributes: [],
        nullable: true
      };

      const newField: Field = {
        name: 'description',
        type: 'TEXT' as FieldType,
        attributes: [],
        nullable: false
      };

      const sql = SQLGenerator.generateAlterColumnSQL('Product', oldField, newField);
      expect(sql).toContain('ALTER COLUMN "description" TYPE TEXT');
      expect(sql).toContain('ALTER COLUMN "description" SET NOT NULL');
    });
  });
}); 