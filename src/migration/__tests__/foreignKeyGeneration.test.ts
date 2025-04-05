import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../migrationGenerator';

describe('Foreign Key Generation', () => {
  let parser: SchemaParserV1;
  let migrationGenerator: MigrationGenerator;

  beforeEach(() => {
    parser = new SchemaParserV1();
    migrationGenerator = new MigrationGenerator();
  });

  it('should correctly generate foreign keys for all defined relations', () => {
    // Define a schema similar to our actual schema with the User-Order relationship
    const schemaContent = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        orders        Order[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        user          User            @relation(fields: [userId], references: [id])
      }
    `;

    // Parse the schema
    const schema = parser.parseSchema(undefined, schemaContent);
    
    // Generate migration
    const migration = migrationGenerator.generateMigration(schema);
    
    // Find all the foreign key constraints in the migration steps
    const foreignKeySteps = migration.steps.filter(
      step => step.objectType === 'constraint' && step.name.includes('fkey')
    );

    // Should have exactly one foreign key constraint (Order.userId -> User.id)
    expect(foreignKeySteps.length).toBe(1);
    
    // Verify the foreign key details
    const orderUserForeignKey = foreignKeySteps.find(
      step => step.name.includes('Order') && step.name.includes('user')
    );
    
    expect(orderUserForeignKey).toBeDefined();
    expect(orderUserForeignKey?.sql).toContain('FOREIGN KEY ("userId")');
    expect(orderUserForeignKey?.sql).toContain('REFERENCES "public"."User" ("id")');
  });

  it('should handle bidirectional relations correctly', () => {
    // Define a schema with bidirectional relations (like User-Profile)
    const schemaContent = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        profile       Profile?        @relation("UserProfile")
      }

      model Profile {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID            @unique
        user          User            @relation("UserProfile", fields: [userId], references: [id])
      }
    `;

    // Parse the schema
    const schema = parser.parseSchema(undefined, schemaContent);
    
    // Generate migration
    const migration = migrationGenerator.generateMigration(schema);
    
    // Find all the foreign key constraints in the migration steps
    const foreignKeySteps = migration.steps.filter(
      step => step.objectType === 'constraint' && step.name.includes('fkey')
    );

    // Should have one foreign key constraint (Profile.userId -> User.id)
    expect(foreignKeySteps.length).toBe(1);
    
    // Verify the foreign key details
    const profileUserForeignKey = foreignKeySteps.find(
      step => step.name.includes('Profile') && step.name.includes('user')
    );
    
    expect(profileUserForeignKey).toBeDefined();
    expect(profileUserForeignKey?.sql).toContain('FOREIGN KEY ("userId")');
    expect(profileUserForeignKey?.sql).toContain('REFERENCES "public"."User" ("id")');
  });

  it('should correctly handle complex schema with multiple relations', () => {
    // Use the same schema structure as in database.schema
    const schemaContent = `
      enum OrderStatus {
        PENDING
        PROCESSING
        SHIPPED
        DELIVERED
        CANCELLED
      }

      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        isActive      BOOLEAN         @default(true)
        profile       Profile?        @relation("UserProfile")
        orders        Order[]
      }

      model Profile {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID            @unique
        bio           TEXT
        user          User            @relation("UserProfile", fields: [userId], references: [id])
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        status        OrderStatus     @default(PENDING)
        totalAmount   DECIMAL(10,2)
        user          User            @relation(fields: [userId], references: [id])
        products      ProductOrder[]
      }

      model Product {
        id            UUID            @id @default(gen_random_uuid())
        name          VARCHAR(255)
        orders        ProductOrder[]
      }

      model ProductOrder {
        id            SERIAL          @id
        orderId       UUID
        productId     UUID
        quantity      INTEGER
        order         Order           @relation(fields: [orderId], references: [id])
        product       Product         @relation(fields: [productId], references: [id])
      }
    `;

    // Parse the schema
    const schema = parser.parseSchema(undefined, schemaContent);
    
    // Generate migration
    const migration = migrationGenerator.generateMigration(schema);
    
    // Find all the foreign key constraints in the migration steps
    const foreignKeySteps = migration.steps.filter(
      step => step.objectType === 'constraint' && step.name.includes('fkey')
    );

    // Should have four foreign key constraints:
    // 1. Profile.userId -> User.id
    // 2. Order.userId -> User.id
    // 3. ProductOrder.orderId -> Order.id
    // 4. ProductOrder.productId -> Product.id
    expect(foreignKeySteps.length).toBe(4);
    
    // Verify all expected foreign keys exist
    const relationDefs = [
      { model: 'Profile', field: 'userId', targetModel: 'User', targetField: 'id' },
      { model: 'Order', field: 'userId', targetModel: 'User', targetField: 'id' },
      { model: 'ProductOrder', field: 'orderId', targetModel: 'Order', targetField: 'id' },
      { model: 'ProductOrder', field: 'productId', targetModel: 'Product', targetField: 'id' }
    ];
    
    relationDefs.forEach(relDef => {
      const fk = foreignKeySteps.find(step => 
        step.sql.includes(`ALTER TABLE "public"."${relDef.model}"`) &&
        step.sql.includes(`FOREIGN KEY ("${relDef.field}")`) &&
        step.sql.includes(`REFERENCES "public"."${relDef.targetModel}" ("${relDef.targetField}")`)
      );
      
      expect(fk).toBeDefined();
    });
  });
}); 