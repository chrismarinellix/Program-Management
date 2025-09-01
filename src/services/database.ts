import Database from '@tauri-apps/plugin-sql';
import { getDatabaseName } from '../config/database';

let db: Database | null = null;
let initPromise: Promise<void> | null = null;

// Database initialization with singleton pattern
export async function initDatabase(): Promise<void> {
  // If already initialized, return immediately
  if (db) {
    console.log('Database already initialized');
    return;
  }
  
  // If initialization is in progress, wait for it
  if (initPromise) {
    console.log('Database initialization already in progress, waiting...');
    return initPromise;
  }
  
  // Start new initialization
  initPromise = (async () => {
    try {
      console.log('Initializing SQLite database...');
      db = await Database.load(getDatabaseName());
      
      // Run migrations
      await runMigrations();
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      db = null; // Reset on failure
      initPromise = null; // Allow retry
      throw error;
    }
  })();
  
  return initPromise;
}

// Helper to ensure database is ready
export async function ensureDatabase(): Promise<Database> {
  if (!db) {
    await initDatabase();
  }
  if (!db) {
    throw new Error('Database initialization failed');
  }
  return db;
}

// Run database migrations
async function runMigrations(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  
  // Create notes table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      tags TEXT
    )
  `);
  
  // Create kanban_cards table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kanban_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      column_id TEXT NOT NULL DEFAULT 'backlog',
      project_id TEXT,
      activity_id TEXT,
      assignee TEXT,
      priority INTEGER DEFAULT 3,
      due_date DATE,
      estimated_hours REAL,
      actual_hours REAL,
      tags TEXT,
      checklist TEXT,
      attachments TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      is_archived BOOLEAN DEFAULT 0
    )
  `);
  
  // Create kanban_columns table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kanban_columns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      color TEXT,
      wip_limit INTEGER,
      is_active BOOLEAN DEFAULT 1
    )
  `);
  
  // Insert default kanban columns if they don't exist
  await db.execute(`
    INSERT OR IGNORE INTO kanban_columns (id, name, position, color) VALUES
    ('backlog', 'Backlog', 0, '#6b7280'),
    ('todo', 'To Do', 1, '#3b82f6'),
    ('in_progress', 'In Progress', 2, '#f59e0b'),
    ('review', 'Review', 3, '#8b5cf6'),
    ('done', 'Done', 4, '#10b981')
  `);
  
  // Create audit_log table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      user TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      changes TEXT,
      ip_address TEXT,
      user_agent TEXT
    )
  `);
  
  // Create pivot cache tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pivot_cache (
      id TEXT PRIMARY KEY,
      pivot_type TEXT NOT NULL,
      data TEXT NOT NULL,
      row_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      source_files TEXT,
      checksum TEXT
    )
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pivot_refresh_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pivot_type TEXT NOT NULL,
      refreshed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      refreshed_by TEXT,
      source_files TEXT,
      row_count INTEGER,
      status TEXT,
      error_message TEXT
    )
  `);
  
  // Create indexes for performance
  await db.execute('CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_kanban_status ON kanban_cards(status, position)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_kanban_project ON kanban_cards(project_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC)');
}

// Notes operations
export interface Note {
  id?: number;
  entity_type: string;
  entity_id: string;
  content: string;
  author?: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
}

export async function addNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const db = await ensureDatabase();
  
  const result = await db.execute(
    `INSERT INTO notes (entity_type, entity_id, content, author, tags) 
     VALUES (?, ?, ?, ?, ?)`,
    [
      note.entity_type,
      note.entity_id,
      note.content,
      note.author || null,
      note.tags ? JSON.stringify(note.tags) : null
    ]
  );
  
  // Log to audit
  await logAudit('create', 'note', result.lastInsertId!.toString(), note.author || 'Unknown');
  
  return result.lastInsertId as number;
}

export async function getNotes(entityType: string, entityId: string): Promise<Note[]> {
  const db = await ensureDatabase();
  
  const notes = await db.select<Note[]>(
    `SELECT * FROM notes 
     WHERE entity_type = ? AND entity_id = ? AND is_deleted = 0 
     ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  
  // Parse tags JSON
  return notes.map(note => ({
    ...note,
    tags: note.tags ? JSON.parse(note.tags as string) : []
  }));
}

export async function updateNote(id: number, content: string, author?: string): Promise<void> {
  const db = await ensureDatabase();
  
  await db.execute(
    `UPDATE notes 
     SET content = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [content, id]
  );
  
  await logAudit('update', 'note', id.toString(), author || 'Unknown');
}

export async function deleteNote(id: number, author?: string): Promise<void> {
  const db = await ensureDatabase();
  
  // Soft delete
  await db.execute(
    `UPDATE notes 
     SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [id]
  );
  
  await logAudit('delete', 'note', id.toString(), author || 'Unknown');
}

