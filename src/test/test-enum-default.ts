import { SQLGenerator } from '../migration/sqlGenerator';
import { Enum, FieldAttribute, FieldType, Model } from '../parser/types';

// Register enum types
SQLGenerator.registerEnumTypes([
  { name: 'UserRole', values: ['ADMIN', 'USER', 'PUBLIC', 'GUEST', 'MODERATOR'] },
  { name: 'OrderStatus', values: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'ON_HOLD'] }
]);

// Create a field with an enum type and default value
const roleField = {
  name: 'role',
  type: 'UserRole' as FieldType,
  attributes: ['default' as FieldAttribute],
  defaultValue: 'USER',
  nullable: false
};

// Create a field with an enum type and default value
const statusField = {
  name: 'status',
  type: 'OrderStatus' as FieldType,
  attributes: ['default' as FieldAttribute],
  defaultValue: 'PENDING',
  nullable: false
};

// Generate SQL for the fields
const roleFieldSQL = SQLGenerator.generateFieldSQL(roleField);
const statusFieldSQL = SQLGenerator.generateFieldSQL(statusField);

console.log('Role Field SQL:', roleFieldSQL);
console.log('Status Field SQL:', statusFieldSQL);

// Create a test model with enum fields
const testModel: Model = {
  name: 'TestModel',
  fields: [
    {
      name: 'id',
      type: 'UUID' as FieldType,
      attributes: ['id' as FieldAttribute, 'default' as FieldAttribute],
      defaultValue: 'gen_random_uuid()',
      nullable: false
    },
    roleField,
    statusField
  ],
  relations: [],
  indexes: []
};

// Generate create table SQL
const createTableSQL = SQLGenerator.generateCreateTableSQL(testModel);
console.log('\nCreate Table SQL:');
console.log(createTableSQL); 