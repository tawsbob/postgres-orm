import { Role } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface representing differences between two sets of roles
 */
export interface RoleDiff {
  /**
   * Roles that exist in the target schema but not in the source schema
   */
  added: Role[];
  
  /**
   * Roles that exist in the source schema but not in the target schema
   */
  removed: Role[];
  
  /**
   * Roles that exist in both schemas but have different privileges
   */
  updated: {
    role: Role;
    previousRole: Role;
  }[];
}

/**
 * Orchestrator for managing PostgreSQL role changes between schema versions
 */
export class RoleOrchestrator {
  /**
   * Compare two sets of roles and identify differences
   * 
   * @param fromRoles Source schema roles
   * @param toRoles Target schema roles
   * @returns Differences between the two sets of roles
   */
  compareRoles(fromRoles: Role[], toRoles: Role[]): RoleDiff {
    const diff: RoleDiff = {
      added: [],
      removed: [],
      updated: []
    };
    
    // Create maps for easy lookup
    const fromRolesMap = new Map<string, Role>();
    fromRoles.forEach(role => fromRolesMap.set(role.name, role));
    
    const toRolesMap = new Map<string, Role>();
    toRoles.forEach(role => toRolesMap.set(role.name, role));
    
    // Find added roles
    toRoles.forEach(role => {
      if (!fromRolesMap.has(role.name)) {
        diff.added.push(role);
      }
    });
    
    // Find removed roles
    fromRoles.forEach(role => {
      if (!toRolesMap.has(role.name)) {
        diff.removed.push(role);
      }
    });
    
    // Find updated roles
    fromRoles.forEach(fromRole => {
      const toRole = toRolesMap.get(fromRole.name);
      if (toRole && this.areRolePrivilegesDifferent(fromRole, toRole)) {
        diff.updated.push({
          role: toRole,
          previousRole: fromRole
        });
      }
    });
    
    return diff;
  }

  /**
   * Compare privileges between two roles to determine if they've changed
   * 
   * @param fromRole Source role
   * @param toRole Target role
   * @returns True if the privileges are different, false otherwise
   */
  private areRolePrivilegesDifferent(fromRole: Role, toRole: Role): boolean {
    // Quick check: different number of privileges
    if (fromRole.privileges.length !== toRole.privileges.length) {
      return true;
    }

    // Create privilege maps for comparison
    const fromPrivilegeMap = new Map<string, Set<string>>();
    fromRole.privileges.forEach(privilege => {
      const key = privilege.on;
      if (!fromPrivilegeMap.has(key)) {
        fromPrivilegeMap.set(key, new Set());
      }
      privilege.privileges.forEach(p => fromPrivilegeMap.get(key)!.add(p));
    });

    // Check if all target privileges exist in source
    for (const toPrivilege of toRole.privileges) {
      const key = toPrivilege.on;
      // If the target has a model the source doesn't have privileges for
      if (!fromPrivilegeMap.has(key)) {
        return true;
      }

      // Check if privileges for the model are different
      const fromPrivileges = fromPrivilegeMap.get(key)!;
      for (const privilege of toPrivilege.privileges) {
        if (!fromPrivileges.has(privilege)) {
          return true;
        }
      }

      // Check if the source has more privileges for this model than the target
      if (fromPrivileges.size !== toPrivilege.privileges.length) {
        return true;
      }
    }

    // Check if source has privileges on models that target doesn't
    const toPrivilegeModels = new Set(toRole.privileges.map(p => p.on));
    for (const key of fromPrivilegeMap.keys()) {
      if (!toPrivilegeModels.has(key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate migration steps to apply role changes
   * 
   * @param diff Role differences
   * @param schemaName Database schema name
   * @returns Migration steps for role changes
   */
  generateRoleMigrationSteps(diff: RoleDiff, schemaName: string = 'public'): MigrationStep[] {
    const steps: MigrationStep[] = [];
    
    // Add steps for added roles
    diff.added.forEach(role => {
      const roleSql = SQLGenerator.generateCreateRoleSQL(role, schemaName);
      const dropRoleSql = SQLGenerator.generateDropRoleSQL(role, schemaName);
      
      // Create role step
      steps.push({
        type: 'create',
        objectType: 'role',
        name: `${role.name}_create`,
        sql: roleSql[0],
        rollbackSql: dropRoleSql[0]
      });
      
      // Grant privileges steps
      roleSql.slice(1).forEach((sql, index) => {
        steps.push({
          type: 'create',
          objectType: 'role',
          name: `${role.name}_grant_${index}`,
          sql,
          rollbackSql: '' // No specific rollback for grants, dropping the role revokes everything
        });
      });
    });
    
    // Add steps for removed roles
    diff.removed.forEach(role => {
      const dropRoleSql = SQLGenerator.generateDropRoleSQL(role, schemaName);
      const createRoleSql = SQLGenerator.generateCreateRoleSQL(role, schemaName);
      
      steps.push({
        type: 'drop',
        objectType: 'role',
        name: role.name,
        sql: dropRoleSql[0],
        rollbackSql: createRoleSql[0]
      });
      
      // Add grant privilege steps for rollback
      createRoleSql.slice(1).forEach((sql, index) => {
        steps.push({
          type: 'drop',
          objectType: 'role',
          name: `${role.name}_grant_${index}`,
          sql: '', // No SQL needed here since we're dropping the role
          rollbackSql: sql // For rollback, we'll need to re-grant privileges
        });
      });
    });
    
    // Add steps for updated roles
    diff.updated.forEach(({ role, previousRole }) => {
      // For updated roles, we need to drop and recreate the role
      const dropRoleSql = SQLGenerator.generateDropRoleSQL(previousRole, schemaName);
      const createRoleSql = SQLGenerator.generateCreateRoleSQL(role, schemaName);
      const recreateRoleSql = SQLGenerator.generateCreateRoleSQL(previousRole, schemaName);
      
      // Drop the role
      steps.push({
        type: 'alter',
        objectType: 'role',
        name: `${role.name}_drop`,
        sql: dropRoleSql[0],
        rollbackSql: recreateRoleSql[0]
      });
      
      // Recreate with new privileges
      steps.push({
        type: 'alter',
        objectType: 'role',
        name: `${role.name}_recreate`,
        sql: createRoleSql[0],
        rollbackSql: ''
      });
      
      // Grant new privileges
      createRoleSql.slice(1).forEach((sql, index) => {
        steps.push({
          type: 'alter',
          objectType: 'role',
          name: `${role.name}_grant_${index}`,
          sql,
          rollbackSql: ''
        });
      });
      
      // Add rollback steps for re-granting original privileges
      recreateRoleSql.slice(1).forEach((sql, index) => {
        steps.push({
          type: 'alter',
          objectType: 'role',
          name: `${role.name}_rollback_grant_${index}`,
          sql: '',
          rollbackSql: sql
        });
      });
    });
    
    return steps;
  }
} 