// Kanban operations
export interface KanbanCard {
  id?: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  column_id: string;
  project_id?: string;
  activity_id?: string;
  assignee?: string;
  priority?: number;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  tags?: string[];
  checklist?: Array<{text: string; completed: boolean}>;
  position: number;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  is_archived?: boolean;
}

export async function createKanbanCard(card: Omit<KanbanCard, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const db = await ensureDatabase();
  
  const result = await db.execute(
    `INSERT INTO kanban_cards 
     (title, description, status, column_id, project_id, activity_id, assignee, 
      priority, due_date, estimated_hours, tags, checklist, position) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      card.title,
      card.description || null,
      card.status,
      card.column_id,
      card.project_id || null,
      card.activity_id || null,
      card.assignee || null,
      card.priority || 3,
      card.due_date || null,
      card.estimated_hours || null,
      card.tags ? JSON.stringify(card.tags) : null,
      card.checklist ? JSON.stringify(card.checklist) : null,
      card.position
    ]
  );
  
  await logAudit('create', 'kanban_card', result.lastInsertId!.toString(), card.assignee || 'Unknown');
  
  return result.lastInsertId as number;
}

export async function getKanbanCards(projectId?: string): Promise<KanbanCard[]> {
  const db = await ensureDatabase();
  
  let query = `SELECT * FROM kanban_cards WHERE is_archived = 0`;
  let params = [];
  
  if (projectId) {
    query += ` AND project_id = ?`;
    params.push(projectId);
  }
  
  query += ` ORDER BY position ASC`;
  
  const cards = await db.select<KanbanCard[]>(query, params);
  
  // Parse JSON fields
  return cards.map(card => ({
    ...card,
    tags: card.tags ? JSON.parse(card.tags as string) : [],
    checklist: card.checklist ? JSON.parse(card.checklist as string) : []
  }));
}

export async function updateKanbanCard(id: number, updates: Partial<KanbanCard>): Promise<void> {
  const db = await ensureDatabase();
  
  const fields = [];
  const values = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'tags' || key === 'checklist') {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }
  });
  
  if (fields.length === 0) return;
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  await db.execute(
    `UPDATE kanban_cards SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  
  await logAudit('update', 'kanban_card', id.toString(), updates.assignee || 'Unknown');
}

export async function moveKanbanCard(cardId: number, newColumnId: string, newPosition: number): Promise<void> {
  const db = await ensureDatabase();
  
  await db.execute(
    `UPDATE kanban_cards 
     SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [newColumnId, newPosition, cardId]
  );
  
  // Update completed_at if moving to done column
  if (newColumnId === 'done') {
    await db.execute(
      `UPDATE kanban_cards 
       SET completed_at = CURRENT_TIMESTAMP, status = 'done' 
       WHERE id = ?`,
      [cardId]
    );
  }
  
  await logAudit('move', 'kanban_card', cardId.toString(), 'System');
}

export async function archiveKanbanCard(id: number): Promise<void> {
  const db = await ensureDatabase();
  
  await db.execute(
    `UPDATE kanban_cards 
     SET is_archived = 1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [id]
  );
  
  await logAudit('archive', 'kanban_card', id.toString(), 'Unknown');
}

// Audit logging
async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  user: string,
  changes?: any
): Promise<void> {
  try {
    const db = await ensureDatabase();
  
  try {
    await db.execute(
      `INSERT INTO audit_log (action, entity_type, entity_id, user, changes) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        action,
        entityType,
        entityId,
        user,
        changes ? JSON.stringify(changes) : null
      ]
    );
  } catch (error) {
    console.error('Audit log failed:', error);
  }
  } catch (error) {
    // Don't fail if audit logging fails
    console.error('Audit log failed:', error);
  }
}

// Search operations
export async function searchNotes(searchTerm: string): Promise<Note[]> {
  const db = await ensureDatabase();
  
  const notes = await db.select<Note[]>(
    `SELECT * FROM notes 
     WHERE is_deleted = 0 AND content LIKE ? 
     ORDER BY created_at DESC 
     LIMIT 100`,
    [`%${searchTerm}%`]
  );
  
  return notes.map(note => ({
    ...note,
    tags: note.tags ? JSON.parse(note.tags as string) : []
  }));
}

export async function getRecentNotes(limit: number = 10): Promise<Note[]> {
  const db = await ensureDatabase();
  
  const notes = await db.select<Note[]>(
    `SELECT * FROM notes 
     WHERE is_deleted = 0 
     ORDER BY created_at DESC 
     LIMIT ?`,
    [limit]
  );
  
  return notes.map(note => ({
    ...note,
    tags: note.tags ? JSON.parse(note.tags as string) : []
  }));
}

// Statistics
export async function getDatabaseStats(): Promise<{
  totalNotes: number;
  totalCards: number;
  activeCards: number;
  completedCards: number;
}> {
  const db = await ensureDatabase();
  
  const [notesCount] = await db.select<[{count: number}]>(
    'SELECT COUNT(*) as count FROM notes WHERE is_deleted = 0'
  );
  
  const [cardsCount] = await db.select<[{count: number}]>(
    'SELECT COUNT(*) as count FROM kanban_cards WHERE is_archived = 0'
  );
  
  const [activeCount] = await db.select<[{count: number}]>(
    `SELECT COUNT(*) as count FROM kanban_cards 
     WHERE is_archived = 0 AND status != 'done'`
  );
  
  const [completedCount] = await db.select<[{count: number}]>(
    `SELECT COUNT(*) as count FROM kanban_cards 
     WHERE is_archived = 0 AND status = 'done'`
  );
  
  return {
    totalNotes: notesCount.count,
    totalCards: cardsCount.count,
    activeCards: activeCount.count,
    completedCards: completedCount.count
  };
}

// Export/Import for backup
export async function exportDatabase(): Promise<any> {
  const db = await ensureDatabase();
  
  const notes = await db.select('SELECT * FROM notes');
  const cards = await db.select('SELECT * FROM kanban_cards');
  const columns = await db.select('SELECT * FROM kanban_columns');
  const audit = await db.select('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 1000');
  
  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    data: {
      notes,
      cards,
      columns,
      audit
    }
  };
}

// Pivot cache operations
export interface PivotCache {
  id: string;
  pivot_type: string;
  data: any;
  row_count: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  source_files?: string;
}

export async function saveDataCache(
  cacheType: string,
  data: any,
  sourceFiles?: string[]
): Promise<void> {
  try {
    const db = await ensureDatabase();
    
    // Validate data before saving
    if (!data) {
      console.warn(`Cannot save null/undefined data to cache ${cacheType}`);
      return;
    }
    
    const id = `${cacheType}_${new Date().toISOString().split('T')[0]}`;
    const jsonData = JSON.stringify(data);
    const rowCount = Array.isArray(data) ? data.length : 
                     (data?.rows ? data.rows.length : 1);
    
    // Calculate expiry (1 week from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.execute(`
      INSERT OR REPLACE INTO pivot_cache 
      (id, pivot_type, data, row_count, updated_at, expires_at, source_files)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `, [
      id,
      cacheType,
      jsonData,
      rowCount,
      expiresAt.toISOString(),
      sourceFiles ? JSON.stringify(sourceFiles) : null
    ]);
    
    // Log the refresh
    await db.execute(`
      INSERT INTO pivot_refresh_log 
      (pivot_type, refreshed_by, source_files, row_count, status)
      VALUES (?, ?, ?, ?, ?)
    `, [
      cacheType,
      'System',
      sourceFiles ? JSON.stringify(sourceFiles) : null,
      rowCount,
      'success'
    ]);
    
    console.log(`Data cache saved: ${cacheType} with ${rowCount} rows`);
  } catch (error) {
    console.error(`Failed to save data cache ${cacheType}:`, error);
    // Log failure
    try {
      const db = await ensureDatabase();
      await db.execute(`
        INSERT INTO pivot_refresh_log 
        (pivot_type, refreshed_by, status, error_message)
        VALUES (?, ?, ?, ?)
      `, [
        cacheType,
        'System',
        'failed',
        error instanceof Error ? error.message : String(error)
      ]);
    } catch (logError) {
      console.error('Failed to log cache save error:', logError);
    }
    throw error; // Re-throw to allow caller to handle
  }
}

// Keep backward compatibility
export async function savePivotCache(
  pivotType: string,
  data: any,
  sourceFiles?: string[]
): Promise<void> {
  return saveDataCache(pivotType, data, sourceFiles);
}

export async function loadDataCache(
  cacheType: string
): Promise<any | null> {
  try {
    const db = await ensureDatabase();
    
    const results = await db.select<PivotCache[]>(`
      SELECT * FROM pivot_cache 
      WHERE pivot_type = ? 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY updated_at DESC
      LIMIT 1
    `, [cacheType]);
    
    if (results && results.length > 0) {
      const cache = results[0];
      
      // Validate cache data
      try {
        const data = JSON.parse(cache.data);
        
        // Basic validation - check if data has expected structure
        if (!data || (Array.isArray(data) && data.length === 0)) {
          console.warn(`Cache ${cacheType} is empty, will reload from source`);
          return null;
        }
        
        // Check cache age (warn if older than 24 hours)
        const cacheAge = Date.now() - new Date(cache.updated_at).getTime();
        const hoursOld = cacheAge / (1000 * 60 * 60);
        if (hoursOld > 24) {
          console.warn(`Cache ${cacheType} is ${hoursOld.toFixed(1)} hours old`);
        }
        
        console.log(`Loaded data cache: ${cacheType} (${cache.row_count} rows, updated ${cache.updated_at})`);
        return data;
      } catch (parseError) {
        console.error(`Failed to parse cache ${cacheType}:`, parseError);
        // Delete corrupted cache entry
        await db.execute('DELETE FROM pivot_cache WHERE id = ?', [cache.id]);
        return null;
      }
    }
  } catch (error) {
    console.error(`Failed to load data cache ${cacheType}:`, error);
    // Return null to allow fallback to Excel loading
  }
  
  return null;
}

// Keep backward compatibility
export async function loadPivotCache(
  pivotType: string
): Promise<any | null> {
  return loadDataCache(pivotType);
}

export async function getPivotCacheInfo(): Promise<{
  lastRefresh: string | null;
  cacheSize: number;
  isExpired: boolean;
  nextRefreshDue: string | null;
}> {
  const db = await ensureDatabase();
  
  try {
    // Get most recent refresh
    const [lastRefresh] = await db.select<[{refreshed_at: string}]>(`
      SELECT refreshed_at FROM pivot_refresh_log 
      WHERE status = 'success'
      ORDER BY refreshed_at DESC 
      LIMIT 1
    `);
    
    // Get cache info
    const [cacheInfo] = await db.select<[{count: number, oldest_expires: string}]>(`
      SELECT COUNT(*) as count, MIN(expires_at) as oldest_expires
      FROM pivot_cache
      WHERE expires_at > datetime('now')
    `);
    
    return {
      lastRefresh: lastRefresh?.refreshed_at || null,
      cacheSize: cacheInfo?.count || 0,
      isExpired: !cacheInfo || cacheInfo.count === 0,
      nextRefreshDue: cacheInfo?.oldest_expires || null
    };
  } catch (error) {
    console.error('Failed to get pivot cache info:', error);
    return {
      lastRefresh: null,
      cacheSize: 0,
      isExpired: true,
      nextRefreshDue: null
    };
  }
}

export async function clearPivotCache(pivotType?: string): Promise<void> {
  const db = await ensureDatabase();
  
  if (pivotType) {
    await db.execute('DELETE FROM pivot_cache WHERE pivot_type = ?', [pivotType]);
    console.log(`Cleared pivot cache for: ${pivotType}`);
  } else {
    await db.execute('DELETE FROM pivot_cache');
    console.log('Cleared all pivot caches');
  }
}

// Clear all data caches (for force reload)
export async function clearDataCache(): Promise<void> {
  try {
    const db = await ensureDatabase();
    await db.execute('DELETE FROM pivot_cache');
    console.log('Cleared all data caches from database');
  } catch (error) {
    console.error('Failed to clear data cache:', error);
  }
}

export async function getLastPivotRefresh(pivotType: string): Promise<Date | null> {
  const db = await ensureDatabase();
  
  const [result] = await db.select<[{refreshed_at: string}]>(`
    SELECT refreshed_at FROM pivot_refresh_log
    WHERE pivot_type = ? AND status = 'success'
    ORDER BY refreshed_at DESC
    LIMIT 1
  `, [pivotType]);
  
  return result ? new Date(result.refreshed_at) : null;
}

export default {
  initDatabase,
  ensureDatabase,
  addNote,
  getNotes,
  updateNote,
  deleteNote,
  createKanbanCard,
  getKanbanCards,
  updateKanbanCard,
  moveKanbanCard,
  archiveKanbanCard,
  searchNotes,
  getRecentNotes,
  getDatabaseStats,
  exportDatabase,
  // Cache functions
  saveDataCache,
  loadDataCache,
  savePivotCache,
  loadPivotCache,
  getPivotCacheInfo,
  clearPivotCache,
  clearDataCache,
  getLastPivotRefresh
};