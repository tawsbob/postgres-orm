import SchemaParserV1 from '../schemaParser';
import { Schema, Model, Enum, Field, Extension, Role } from '../types';
import path from 'path';

describe('SchemaParserV1', () => {
  const parser = new SchemaParserV1();
  const schemaPath = path.resolve(__dirname, '../../../schema/database.schema');
  let parsedSchema: Schema;

  // Parse the schema once for all tests
  beforeAll(() => {
    parsedSchema = parser.parseSchema(schemaPath);
  });

  describe('Schema Structure', () => {
    it('should parse the schema into the correct structure', () => {
      expect(parsedSchema).toBeDefined();
      expect(parsedSchema.models).toBeInstanceOf(Array);
      expect(parsedSchema.enums).toBeInstanceOf(Array);
      expect(parsedSchema.extensions).toBeInstanceOf(Array);
      expect(parsedSchema.roles).toBeInstanceOf(Array);
    });

    it('should parse the correct number of models, enums, extensions, and roles', () => {
      expect(parsedSchema.models.length).toBe(6); // User, Profile, Order, Product, ProductOrder, Testing
      expect(parsedSchema.enums.length).toBe(2); // UserRole, OrderStatus
      expect(parsedSchema.extensions.length).toBe(3); // pgcrypto, postgis, uuid-ossp
      expect(parsedSchema.roles.length).toBe(2); // logdUser, adminRole
    });
  });

  describe('Enum Parsing', () => {
    it('should correctly parse UserRole enum', () => {
      const userRoleEnum = parsedSchema.enums.find(e => e.name === 'UserRole');
      expect(userRoleEnum).toBeDefined();
      expect(userRoleEnum?.values).toEqual(['ADMIN', 'USER', 'PUBLIC']);
    });

    it('should correctly parse OrderStatus enum', () => {
      const orderStatusEnum = parsedSchema.enums.find(e => e.name === 'OrderStatus');
      expect(orderStatusEnum).toBeDefined();
      expect(orderStatusEnum?.values).toEqual(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    });
  });

  describe('Extension Parsing', () => {
    it('should correctly parse all extensions', () => {
      const extensionNames = parsedSchema.extensions.map(ext => ext.name);
      expect(extensionNames).toContain('pgcrypto');
      expect(extensionNames).toContain('postgis');
      expect(extensionNames).toContain('uuid-ossp');
    });
  });

  describe('Model Parsing', () => {
    it('should correctly parse the User model', () => {
      const userModel = parsedSchema.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();
      
      // Check fields
      const fields = userModel?.fields || [];
      expect(fields.length).toBe(9);
      
      // Check specific fields
      const idField = fields.find(f => f.name === 'id');
      expect(idField).toMatchObject({
        name: 'id',
        type: 'UUID',
        attributes: ['id', 'default']
      });
      
      const emailField = fields.find(f => f.name === 'email');
      expect(emailField).toMatchObject({
        name: 'email',
        type: 'VARCHAR',
        attributes: ['unique'],
        length: 255
      });
      
      const balanceField = fields.find(f => f.name === 'balance');
      expect(balanceField).toMatchObject({
        name: 'balance',
        type: 'INTEGER'
      });
      
      // Check relations
      const relations = userModel?.relations || [];
      expect(relations.length).toBe(2);
      
      const profileRelation = relations.find(r => r.name === 'profile');
      expect(profileRelation).toMatchObject({
        name: 'profile',
        model: 'Profile',
        type: 'one-to-one'
      });
      
      const ordersRelation = relations.find(r => r.name === 'orders');
      expect(ordersRelation).toMatchObject({
        name: 'orders',
        model: 'Order',
        type: 'one-to-many'
      });
      
      // Check row-level security
      expect(userModel?.rowLevelSecurity).toEqual({
        enabled: true,
        force: true
      });
      
      // Check policies
      expect(userModel?.policies).toHaveLength(2);
      
      const userIsolationPolicy = userModel?.policies?.find(p => p.name === 'userIsolation');
      expect(userIsolationPolicy).toMatchObject({
        name: 'userIsolation',
        for: ['select', 'update'],
        to: 'Profile',
        using: '(userId = (SELECT current_setting(\'app.current_user_id\')::integer));'
      });
    });

    it('should correctly parse the Profile model', () => {
      const profileModel = parsedSchema.models.find(m => m.name === 'Profile');
      expect(profileModel).toBeDefined();
      
      // Check fields
      const fields = profileModel?.fields || [];
      expect(fields.length).toBe(5);
      
      // Check specific fields
      const locationField = fields.find(f => f.name === 'location');
      
      //location field should have a name and type
      expect(locationField).toBeDefined();
      expect(locationField?.type).toBe('POINT');
      expect(locationField?.name).toBe('location');
      // Check relations
      const relations = profileModel?.relations || [];
      expect(relations.length).toBe(1);

      console.log(relations);
      
      const userRelation = relations.find(r => r.name === 'UserProfile');
      
      expect(userRelation).toMatchObject({
        name: 'UserProfile',
        model: 'User',
        type: 'one-to-one',
        fields: [ 'userId' ],
        references: [ 'id' ]
      });
      
      // Check if the relation has the correct fields and references
      expect(userRelation?.fields).toContain('userId');
      expect(userRelation?.references).toContain('id');
    });

    it('should correctly parse the Order model with its relations', () => {
      const orderModel = parsedSchema.models.find(m => m.name === 'Order');
      expect(orderModel).toBeDefined();
      
      // Check fields
      const fields = orderModel?.fields || [];
      expect(fields.length).toBe(7);
      
      // Check relations
      const relations = orderModel?.relations || [];
      expect(relations.length).toBe(2);
      
      // Check products relation (one-to-many)
      const productsRelation = relations.find(r => r.name === 'products');
      expect(productsRelation).toMatchObject({
        name: 'products',
        model: 'ProductOrder',
        type: 'one-to-many'
      });
    });

    it('should correctly parse the Product model with array and JSONB fields', () => {
      const productModel = parsedSchema.models.find(m => m.name === 'Product');
      expect(productModel).toBeDefined();
      
      // Check fields
      const fields = productModel?.fields || [];
      expect(fields.length).toBe(10);
      
      // Check array field
      const tagsField = fields.find(f => f.name === 'tags');
      expect(tagsField).toMatchObject({
        name: 'tags',
        type: 'TEXT[]'
      });
      
      // Check JSONB field
      const metadataField = fields.find(f => f.name === 'metadata');
      expect(metadataField).toMatchObject({
        name: 'metadata',
        type: 'JSONB'
      });
    });

    it('should correctly parse the ProductOrder model with its relations', () => {
      const productOrderModel = parsedSchema.models.find(m => m.name === 'ProductOrder');
      expect(productOrderModel).toBeDefined();
      
      // Check fields
      const fields = productOrderModel?.fields || [];
      expect(fields.length).toBe(5);
      
      // Check specific fields
      const idField = fields.find(f => f.name === 'id');
      expect(idField).toMatchObject({
        name: 'id',
        type: 'SERIAL',
        attributes: ['id']
      });
      
      // Check relations
      const relations = productOrderModel?.relations || [];
      expect(relations.length).toBe(2);
      
      // Check order relation
      const orderRelation = relations.find(r => r.name === 'order');
      expect(orderRelation).toMatchObject({
        name: 'order',
        model: 'Order',
        type: 'one-to-one'
      });
      expect(orderRelation?.fields).toContain('orderId');
      expect(orderRelation?.references).toContain('id');
      
      // Check product relation
      const productRelation = relations.find(r => r.name === 'product');
      expect(productRelation).toMatchObject({
        name: 'product',
        model: 'Product',
        type: 'one-to-one'
      });
      expect(productRelation?.fields).toContain('productId');
      expect(productRelation?.references).toContain('id');
    });
  });

  describe('Role Parsing', () => {
    it('should correctly parse the logdUser role', () => {
      const logdUserRole = parsedSchema.roles.find(r => r.name === 'logdUser');
      expect(logdUserRole).toBeDefined();
      
      expect(logdUserRole?.privileges).toHaveLength(1);
      expect(logdUserRole?.privileges[0].on).toBe('User');
      expect(logdUserRole?.privileges[0].privileges).toContain('select');
      expect(logdUserRole?.privileges[0].privileges).toContain('insert');
      expect(logdUserRole?.privileges[0].privileges).toContain('update');
    });

    it('should correctly parse the adminRole role with "all" privileges', () => {
      const adminRole = parsedSchema.roles.find(r => r.name === 'adminRole');
      expect(adminRole).toBeDefined();
      
      expect(adminRole?.privileges).toHaveLength(1);
      expect(adminRole?.privileges[0].on).toBe('User');
      expect(adminRole?.privileges[0].privileges).toEqual(["select", "insert", "update", "delete"]);
    });
  });

  describe('Trigger Parsing', () => {
    it('should correctly parse triggers in the User model', () => {
      const userModel = parsedSchema.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();
      expect(userModel?.triggers).toBeDefined();
      expect(userModel?.triggers?.length).toBeGreaterThan(0);
      
      // Check the balance update trigger
      const balanceTrigger = userModel?.triggers?.find(t => 
        t.execute.includes('Balance cannot be updated directly')
      );
      
      expect(balanceTrigger).toBeDefined();
      expect(balanceTrigger?.event).toBe('BEFORE UPDATE');
      expect(balanceTrigger?.level).toBe('FOR EACH ROW');
      expect(balanceTrigger?.execute).toContain('IF (OLD.balance <> NEW.balance)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle default values correctly', () => {
      const userModel = parsedSchema.models.find(m => m.name === 'User');
      const fields = userModel?.fields || [];
      
      const idField = fields.find(f => f.name === 'id');
      expect(idField?.defaultValue).toBe('gen_random_uuid()');
      
      const roleField = fields.find(f => f.name === 'role');
      expect(roleField?.defaultValue).toBe('USER');
      
      const createdAtField = fields.find(f => f.name === 'createdAt');
      expect(createdAtField?.defaultValue).toBe('now()');
    });

    it('should handle boolean field types and defaults', () => {
      const userModel = parsedSchema.models.find(m => m.name === 'User');
      const fields = userModel?.fields || [];
      
      const isActiveField = fields.find(f => f.name === 'isActive');
      expect(isActiveField).toMatchObject({
        name: 'isActive',
        type: 'BOOLEAN',
        attributes: ['default'],
        defaultValue: 'true'
      });
    });
  });
});
