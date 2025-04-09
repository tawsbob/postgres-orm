const { SQLGenerator } = require('../migration/sqlGenerator');

// Register enum types
SQLGenerator.registerEnumTypes([
  { name: 'UserRole', values: ['ADMIN', 'USER', 'PUBLIC', 'GUEST', 'MODERATOR'] },
  { name: 'OrderStatus', values: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'ON_HOLD'] }
]);

// Create a field with an enum type and default value
const roleField = {
  name: 'role',
  type: 'UserRole',
  attributes: ['default'],
  defaultValue: 'USER',
  nullable: false
};

// Create a field with an enum type and default value
const statusField = {
  name: 'status',
  type: 'OrderStatus',
  attributes: ['default'],
  defaultValue: 'PENDING',
  nullable: false
};

// Generate SQL for the fields
const roleFieldSQL = SQLGenerator.generateFieldSQL(roleField);
const statusFieldSQL = SQLGenerator.generateFieldSQL(statusField);

console.log('Role Field SQL:', roleFieldSQL);
console.log('Status Field SQL:', statusFieldSQL);

// Create a test model with enum fields
const testModel = {
  name: 'TestModel',
  fields: [
    {
      name: 'id',
      type: 'UUID',
      attributes: ['id', 'default'],
      defaultValue: 'gen_random_uuid()',
      nullable: false
    },
    roleField,
    statusField
  ]
};

// Generate create table SQL
const createTableSQL = SQLGenerator.generateCreateTableSQL(testModel);
console.log('\nCreate Table SQL:');
console.log(createTableSQL); 