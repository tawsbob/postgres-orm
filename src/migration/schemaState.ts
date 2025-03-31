import fs from 'fs';
import path from 'path';
import { Schema } from '../parser/types';

export class SchemaStateManager {
  private stateFilePath: string;

  constructor(migrationsDir: string) {
    this.stateFilePath = path.join(migrationsDir, '.schema-state.json');
  }

  /**
   * Save the current schema state after successful migration
   */
  saveSchemaState(schema: Schema): void {
    const stateDir = path.dirname(this.stateFilePath);
    
    // Ensure directory exists
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    fs.writeFileSync(
      this.stateFilePath, 
      JSON.stringify(schema, null, 2)
    );
  }

  /**
   * Get the previously saved schema state
   * Returns null if no state has been saved yet
   */
  getSchemaState(): Schema | null {
    if (!fs.existsSync(this.stateFilePath)) {
      return null;
    }
    
    try {
      const stateData = fs.readFileSync(this.stateFilePath, 'utf-8');
      return JSON.parse(stateData) as Schema;
    } catch (error) {
      console.error('Error reading schema state:', error);
      return null;
    }
  }
} 