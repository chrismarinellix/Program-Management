// Database Configuration
// Centralizes database settings to prevent inconsistencies

export const DATABASE_CONFIG = {
  // Main database file name
  name: 'sqlite:program_management.db',
  
  // Required tables that should exist after initialization
  requiredTables: [
    'notes',
    'kanban_cards', 
    'kanban_columns',
    'audit_log',
    'pivot_cache',
    'pivot_refresh_log'
  ],
  
  // Cache settings
  cache: {
    defaultExpiryDays: 7,
    maxCacheSize: 100 // MB
  },
  
  // Migration version (for future schema updates)
  version: 1
};

// Helper function to get the database name
export function getDatabaseName(): string {
  return DATABASE_CONFIG.name;
}

// Helper function to get required tables
export function getRequiredTables(): string[] {
  return [...DATABASE_CONFIG.requiredTables];
}

// Helper function to check if all required tables exist
export function validateTableList(existingTables: string[]): {
  isValid: boolean;
  missing: string[];
  total: number;
} {
  const required = getRequiredTables();
  const missing = required.filter(table => !existingTables.includes(table));
  
  return {
    isValid: missing.length === 0,
    missing,
    total: required.length
  };
}