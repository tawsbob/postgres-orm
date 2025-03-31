import SchemaParserV1 from '../schemaParser';
import { Schema, Trigger } from '../types';
import path from 'path';
import fs from 'fs';

describe('Trigger Parser Tests', () => {
  describe('Integrated Trigger Parsing', () => {
    let parser: SchemaParserV1;
    let parsedSchema: Schema;
    
    beforeAll(() => {
      parser = new SchemaParserV1();
      // Parse the actual project schema file
      const schemaPath = path.resolve(__dirname, '../../../schema/database.schema');
      parsedSchema = parser.parseSchema(schemaPath);
    });
    
    it('should parse triggers from the actual schema file', () => {
      // Find the User model
      const userModel = parsedSchema.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();
      
      // Check for triggers
      expect(userModel!.triggers).toBeDefined();
      expect(userModel!.triggers!.length).toBeGreaterThan(0);
    });
    
    it('should correctly parse the balance update trigger', () => {
      const userModel = parsedSchema.models.find(m => m.name === 'User');
      const balanceTrigger = userModel!.triggers!.find(t => 
        t.execute.includes('Balance cannot be updated directly')
      );
      
      expect(balanceTrigger).toBeDefined();
      expect(balanceTrigger!.event).toBe('BEFORE UPDATE');
      expect(balanceTrigger!.level).toBe('FOR EACH ROW');
    });
    
    it('should handle all trigger event types correctly', () => {
      // This test ensures the parser can handle various trigger events
      // Here we're testing with the schema's existing trigger
      const userModel = parsedSchema.models.find(m => m.name === 'User');
      const trigger = userModel!.triggers![0];
      
      // The event should be one of the valid TriggerEvent types
      expect(['BEFORE INSERT', 'AFTER INSERT', 'BEFORE UPDATE', 
              'AFTER UPDATE', 'BEFORE DELETE', 'AFTER DELETE'])
        .toContain(trigger.event);
    });
    
    it('should correctly parse multiple triggers on the Product model', () => {
      // Find the Product model
      const productModel = parsedSchema.models.find(m => m.name === 'Product');
      expect(productModel).toBeDefined();
      
      // Check for triggers
      expect(productModel!.triggers).toBeDefined();
      expect(productModel!.triggers!.length).toBe(2);
      
      // Check the stock trigger
      const stockTrigger = productModel!.triggers!.find(t => 
        t.execute.includes('product_inventory_log')
      );
      expect(stockTrigger).toBeDefined();
      expect(stockTrigger!.event).toBe('AFTER UPDATE');
      expect(stockTrigger!.level).toBe('FOR EACH ROW');
      
      // Check the price trigger
      const priceTrigger = productModel!.triggers!.find(t => 
        t.execute.includes('product_price_history')
      );
      expect(priceTrigger).toBeDefined();
      expect(priceTrigger!.event).toBe('BEFORE UPDATE');
      expect(priceTrigger!.level).toBe('FOR EACH ROW');
      
      // Verify complex logic in the price trigger
      expect(priceTrigger!.execute).toContain('Notify admin if price decreased');
      expect(priceTrigger!.execute).toContain('pg_notify');
    });
  });
  
  describe('Trigger Components Parsing', () => {
    it('should parse the trigger event correctly', () => {
      const parser = new SchemaParserV1();
      const triggerText = `@@trigger("BEFORE UPDATE", {
        level: "FOR EACH ROW",
        execute: """
        IF (OLD.balance <> NEW.balance) THEN
          RAISE EXCEPTION 'Balance cannot be updated directly';
        END IF;
        """
      })`;
      
      // @ts-ignore - Accessing private method for testing
      const parsedTrigger = parser['parseTrigger'](triggerText);
      
      expect(parsedTrigger.event).toBe('BEFORE UPDATE');
      expect(parsedTrigger.level).toBe('FOR EACH ROW');
      expect(parsedTrigger.execute).toContain('Balance cannot be updated directly');
    });
    
    it('should handle different trigger events', () => {
      const parser = new SchemaParserV1();
      const triggerEvents = [
        'BEFORE INSERT', 'AFTER INSERT', 
        'BEFORE UPDATE', 'AFTER UPDATE',
        'BEFORE DELETE', 'AFTER DELETE'
      ];
      
      for (const event of triggerEvents) {
        const triggerText = `@@trigger("${event}", {
          level: "FOR EACH ROW",
          execute: """
          -- Test code for ${event}
          """
        })`;
        
        // @ts-ignore - Accessing private method for testing
        const parsedTrigger = parser['parseTrigger'](triggerText);
        expect(parsedTrigger.event).toBe(event);
      }
    });
    
    it('should handle both FOR EACH ROW and FOR EACH STATEMENT levels', () => {
      const parser = new SchemaParserV1();
      const levels = ['FOR EACH ROW', 'FOR EACH STATEMENT'];
      
      for (const level of levels) {
        const triggerText = `@@trigger("AFTER INSERT", {
          level: "${level}",
          execute: """
          -- Test code for ${level}
          """
        })`;
        
        // @ts-ignore - Accessing private method for testing
        const parsedTrigger = parser['parseTrigger'](triggerText);
        expect(parsedTrigger.level).toBe(level);
      }
    });
    
    it('should correctly parse multiline trigger code', () => {
      const parser = new SchemaParserV1();
      const triggerText = `@@trigger("AFTER INSERT", {
        level: "FOR EACH ROW",
        execute: """
        -- First line
        INSERT INTO audit_log(action, table_name, row_id)
        VALUES ('INSERT', 'users', NEW.id);
        
        -- Another action
        INSERT INTO user_history(user_id, action)
        VALUES (NEW.id, 'created');
        """
      })`;
      
      // @ts-ignore - Accessing private method for testing
      const parsedTrigger = parser['parseTrigger'](triggerText);
      
      expect(parsedTrigger.execute).toContain('-- First line');
      expect(parsedTrigger.execute).toContain('INSERT INTO audit_log');
      expect(parsedTrigger.execute).toContain('-- Another action');
      expect(parsedTrigger.execute).toContain('INSERT INTO user_history');
    });
  });
}); 