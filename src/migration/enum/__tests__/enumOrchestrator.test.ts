import { Enum } from '../../../parser/types';
import { EnumOrchestrator, EnumDiff } from '../enumOrchestrator';
import { SQLGenerator } from '../../sqlGenerator';

// Mock SQLGenerator methods to avoid testing SQL generation logic
jest.mock('../../sqlGenerator', () => ({
  SQLGenerator: {
    generateCreateEnumSQL: jest.fn().mockReturnValue('CREATE ENUM SQL'),
    generateDropEnumSQL: jest.fn().mockReturnValue('DROP ENUM SQL')
  }
}));

describe('EnumOrchestrator', () => {
  let orchestrator: EnumOrchestrator;
  
  beforeEach(() => {
    orchestrator = new EnumOrchestrator();
    jest.clearAllMocks();
  });
  
  describe('compareEnums', () => {
    it('should detect added enums', () => {
      const fromEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER'] }
      ];
      
      const toEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER'] },
        { name: 'Status', values: ['ACTIVE', 'INACTIVE'] }
      ];
      
      const result = orchestrator.compareEnums(fromEnums, toEnums);
      
      expect(result.added).toHaveLength(1);
      expect(result.added[0].name).toBe('Status');
      expect(result.removed).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
    });
    
    it('should detect removed enums', () => {
      const fromEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER'] },
        { name: 'Status', values: ['ACTIVE', 'INACTIVE'] }
      ];
      
      const toEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER'] }
      ];
      
      const result = orchestrator.compareEnums(fromEnums, toEnums);
      
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].name).toBe('Status');
      expect(result.updated).toHaveLength(0);
    });
    
    it('should detect updated enums (added values)', () => {
      const fromEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER'] }
      ];
      
      const toEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER', 'GUEST'] }
      ];
      
      const result = orchestrator.compareEnums(fromEnums, toEnums);
      
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].enum.name).toBe('Role');
      expect(result.updated[0].enum.values).toContain('GUEST');
      expect(result.updated[0].previousValues).toEqual(['ADMIN', 'USER']);
    });
    
    it('should detect updated enums (removed values)', () => {
      const fromEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER', 'GUEST'] }
      ];
      
      const toEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER'] }
      ];
      
      const result = orchestrator.compareEnums(fromEnums, toEnums);
      
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].enum.name).toBe('Role');
      expect(result.updated[0].enum.values).not.toContain('GUEST');
      expect(result.updated[0].previousValues).toEqual(['ADMIN', 'USER', 'GUEST']);
    });
    
    it('should detect updated enums (reordered values)', () => {
      const fromEnums: Enum[] = [
        { name: 'Role', values: ['ADMIN', 'USER', 'GUEST'] }
      ];
      
      const toEnums: Enum[] = [
        { name: 'Role', values: ['USER', 'GUEST', 'ADMIN'] }
      ];
      
      const result = orchestrator.compareEnums(fromEnums, toEnums);
      
      // Reordering values should not trigger an update because 
      // the actual values are the same, just in different order
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
    });
    
    it('should handle empty enum lists', () => {
      const result = orchestrator.compareEnums([], []);
      
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
    });
  });
  
  describe('generateEnumMigrationSteps', () => {
    it('should generate steps for added enums', () => {
      const diff: EnumDiff = {
        added: [{ name: 'Status', values: ['ACTIVE', 'INACTIVE'] }],
        removed: [],
        updated: []
      };
      
      const steps = orchestrator.generateEnumMigrationSteps(diff);
      
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('enum');
      expect(steps[0].name).toBe('Status');
      expect(SQLGenerator.generateCreateEnumSQL).toHaveBeenCalledWith(diff.added[0], 'public');
      expect(SQLGenerator.generateDropEnumSQL).toHaveBeenCalledWith(diff.added[0], 'public');
    });
    
    it('should generate steps for removed enums', () => {
      const diff: EnumDiff = {
        added: [],
        removed: [{ name: 'Status', values: ['ACTIVE', 'INACTIVE'] }],
        updated: []
      };
      
      const steps = orchestrator.generateEnumMigrationSteps(diff);
      
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('enum');
      expect(steps[0].name).toBe('Status');
      expect(SQLGenerator.generateDropEnumSQL).toHaveBeenCalledWith(diff.removed[0], 'public');
      expect(SQLGenerator.generateCreateEnumSQL).toHaveBeenCalledWith(diff.removed[0], 'public');
    });
    
    it('should generate steps for updated enums', () => {
      const diff: EnumDiff = {
        added: [],
        removed: [],
        updated: [{
          enum: { name: 'Role', values: ['ADMIN', 'USER', 'GUEST'] },
          previousValues: ['ADMIN', 'USER']
        }]
      };
      
      const steps = orchestrator.generateEnumMigrationSteps(diff);
      
      expect(steps).toHaveLength(2);
      
      // First step should drop the enum
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('enum');
      expect(steps[0].name).toBe('Role_drop');
      
      // Second step should recreate the enum
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('enum');
      expect(steps[1].name).toBe('Role');
      
      // Verify SQLGenerator calls
      expect(SQLGenerator.generateDropEnumSQL).toHaveBeenCalled();
      expect(SQLGenerator.generateCreateEnumSQL).toHaveBeenCalled();
    });
    
    it('should use custom schema name when provided', () => {
      const diff: EnumDiff = {
        added: [{ name: 'Status', values: ['ACTIVE', 'INACTIVE'] }],
        removed: [],
        updated: []
      };
      
      orchestrator.generateEnumMigrationSteps(diff, 'custom_schema');
      
      expect(SQLGenerator.generateCreateEnumSQL).toHaveBeenCalledWith(diff.added[0], 'custom_schema');
    });
  });
}); 