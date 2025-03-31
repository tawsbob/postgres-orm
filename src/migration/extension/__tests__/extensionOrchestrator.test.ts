import { Extension } from '../../../parser/types';
import { ExtensionOrchestrator, ExtensionDiff } from '../extensionOrchestrator';
import { SQLGenerator } from '../../sqlGenerator';

describe('ExtensionOrchestrator', () => {
  let orchestrator: ExtensionOrchestrator;

  beforeEach(() => {
    orchestrator = new ExtensionOrchestrator();
  });

  describe('compareExtensions', () => {
    test('should identify added extensions', () => {
      // Arrange
      const fromExtensions: Extension[] = [];
      const toExtensions: Extension[] = [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' }
      ];

      // Act
      const diff = orchestrator.compareExtensions(fromExtensions, toExtensions);

      // Assert
      expect(diff.added).toHaveLength(2);
      expect(diff.added.map(e => e.name)).toContain('pg_trgm');
      expect(diff.added.map(e => e.name)).toContain('hstore');
      expect(diff.removed).toHaveLength(0);
      expect(diff.updated).toHaveLength(0);
    });

    test('should identify removed extensions', () => {
      // Arrange
      const fromExtensions: Extension[] = [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' }
      ];
      const toExtensions: Extension[] = [];

      // Act
      const diff = orchestrator.compareExtensions(fromExtensions, toExtensions);

      // Assert
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(2);
      expect(diff.removed.map(e => e.name)).toContain('pg_trgm');
      expect(diff.removed.map(e => e.name)).toContain('hstore');
      expect(diff.updated).toHaveLength(0);
    });

    test('should identify updated extensions', () => {
      // Arrange
      const fromExtensions: Extension[] = [
        { name: 'hstore', version: '1.4' }
      ];
      const toExtensions: Extension[] = [
        { name: 'hstore', version: '1.5' }
      ];

      // Act
      const diff = orchestrator.compareExtensions(fromExtensions, toExtensions);

      // Assert
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.updated).toHaveLength(1);
      expect(diff.updated[0].extension.name).toBe('hstore');
      expect(diff.updated[0].extension.version).toBe('1.5');
      expect(diff.updated[0].previousVersion).toBe('1.4');
    });

    test('should identify mixed changes to extensions', () => {
      // Arrange
      const fromExtensions: Extension[] = [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' },
        { name: 'postgis', version: '2.5' }
      ];
      const toExtensions: Extension[] = [
        { name: 'pg_trgm' }, // unchanged
        { name: 'hstore', version: '1.5' }, // updated version
        { name: 'uuid-ossp' } // added
      ];

      // Act
      const diff = orchestrator.compareExtensions(fromExtensions, toExtensions);

      // Assert
      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].name).toBe('uuid-ossp');
      
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].name).toBe('postgis');
      
      expect(diff.updated).toHaveLength(1);
      expect(diff.updated[0].extension.name).toBe('hstore');
      expect(diff.updated[0].extension.version).toBe('1.5');
      expect(diff.updated[0].previousVersion).toBe('1.4');
    });

    test('should not mark extension as updated if only version format changes', () => {
      // Arrange
      const fromExtensions: Extension[] = [
        { name: 'hstore', version: '1.4' }
      ];
      const toExtensions: Extension[] = [
        { name: 'hstore', version: '1.4' } // same version
      ];

      // Act
      const diff = orchestrator.compareExtensions(fromExtensions, toExtensions);

      // Assert
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.updated).toHaveLength(0);
    });

    test('should handle undefined version correctly', () => {
      // Arrange
      const fromExtensions: Extension[] = [
        { name: 'hstore' } // no version
      ];
      const toExtensions: Extension[] = [
        { name: 'hstore', version: '1.4' } // with version
      ];

      // Act
      const diff = orchestrator.compareExtensions(fromExtensions, toExtensions);

      // Assert
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.updated).toHaveLength(1);
      expect(diff.updated[0].previousVersion).toBe('');
    });
  });

  describe('generateExtensionMigrationSteps', () => {
    test('should generate steps for added extensions', () => {
      // Arrange
      const diff: ExtensionDiff = {
        added: [
          { name: 'pg_trgm' },
          { name: 'hstore', version: '1.4' }
        ],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generateExtensionMigrationSteps(diff);

      // Assert
      expect(steps).toHaveLength(2);
      
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('extension');
      expect(steps[0].name).toBe('pg_trgm');
      expect(steps[0].sql).toBe(SQLGenerator.generateCreateExtensionSQL('pg_trgm'));
      expect(steps[0].rollbackSql).toBe(SQLGenerator.generateDropExtensionSQL('pg_trgm'));
      
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('extension');
      expect(steps[1].name).toBe('hstore');
      expect(steps[1].sql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.4'));
      expect(steps[1].rollbackSql).toBe(SQLGenerator.generateDropExtensionSQL('hstore'));
    });

    test('should generate steps for removed extensions', () => {
      // Arrange
      const diff: ExtensionDiff = {
        added: [],
        removed: [
          { name: 'pg_trgm' },
          { name: 'hstore', version: '1.4' }
        ],
        updated: []
      };

      // Act
      const steps = orchestrator.generateExtensionMigrationSteps(diff);

      // Assert
      expect(steps).toHaveLength(2);
      
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('extension');
      expect(steps[0].name).toBe('pg_trgm');
      expect(steps[0].sql).toBe(SQLGenerator.generateDropExtensionSQL('pg_trgm'));
      expect(steps[0].rollbackSql).toBe(SQLGenerator.generateCreateExtensionSQL('pg_trgm'));
      
      expect(steps[1].type).toBe('drop');
      expect(steps[1].objectType).toBe('extension');
      expect(steps[1].name).toBe('hstore');
      expect(steps[1].sql).toBe(SQLGenerator.generateDropExtensionSQL('hstore'));
      expect(steps[1].rollbackSql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.4'));
    });

    test('should generate steps for updated extensions', () => {
      // Arrange
      const diff: ExtensionDiff = {
        added: [],
        removed: [],
        updated: [
          { 
            extension: { name: 'hstore', version: '1.5' },
            previousVersion: '1.4'
          }
        ]
      };

      // Act
      const steps = orchestrator.generateExtensionMigrationSteps(diff);

      // Assert
      expect(steps).toHaveLength(2);
      
      // First, drop the old extension
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('extension');
      expect(steps[0].name).toBe('hstore_old');
      expect(steps[0].sql).toBe(SQLGenerator.generateDropExtensionSQL('hstore'));
      expect(steps[0].rollbackSql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.4'));
      
      // Then, create with new version
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('extension');
      expect(steps[1].name).toBe('hstore');
      expect(steps[1].sql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.5'));
      expect(steps[1].rollbackSql).toBe(SQLGenerator.generateDropExtensionSQL('hstore'));
    });

    test('should generate steps for mixed changes', () => {
      // Arrange
      const diff: ExtensionDiff = {
        added: [{ name: 'uuid-ossp' }],
        removed: [{ name: 'postgis', version: '2.5' }],
        updated: [
          { 
            extension: { name: 'hstore', version: '1.5' },
            previousVersion: '1.4'
          }
        ]
      };

      // Act
      const steps = orchestrator.generateExtensionMigrationSteps(diff);

      // Assert
      expect(steps).toHaveLength(4);
      
      // Added extension
      expect(steps[0].type).toBe('create');
      expect(steps[0].name).toBe('uuid-ossp');
      
      // Removed extension
      expect(steps[1].type).toBe('drop');
      expect(steps[1].name).toBe('postgis');
      
      // Updated extension (drop old)
      expect(steps[2].type).toBe('drop');
      expect(steps[2].name).toBe('hstore_old');
      
      // Updated extension (create new)
      expect(steps[3].type).toBe('create');
      expect(steps[3].name).toBe('hstore');
      expect(steps[3].sql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.5'));
    });
  });
}); 