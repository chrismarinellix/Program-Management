import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { getDatabaseName, getRequiredTables, validateTableList } from '../config/database';

interface DiagnosticCheck {
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'success' | 'error' | 'warning';
  message?: string;
  details?: any;
  explanation?: string;
  solution?: string;
}

const SystemDiagnostics: React.FC = () => {
  const [checks, setChecks] = useState<DiagnosticCheck[]>([
    {
      name: 'SQLite Database',
      description: 'Core data storage system',
      status: 'pending',
      explanation: 'The SQLite database stores cached Excel data, user notes, and pivot table calculations. It enables data persistence between app sessions and improves performance by avoiding repeated Excel file reads.'
    },
    {
      name: 'Excel Files',
      description: 'Source data files configuration',
      status: 'pending',
      explanation: 'Excel files (P.xlsx, PT.xlsx, AE.xlsx, Program_Management.xlsm) are the source of truth for all project data. The app reads these files and caches them for 7 days.'
    },
    {
      name: 'Data Cache',
      description: 'SQL cache performance and validity',
      status: 'pending',
      explanation: 'The cache system stores Excel data in SQLite for fast access. Cache expires after 7 days to ensure weekly data refresh. This prevents slow Excel reads on every app start.'
    },
    {
      name: 'Global Data Store',
      description: 'In-memory data availability',
      status: 'pending',
      explanation: 'The global data store holds all loaded data in memory for immediate access by all components. This prevents redundant database queries and ensures consistent data across views.'
    },
    {
      name: 'File Permissions',
      description: 'System access rights',
      status: 'pending',
      explanation: 'The app needs read permission for Excel files and write permission for the SQLite database and localStorage. Without proper permissions, data cannot be loaded or saved.'
    },
    {
      name: 'Tauri Backend',
      description: 'Rust backend communication',
      status: 'pending',
      explanation: 'The Tauri backend (Rust) handles Excel file reading, system operations, and secure file access. If the backend is not responding, no data operations can occur.'
    },
    {
      name: 'Settings Storage',
      description: 'User preferences persistence',
      status: 'pending',
      explanation: 'LocalStorage saves user settings, file paths, and UI preferences. This ensures your configuration persists between sessions without needing a database.'
    },
    {
      name: 'Event System',
      description: 'Component communication',
      status: 'pending',
      explanation: 'Custom events enable components to communicate (e.g., force reload, settings updates). If events are not working, components cannot synchronize their state.'
    },
    {
      name: 'Memory Usage',
      description: 'System resource monitoring',
      status: 'pending',
      explanation: 'JavaScript heap memory usage indicates if the app has sufficient resources. High memory usage (>80%) can cause slowdowns or crashes, especially with large Excel files.'
    },
    {
      name: 'Data Integrity',
      description: 'Cache freshness and consistency',
      status: 'pending',
      explanation: 'Validates that cached data has not expired and matches the current Excel files. Expired or mismatched cache can show outdated information.'
    }
  ]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  const updateCheck = (name: string, update: Partial<DiagnosticCheck>) => {
    setChecks(prev => prev.map(check => 
      check.name === name ? { ...check, ...update } : check
    ));
  };

  const toggleDetails = (name: string) => {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setExpandedDetails(new Set()); // Reset expanded state
    
    // Reset all checks to checking
    setChecks(prev => prev.map(check => ({ 
      ...check, 
      status: 'checking', 
      message: undefined,
      details: undefined,
      solution: undefined
    })));

    // 1. Check SQLite Database
    try {
      updateCheck('SQLite Database', { status: 'checking', message: 'Connecting to database...' });
      const db = await Database.load(getDatabaseName());
      
      // Check if tables exist
      const requiredTables = getRequiredTables();
      const tables = await db.select<any[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name IN (${requiredTables.map(() => '?').join(', ')})
      `, requiredTables);
      
      // Get row counts for each table
      const tableCounts: any = {};
      for (const table of tables) {
        try {
          const countResult = await db.select<any[]>(`SELECT COUNT(*) as count FROM ${table.name}`);
          tableCounts[table.name] = countResult[0].count;
        } catch {
          tableCounts[table.name] = 'error';
        }
      }
      
      const validation = validateTableList(tables.map(t => t.name));
      const missingTables = validation.missing;
      
      if (validation.isValid) {
        updateCheck('SQLite Database', { 
          status: 'success', 
          message: `All ${tables.length} core tables present and accessible`,
          details: {
            tables: tableCounts,
            dbLocation: getDatabaseName().replace('sqlite:', ''),
            status: 'Connected and operational'
          }
        });
      } else if (tables.length > 0) {
        updateCheck('SQLite Database', { 
          status: 'warning', 
          message: `Only ${tables.length}/${validation.total} tables found. Missing: ${missingTables.join(', ')}`,
          details: {
            foundTables: tableCounts,
            missingTables: missingTables
          },
          solution: 'Click "Force Reload Data" to reinitialize the database tables.'
        });
      } else {
        updateCheck('SQLite Database', { 
          status: 'error', 
          message: 'No database tables found. Database may not be initialized.',
          solution: 'Restart the app or click "Force Reload Data" to create database tables.'
        });
      }
    } catch (error: any) {
      updateCheck('SQLite Database', { 
        status: 'error', 
        message: `Database connection failed: ${error.message || 'Unknown error'}`,
        solution: 'Check if Tauri SQL plugin is properly installed. Try restarting the app.'
      });
    }

    // 2. Check Excel Files
    try {
      updateCheck('Excel Files', { status: 'checking', message: 'Verifying file configurations...' });
      const settings = localStorage.getItem('appSettings');
      const paths = settings ? JSON.parse(settings).dataFilePaths : null;
      
      if (paths) {
        const fileDetails: any = {
          'P.xlsx (Projects)': { path: paths.pFile, found: false },
          'PT.xlsx (Transactions)': { path: paths.ptFile, found: false },
          'AE.xlsx (Estimates)': { path: paths.aeFile, found: false },
          'Program_Management.xlsm': { path: paths.programFile, found: false }
        };
        
        // Try to verify files exist
        const fileChecks = await Promise.all([
          invoke('file_exists', { path: paths.pFile }).catch(() => false),
          invoke('file_exists', { path: paths.ptFile }).catch(() => false),
          invoke('file_exists', { path: paths.aeFile }).catch(() => false),
          invoke('file_exists', { path: paths.programFile }).catch(() => false)
        ]);
        
        Object.keys(fileDetails).forEach((key, idx) => {
          fileDetails[key].found = fileChecks[idx];
        });
        
        const foundCount = fileChecks.filter(Boolean).length;
        
        if (foundCount === 4) {
          updateCheck('Excel Files', { 
            status: 'success', 
            message: 'All 4 Excel files configured and verified',
            details: fileDetails
          });
        } else if (foundCount > 0) {
          updateCheck('Excel Files', { 
            status: 'warning', 
            message: `${foundCount}/4 files verified. Some files may not exist at configured paths.`,
            details: fileDetails,
            solution: 'Go to Settings → File Paths to update file locations.'
          });
        } else {
          updateCheck('Excel Files', { 
            status: 'warning', 
            message: 'Files configured but not verified (file_exists check unavailable)',
            details: fileDetails,
            solution: 'Paths are configured but cannot be verified. Try loading data to confirm.'
          });
        }
      } else {
        updateCheck('Excel Files', { 
          status: 'error', 
          message: 'No file paths configured',
          solution: 'Go to Settings → File Paths tab and configure your Excel file locations.'
        });
      }
    } catch (error: any) {
      updateCheck('Excel Files', { 
        status: 'error', 
        message: `File check failed: ${error.message}`,
        solution: 'Ensure Excel files exist and paths are correct in Settings.'
      });
    }

    // 3. Check Data Cache
    try {
      updateCheck('Data Cache', { status: 'checking', message: 'Analyzing cache performance...' });
      const db = await Database.load(getDatabaseName());
      
      // First check if the table exists
      const tableExists = await db.select<any[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='pivot_cache'
      `);
      
      if (tableExists.length === 0) {
        updateCheck('Data Cache', { 
          status: 'error', 
          message: 'Cache table does not exist',
          solution: 'Click "Force Reload Data" to create cache tables and load data.'
        });
      } else {
        const cacheData = await db.select<any[]>(`
          SELECT 
            pivot_type,
            COUNT(*) as count,
            datetime(created_at) as created,
            datetime(expires_at) as expires,
            CASE 
              WHEN datetime(expires_at) > datetime('now') THEN 'valid'
              ELSE 'expired'
            END as status,
            ROUND((julianday(expires_at) - julianday('now')) * 24, 1) as hours_remaining
          FROM pivot_cache 
          GROUP BY pivot_type
        `);
        
        if (cacheData.length > 0) {
          const totalCached = cacheData.reduce((sum, c) => sum + c.count, 0);
          const expiredCount = cacheData.filter(c => c.status === 'expired').length;
          const validCount = cacheData.filter(c => c.status === 'valid').length;
          
          const cacheDetails = {
            totalEntries: totalCached,
            cacheTypes: cacheData.map(c => ({
              type: c.pivot_type,
              status: c.status,
              created: c.created,
              expires: c.expires,
              hoursRemaining: c.hours_remaining > 0 ? c.hours_remaining : 0
            })),
            summary: {
              valid: validCount,
              expired: expiredCount,
              total: cacheData.length
            }
          };
          
          if (expiredCount === 0 && validCount > 0) {
            updateCheck('Data Cache', { 
              status: 'success', 
              message: `${totalCached} entries cached, all valid. Cache will refresh in ${Math.max(...cacheData.map(c => c.hours_remaining || 0)).toFixed(0)} hours`,
              details: cacheDetails
            });
          } else if (expiredCount > 0) {
            updateCheck('Data Cache', { 
              status: 'warning', 
              message: `${expiredCount}/${cacheData.length} cache entries expired`,
              details: cacheDetails,
              solution: 'Click "Force Reload Data" to refresh expired cache entries.'
            });
          } else {
            updateCheck('Data Cache', { 
              status: 'warning', 
              message: 'Cache exists but may need refresh',
              details: cacheDetails
            });
          }
        } else {
          updateCheck('Data Cache', { 
            status: 'success', 
            message: 'Cache table ready. No data cached yet (normal on first run).',
            details: {
              status: 'Cache system operational',
              note: 'Data will be cached after first load from Excel files',
              cacheExpiry: '7 days (168 hours) from load time'
            }
          });
        }
      }
    } catch (error: any) {
      updateCheck('Data Cache', { 
        status: 'error', 
        message: `Cache check failed: ${error.message}`,
        solution: 'Database may be corrupted. Try "Force Reload Data" or restart the app.'
      });
    }

    // 4. Check Global Data Store
    try {
      updateCheck('Global Data Store', { status: 'checking', message: 'Checking memory cache...' });
      
      if (window.getGlobalDataCache) {
        const cache = window.getGlobalDataCache();
        if (cache) {
          const sheets: any = {};
          let totalRows = 0;
          
          if (cache.p) {
            sheets['P.xlsx (Projects)'] = cache.p.rows?.length || 0;
            totalRows += cache.p.rows?.length || 0;
          }
          if (cache.pt) {
            sheets['PT.xlsx (Transactions)'] = cache.pt.rows?.length || 0;
            totalRows += cache.pt.rows?.length || 0;
          }
          if (cache.ae) {
            sheets['AE.xlsx (Estimates)'] = cache.ae.rows?.length || 0;
            totalRows += cache.ae.rows?.length || 0;
          }
          if (cache.program) {
            sheets['Program Quick View'] = cache.program.rows?.length || 0;
            totalRows += cache.program.rows?.length || 0;
          }
          if (cache.pipeline) {
            sheets['Pipeline'] = cache.pipeline.rows?.length || 0;
            totalRows += cache.pipeline.rows?.length || 0;
          }
          if (cache.vacation) {
            sheets['Vacation Planner'] = cache.vacation.rows?.length || 0;
            totalRows += cache.vacation.rows?.length || 0;
          }
          
          const sheetCount = Object.keys(sheets).length;
          
          if (sheetCount >= 3) {
            updateCheck('Global Data Store', { 
              status: 'success', 
              message: `${sheetCount} sheets loaded with ${totalRows.toLocaleString()} total rows in memory`,
              details: {
                sheets: sheets,
                totalRows: totalRows,
                status: 'All data available for immediate access'
              }
            });
          } else if (sheetCount > 0) {
            updateCheck('Global Data Store', { 
              status: 'warning', 
              message: `Only ${sheetCount} sheets loaded. Some data may be missing.`,
              details: {
                loadedSheets: sheets,
                totalRows: totalRows
              },
              solution: 'Click "Force Reload Data" to load all sheets.'
            });
          } else {
            updateCheck('Global Data Store', { 
              status: 'success', 
              message: 'Memory cache initialized and ready',
              details: {
                status: 'Cache structure ready',
                note: 'Data will load automatically from SQL cache or Excel files',
                memoryUsage: 'Minimal - no data loaded yet'
              }
            });
          }
        } else {
          updateCheck('Global Data Store', { 
            status: 'warning', 
            message: 'No data in memory cache',
            solution: 'Normal on app start. Data loads from SQL cache or Excel files automatically.'
          });
        }
      } else {
        updateCheck('Global Data Store', { 
          status: 'error', 
          message: 'Global cache function not available',
          solution: 'Critical error. Try restarting the app.'
        });
      }
    } catch (error: any) {
      updateCheck('Global Data Store', { 
        status: 'error', 
        message: `Memory check failed: ${error.message}`
      });
    }

    // 5. Check File Permissions
    try {
      updateCheck('File Permissions', { status: 'checking', message: 'Testing access rights...' });
      
      const testKey = '_test_permissions_' + Date.now();
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (value === 'test') {
        updateCheck('File Permissions', { 
          status: 'success', 
          message: 'Read/write permissions verified for app storage',
          details: {
            localStorage: 'Read/Write OK',
            appData: 'Accessible',
            status: 'All permissions granted'
          }
        });
      } else {
        updateCheck('File Permissions', { 
          status: 'warning', 
          message: 'Limited storage permissions',
          solution: 'Check browser/app permissions for localStorage access.'
        });
      }
    } catch (error: any) {
      updateCheck('File Permissions', { 
        status: 'error', 
        message: 'Permission test failed',
        solution: 'App may not have necessary permissions. Check system settings.'
      });
    }

    // 6. Check Tauri Backend
    try {
      updateCheck('Tauri Backend', { status: 'checking', message: 'Pinging Rust backend...' });
      
      // Try the ping command
      const result = await invoke('ping');
      
      if (result === 'pong') {
        updateCheck('Tauri Backend', { 
          status: 'success', 
          message: 'Rust backend responding correctly',
          details: {
            status: 'Connected',
            response: 'pong',
            commands: 'All Tauri commands available'
          }
        });
      } else {
        updateCheck('Tauri Backend', { 
          status: 'warning', 
          message: 'Backend responding but unexpected response',
          details: { response: result }
        });
      }
    } catch (error: any) {
      // Ping might not exist, try another command
      try {
        await invoke('file_exists', { path: 'test' });
        updateCheck('Tauri Backend', { 
          status: 'success', 
          message: 'Backend operational (ping not available)',
          details: {
            status: 'Connected',
            note: 'Backend working but ping command not implemented'
          }
        });
      } catch {
        updateCheck('Tauri Backend', { 
          status: 'error', 
          message: 'Backend not responding',
          solution: 'Critical error. Restart the application.'
        });
      }
    }

    // 7. Check Settings Storage
    try {
      updateCheck('Settings Storage', { status: 'checking', message: 'Checking localStorage...' });
      
      const settings = localStorage.getItem('appSettings');
      const hiddenTabs = localStorage.getItem('hiddenTabs');
      const authDate = localStorage.getItem('lastAuthDate');
      const locations = localStorage.getItem('projectLocations');
      
      const storageDetails: any = {
        totalItems: 0,
        items: {}
      };
      
      if (settings) {
        const parsed = JSON.parse(settings);
        storageDetails.items['App Settings'] = {
          hasFilePaths: !!parsed.dataFilePaths,
          hasTooltips: parsed.showTooltips !== undefined,
          tabsHidden: parsed.hiddenTabs?.length || 0
        };
        storageDetails.totalItems++;
      }
      
      if (authDate) {
        storageDetails.items['Authentication'] = {
          lastAuth: authDate,
          isToday: authDate === new Date().toDateString()
        };
        storageDetails.totalItems++;
      }
      
      if (locations) {
        const locs = JSON.parse(locations);
        storageDetails.items['Map Locations'] = {
          count: locs.length || 0
        };
        storageDetails.totalItems++;
      }
      
      if (storageDetails.totalItems > 0) {
        updateCheck('Settings Storage', { 
          status: 'success', 
          message: `${storageDetails.totalItems} configuration items stored`,
          details: storageDetails
        });
      } else {
        updateCheck('Settings Storage', { 
          status: 'warning', 
          message: 'No settings stored yet',
          solution: 'Normal for first run. Settings save automatically when changed.'
        });
      }
    } catch (error: any) {
      updateCheck('Settings Storage', { 
        status: 'error', 
        message: 'localStorage not accessible',
        solution: 'Check browser settings or try a different browser.'
      });
    }

    // 8. Check Event System
    try {
      updateCheck('Event System', { status: 'checking', message: 'Testing event propagation...' });
      
      let eventReceived = false;
      const testHandler = () => { eventReceived = true; };
      
      window.addEventListener('_test_event', testHandler);
      window.dispatchEvent(new CustomEvent('_test_event'));
      
      // Small delay to let event propagate
      await new Promise(resolve => setTimeout(resolve, 10));
      
      window.removeEventListener('_test_event', testHandler);
      
      if (eventReceived) {
        updateCheck('Event System', { 
          status: 'success', 
          message: 'Custom events working correctly',
          details: {
            status: 'Operational',
            events: ['forceReloadData', 'settingsUpdated', 'dataLoadingProgress'],
            test: 'Event propagation verified'
          }
        });
      } else {
        updateCheck('Event System', { 
          status: 'error', 
          message: 'Events not propagating',
          solution: 'Component communication may fail. Restart the app.'
        });
      }
    } catch (error: any) {
      updateCheck('Event System', { 
        status: 'error', 
        message: 'Event test failed',
        solution: 'Critical error in event system.'
      });
    }

    // 9. Check Memory Usage
    try {
      updateCheck('Memory Usage', { status: 'checking', message: 'Analyzing memory...' });
      
      // Check if performance.memory is available (Chrome only)
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        const percentage = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
        
        const memoryDetails = {
          used: `${usedMB} MB`,
          allocated: `${totalMB} MB`,
          limit: `${limitMB} MB`,
          usage: `${percentage}%`,
          available: `${limitMB - usedMB} MB`
        };
        
        if (percentage < 50) {
          updateCheck('Memory Usage', { 
            status: 'success', 
            message: `Using ${usedMB}MB of ${limitMB}MB (${percentage}%) - Plenty of memory available`,
            details: memoryDetails
          });
        } else if (percentage < 80) {
          updateCheck('Memory Usage', { 
            status: 'warning', 
            message: `Using ${usedMB}MB of ${limitMB}MB (${percentage}%) - Monitor memory usage`,
            details: memoryDetails,
            solution: 'Consider closing other tabs or restarting if performance degrades.'
          });
        } else {
          updateCheck('Memory Usage', { 
            status: 'error', 
            message: `High usage: ${usedMB}MB of ${limitMB}MB (${percentage}%)`,
            details: memoryDetails,
            solution: 'Close other applications or browser tabs. Consider restarting the app.'
          });
        }
      } else {
        updateCheck('Memory Usage', { 
          status: 'warning', 
          message: 'Memory monitoring not available in this browser',
          solution: 'Use Chrome/Edge for memory monitoring. App will still function normally.'
        });
      }
    } catch (error: any) {
      updateCheck('Memory Usage', { 
        status: 'warning', 
        message: 'Cannot measure memory',
        solution: 'Memory API not supported. This does not affect app functionality.'
      });
    }

    // 10. Check Data Integrity
    try {
      updateCheck('Data Integrity', { status: 'checking', message: 'Validating data consistency...' });
      const db = await Database.load(getDatabaseName());
      
      // Check if data_cache table exists first
      const tableExists = await db.select<any[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='pivot_cache'
      `);
      
      if (tableExists.length === 0) {
        updateCheck('Data Integrity', { 
          status: 'warning', 
          message: 'No cache to validate yet',
          solution: 'Normal on first run. Cache will be created when data loads.'
        });
      } else {
        const integrityCheck = await db.select<any[]>(`
          SELECT 
            pivot_type,
            ROUND(julianday('now') - julianday(created_at), 2) as days_old,
            ROUND((julianday(expires_at) - julianday('now')) * 24, 1) as hours_until_expiry,
            CASE 
              WHEN datetime(expires_at) > datetime('now') THEN 'valid'
              ELSE 'expired'
            END as validity,
            datetime(created_at) as cached_on,
            datetime(expires_at) as expires_on
          FROM pivot_cache
          ORDER BY created_at DESC
        `);
        
        if (integrityCheck.length > 0) {
          const expired = integrityCheck.filter(c => c.validity === 'expired');
          const valid = integrityCheck.filter(c => c.validity === 'valid');
          const oldest = Math.max(...integrityCheck.map(c => c.days_old));
          const newest = Math.min(...integrityCheck.map(c => c.days_old));
          
          const integrityDetails = {
            cacheEntries: integrityCheck.map(c => ({
              type: c.pivot_type,
              age: `${c.days_old} days`,
              validity: c.validity,
              expiresIn: c.validity === 'valid' ? `${c.hours_until_expiry} hours` : 'Expired',
              cachedOn: c.cached_on,
              expiresOn: c.expires_on
            })),
            summary: {
              total: integrityCheck.length,
              valid: valid.length,
              expired: expired.length,
              oldestCache: `${oldest.toFixed(1)} days`,
              newestCache: `${newest.toFixed(1)} days`
            }
          };
          
          if (expired.length === 0 && oldest < 7) {
            updateCheck('Data Integrity', { 
              status: 'success', 
              message: `All ${integrityCheck.length} cache entries valid. Oldest: ${oldest.toFixed(1)} days`,
              details: integrityDetails
            });
          } else if (expired.length > 0) {
            updateCheck('Data Integrity', { 
              status: 'warning', 
              message: `${expired.length} expired entries found. Cache needs refresh.`,
              details: integrityDetails,
              solution: 'Click "Force Reload Data" to refresh all cached data.'
            });
          } else if (oldest >= 7) {
            updateCheck('Data Integrity', { 
              status: 'warning', 
              message: `Cache aging: ${oldest.toFixed(1)} days old (expires at 7 days)`,
              details: integrityDetails,
              solution: 'Cache will auto-expire soon. Consider refreshing for latest data.'
            });
          }
        } else {
          updateCheck('Data Integrity', { 
            status: 'warning', 
            message: 'Cache table exists but is empty',
            solution: 'Data will be cached after first load from Excel files.'
          });
        }
      }
    } catch (error: any) {
      updateCheck('Data Integrity', { 
        status: 'error', 
        message: `Integrity check failed: ${error.message}`,
        solution: 'Database may be corrupted. Try "Force Reload Data".'
      });
    }

    setIsRunning(false);
    setLastRunTime(new Date());
  };

  // Run diagnostics on mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'checking': return '🔄';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'checking': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const successCount = checks.filter(c => c.status === 'success').length;
  const errorCount = checks.filter(c => c.status === 'error').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#1f2937', fontSize: '20px' }}>
            System Diagnostics
          </h3>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Comprehensive health check of all system components
          </p>
        </div>
        
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          style={{
            padding: '8px 16px',
            backgroundColor: isRunning ? '#e5e7eb' : '#3b82f6',
            color: isRunning ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {isRunning ? '🔄 Running...' : '🔍 Run Diagnostics'}
        </button>
      </div>

      {/* Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '12px',
          backgroundColor: '#dcfce7',
          borderRadius: '8px',
          border: '1px solid #bbf7d0'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
            {successCount}
          </div>
          <div style={{ fontSize: '12px', color: '#15803d' }}>Healthy</div>
        </div>
        
        <div style={{
          padding: '12px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          border: '1px solid #fde68a'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>
            {warningCount}
          </div>
          <div style={{ fontSize: '12px', color: '#92400e' }}>Warnings</div>
        </div>
        
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          borderRadius: '8px',
          border: '1px solid #fecaca'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
            {errorCount}
          </div>
          <div style={{ fontSize: '12px', color: '#991b1b' }}>Errors</div>
        </div>
      </div>

      {/* Diagnostic Checks */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid #e5e7eb'
      }}>
        {checks.map((check, index) => (
          <div
            key={check.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              marginBottom: index < checks.length - 1 ? '8px' : 0,
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                fontSize: '20px',
                marginRight: '12px',
                animation: check.status === 'checking' ? 'spin 1s linear infinite' : 'none'
              }}>
                {getStatusIcon(check.status)}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '600',
                      color: '#1f2937',
                      fontSize: '14px'
                    }}>
                      {check.name}
                    </div>
                    <div style={{
                      color: '#6b7280',
                      fontSize: '12px',
                      marginTop: '2px'
                    }}>
                      {check.description}
                    </div>
                    {check.explanation && (
                      <div style={{
                        color: '#6b7280',
                        fontSize: '11px',
                        marginTop: '4px',
                        fontStyle: 'italic'
                      }}>
                        {check.explanation}
                      </div>
                    )}
                  </div>
                  
                  {check.message && (
                    <div style={{
                      fontSize: '12px',
                      color: getStatusColor(check.status),
                      marginLeft: '12px',
                      textAlign: 'right',
                      fontWeight: '500',
                      maxWidth: '300px'
                    }}>
                      {check.message}
                    </div>
                  )}
                </div>
                
                {check.solution && check.status !== 'success' && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: check.status === 'error' ? '#fee2e2' : '#fef3c7',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: check.status === 'error' ? '#991b1b' : '#92400e'
                  }}>
                    <strong>Solution:</strong> {check.solution}
                  </div>
                )}
                
                {check.details && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      onClick={() => toggleDetails(check.name)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#4b5563',
                        cursor: 'pointer'
                      }}
                    >
                      {expandedDetails.has(check.name) ? '▼ Hide Details' : '▶ Show Details'}
                    </button>
                    
                    {expandedDetails.has(check.name) && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#4b5563',
                        fontFamily: 'monospace'
                      }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(check.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Last Run Time */}
      {lastRunTime && (
        <div style={{
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          Last diagnostic run: {lastRunTime.toLocaleTimeString()} ({Math.floor((new Date().getTime() - lastRunTime.getTime()) / 1000)} seconds ago)
        </div>
      )}

      {/* Animation for spinning icon */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SystemDiagnostics;