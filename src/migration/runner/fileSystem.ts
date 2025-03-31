import fs from 'fs/promises';
import path from 'path';
import { Migration } from '../types';

export interface MigrationFile {
  filePath: string;
  version: string;
  name: string;
  content: Migration;
}

export class MigrationFileSystem {
  private migrationsDir: string;

  constructor(migrationsDir: string) {
    this.migrationsDir = migrationsDir;
  }

  async ensureMigrationsDir(): Promise<void> {
    try {
      await fs.mkdir(this.migrationsDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private isMigrationFile(fileName: string): boolean {
    return fileName.endsWith('.json') && /^\d+_/.test(fileName);
  }

  private parseVersionFromFileName(fileName: string): {
    version: string;
    name: string;
  } {
    const match = fileName.match(/^(\d+)_(.+)\.json$/);
    if (!match) {
      throw new Error(`Invalid migration file name: ${fileName}`);
    }
    return {
      version: match[1],
      name: match[2],
    };
  }

  async loadMigrationFiles(): Promise<MigrationFile[]> {
    await this.ensureMigrationsDir();
    
    const fileNames = await fs.readdir(this.migrationsDir);
    const migrationFileNames = fileNames.filter(this.isMigrationFile);
    
    const migrationFiles: MigrationFile[] = [];
    
    for (const fileName of migrationFileNames) {
      const filePath = path.join(this.migrationsDir, fileName);
      const { version, name } = this.parseVersionFromFileName(fileName);
      
      try {
        const content = JSON.parse(await fs.readFile(filePath, 'utf8')) as Migration;
        migrationFiles.push({
          filePath,
          version,
          name,
          content,
        });
      } catch (error) {
        console.error(`Error loading migration file ${fileName}:`, error);
        throw new Error(`Failed to load migration file: ${fileName}`);
      }
    }
    
    return migrationFiles.sort((a, b) => 
      parseInt(a.version) - parseInt(b.version)
    );
  }
} 