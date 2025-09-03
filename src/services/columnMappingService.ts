// Column Mapping Service
// Handles saving and loading of user-defined column mappings

import { columnMappings } from '../config/dataSourceMapping';

interface ColumnMappings {
  [fileName: string]: {
    [column: string]: string;
  };
}

const STORAGE_KEY = 'columnMappings';

export class ColumnMappingService {
  static getColumnMappings(): ColumnMappings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all files are present
        return {
          ...columnMappings,
          ...parsed
        };
      }
    } catch (error) {
      console.error('Error loading column mappings:', error);
    }
    return columnMappings;
  }

  static saveColumnMappings(mappings: ColumnMappings): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('columnMappingsUpdated', {
        detail: mappings
      }));
      
      console.log('Column mappings saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving column mappings:', error);
      return false;
    }
  }

  static resetToDefaults(): ColumnMappings {
    try {
      localStorage.removeItem(STORAGE_KEY);
      
      // Dispatch reset event
      window.dispatchEvent(new CustomEvent('columnMappingsReset', {
        detail: columnMappings
      }));
      
      console.log('Column mappings reset to defaults');
      return columnMappings;
    } catch (error) {
      console.error('Error resetting column mappings:', error);
      return columnMappings;
    }
  }

  static updateMapping(fileName: string, column: string, mapping: string): ColumnMappings {
    const current = this.getColumnMappings();
    const updated = {
      ...current,
      [fileName]: {
        ...current[fileName],
        [column]: mapping
      }
    };
    
    this.saveColumnMappings(updated);
    return updated;
  }

  static validateMapping(fileName: string, column: string): boolean {
    // Basic validation - check if column letter is valid
    const columnPattern = /^[A-Z]+$/;
    return columnPattern.test(column);
  }

  static exportMappings(): string {
    const mappings = this.getColumnMappings();
    return JSON.stringify(mappings, null, 2);
  }

  static importMappings(jsonString: string): boolean {
    try {
      const mappings = JSON.parse(jsonString);
      
      // Basic validation
      if (typeof mappings !== 'object' || mappings === null) {
        throw new Error('Invalid mapping format');
      }
      
      this.saveColumnMappings(mappings);
      return true;
    } catch (error) {
      console.error('Error importing column mappings:', error);
      return false;
    }
  }
}

// Global getter function for use in other components
export const getCurrentColumnMappings = (): ColumnMappings => {
  return ColumnMappingService.getColumnMappings();
};