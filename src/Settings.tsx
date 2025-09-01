import React, { useState, useEffect } from 'react';
import DataInspector from './DataInspector';
import PivotTables from './PivotTables';
import SystemDiagnostics from './components/SystemDiagnostics';
import { open } from '@tauri-apps/plugin-dialog';
import { DEFAULT_PATHS, normalizePath } from './config/paths';

// Access global data cache
declare global {
  interface Window {
    getGlobalDataCache?: () => any;
  }
}

// Make dialog available globally for testing
if (typeof window !== 'undefined') {
  (window as any).testDialog = open;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  permissions: {
    projects: boolean;
    budget: boolean;
    settings: boolean;
  };
}

interface DataFilePaths {
  pFile: string;
  ptFile: string;
  aeFile: string;
  programFile: string;
}

const Settings: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showTooltips, setShowTooltips] = useState(true);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [dataFilePaths, setDataFilePaths] = useState<DataFilePaths>({
    pFile: normalizePath(DEFAULT_PATHS.pFile),
    ptFile: normalizePath(DEFAULT_PATHS.ptFile),
    aeFile: normalizePath(DEFAULT_PATHS.aeFile),
    programFile: normalizePath(DEFAULT_PATHS.programFile)
  });
  
  // Tab navigation
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'files' | 'users' | 'inspector' | 'pivot' | 'diagnostics'>('general');
  
  // Loading progress for files
  const [loadingProgress, setLoadingProgress] = useState({
    pFile: 0,
    ptFile: 0,
    aeFile: 0,
    programFile: 0
  });
  const [loadedFiles, setLoadedFiles] = useState({
    pFile: false,
    ptFile: false,
    aeFile: false,
    programFile: false
  });
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [globalData, setGlobalData] = useState<any>(null);
  
  // Try to get cached data on mount
  useEffect(() => {
    // Check if data is already available on mount
    if (window.getGlobalDataCache) {
      const cachedData = window.getGlobalDataCache();
      if (cachedData) {
        console.log('Found cached data on mount:', {
          hasData: !!cachedData,
          hasPT: !!cachedData?.pt,
          hasAE: !!cachedData?.ae
        });
        setGlobalData(cachedData);
      }
    }
  }, []);
  
  // Listen for loading progress updates
  useEffect(() => {
    const handleLoadingProgress = (event: CustomEvent) => {
      setLoadingProgress(event.detail.progress);
      setIsLoadingFiles(event.detail.isLoading);
      
      // Update loaded files status
      if (event.detail.progress) {
        setLoadedFiles({
          pFile: event.detail.progress.pFile === 100,
          ptFile: event.detail.progress.ptFile === 100,
          aeFile: event.detail.progress.aeFile === 100,
          programFile: event.detail.progress.programFile === 100
        });
      }
      
      // When loading completes, try to get the data
      if (!event.detail.isLoading && window.getGlobalDataCache) {
        setGlobalData(window.getGlobalDataCache());
      }
    };
    
    window.addEventListener('dataLoadingProgress', handleLoadingProgress as EventListener);
    
    return () => {
      window.removeEventListener('dataLoadingProgress', handleLoadingProgress as EventListener);
    };
  }, []);
  
  // Get global data when inspector or pivot tabs are selected
  useEffect(() => {
    if ((activeSettingsTab === 'inspector' || activeSettingsTab === 'pivot')) {
      console.log('Tab changed to:', activeSettingsTab);
      console.log('window.getGlobalDataCache exists?', !!window.getGlobalDataCache);
      
      if (window.getGlobalDataCache) {
        const data = window.getGlobalDataCache();
        console.log('Global data retrieved:', {
          hasData: !!data,
          hasPData: !!data?.p,
          hasPTData: !!data?.pt,
          hasAEData: !!data?.ae,
          hasProgramData: !!data?.program,
          ptRows: data?.pt?.rows?.length || 0,
          aeRows: data?.ae?.rows?.length || 0
        });
        setGlobalData(data);
      } else {
        console.warn('getGlobalDataCache not available, trying to dispatch reload event');
        // Try to trigger a data reload
        window.dispatchEvent(new CustomEvent('forceReloadData'));
        // Try again after a delay
        setTimeout(() => {
          if (window.getGlobalDataCache) {
            const data = window.getGlobalDataCache();
            console.log('Global data retrieved after delay:', data);
            setGlobalData(data);
          }
        }, 1000);
      }
    }
  }, [activeSettingsTab]);
  
  // Load settings from localStorage
  useEffect(() => {
    // Check if already authenticated today
    const lastAuthDate = localStorage.getItem('lastAuthDate');
    const today = new Date().toDateString();
    if (lastAuthDate === today) {
      setIsAuthenticated(true);
    }
    
    // Load saved file paths from localStorage first
    const savedPaths = localStorage.getItem('dataFilePaths');
    if (savedPaths) {
      try {
        setDataFilePaths(JSON.parse(savedPaths));
      } catch (e) {
        console.error('Error loading saved paths:', e);
      }
    }
    
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setUsers(settings.users || []);
      setShowTooltips(settings.showTooltips ?? true);
      setHiddenTabs(settings.hiddenTabs || []);
      // Only use settings paths if no localStorage paths exist
      if (!savedPaths && settings.dataFilePaths) {
        setDataFilePaths(settings.dataFilePaths);
      }
    } else {
      // Initialize with default admin
      const defaultAdmin: User = {
        id: '1',
        name: 'Admin',
        email: 'admin@example.com',
        role: 'admin',
        permissions: {
          projects: true,
          budget: true,
          settings: true
        },
        showTooltips: true
      };
      setUsers([defaultAdmin]);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      users,
      showTooltips,
      hiddenTabs,
      dataFilePaths,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('appSettings', JSON.stringify(settings));
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('settingsUpdated', { 
      detail: { showTooltips, hiddenTabs, users, dataFilePaths } 
    }));
  };

  const handleLogin = () => {
    // Simple password check - in production, this should be server-validated
    const correctPassword = localStorage.getItem('adminPassword') || 'admin123';
    if (password === correctPassword) {
      setIsAuthenticated(true);
      setPassword('');
      // Save authentication for today
      const today = new Date().toDateString();
      localStorage.setItem('lastAuthDate', today);
    } else {
      alert('Incorrect password. Default is: admin123');
    }
  };

  const handlePasswordChange = () => {
    const newPassword = prompt('Enter new password:');
    const confirmPassword = prompt('Confirm new password:');
    
    if (newPassword && newPassword === confirmPassword) {
      localStorage.setItem('adminPassword', newPassword);
      alert('Password updated successfully');
    } else {
      alert('Passwords do not match');
    }
  };

  const addUser = () => {
    if (!newUser.name || !newUser.email) {
      alert('Please enter name and email');
      return;
    }
    
    const user: User = {
      id: Date.now().toString(),
      name: newUser.name || '',
      email: newUser.email || '',
      role: newUser.role || 'viewer',
      permissions: {
        projects: newUser.role === 'admin' || newUser.role === 'manager',
        budget: newUser.role === 'admin' || newUser.role === 'manager',
        settings: newUser.role === 'admin'
      }
    };
    
    setUsers([...users, user]);
    setNewUser({});
  };

  const deleteUser = (id: string) => {
    if (users.length === 1) {
      alert('Cannot delete the last user');
      return;
    }
    setUsers(users.filter(u => u.id !== id));
  };

  const toggleTabVisibility = (tab: string) => {
    if (hiddenTabs.includes(tab)) {
      setHiddenTabs(hiddenTabs.filter(t => t !== tab));
    } else {
      setHiddenTabs([...hiddenTabs, tab]);
    }
  };

  const handleBrowseFile = (fileType: keyof DataFilePaths) => {
    console.log('Browse button clicked for:', fileType);
    const extensions = fileType === 'programFile' ? ['xlsm', 'xlsx', 'xls'] : ['xlsx', 'xls'];
    console.log('About to open dialog with extensions:', extensions);
    
    open({
      multiple: false,
      filters: [{
        name: 'Excel Files',
        extensions
      }]
    }).then(selected => {
      console.log('Dialog promise resolved with:', selected);
      if (selected && typeof selected === 'string') {
        setDataFilePaths(prev => {
          const newPaths = {
            ...prev,
            [fileType]: selected
          };
          console.log('Updating paths to:', newPaths);
          localStorage.setItem('dataFilePaths', JSON.stringify(newPaths));
          return newPaths;
        });
      }
    }).catch(error => {
      console.error('Dialog promise rejected:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      alert(`Error: ${error}`);
    });
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          width: '400px'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
            🔒 Settings Access Required
          </h2>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              marginBottom: '20px'
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Login
          </button>
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666', fontSize: '14px' }}>
            Default password: admin123
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: '#f3f4f6',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header with tabs */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px 16px 0 0',
          padding: '20px',
          marginBottom: '0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setActiveSettingsTab('general')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'general' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'general' ? 'white' : '#e0e7ff',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ⚙️ General
            </button>
            <button
              onClick={() => setActiveSettingsTab('files')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'files' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'files' ? 'white' : '#e0e7ff',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📁 File Paths
            </button>
            <button
              onClick={() => setActiveSettingsTab('users')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'users' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'users' ? 'white' : '#e0e7ff',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              👥 Users
            </button>
            <button
              onClick={() => setActiveSettingsTab('inspector')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'inspector' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'inspector' ? 'white' : '#e0e7ff',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🔍 Inspector
            </button>
            <button
              onClick={() => setActiveSettingsTab('pivot')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'pivot' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'pivot' ? 'white' : '#e0e7ff',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📊 Pivot
            </button>
            <button
              onClick={() => setActiveSettingsTab('diagnostics')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'diagnostics' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'diagnostics' ? 'white' : '#e0e7ff',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🔧 Diagnostics
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                console.log('Force Reload button clicked');
                const event = new CustomEvent('forceReloadData');
                window.dispatchEvent(event);
                console.log('forceReloadData event dispatched');
                alert('Data reload initiated. Please wait...');
              }}
              style={{
                padding: '10px 20px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🔄 Force Reload Data
            </button>
            <button
              onClick={handlePasswordChange}
              style={{
                padding: '10px 20px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🔐 Change Password
            </button>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                localStorage.removeItem('lastAuthDate');
              }}
              style={{
                padding: '10px 20px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🔒 Logout
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeSettingsTab === 'general' && (
          <div style={{
            background: 'white',
            borderRadius: '0 0 16px 16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>General Settings</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={showTooltips}
                  onChange={(e) => setShowTooltips(e.target.checked)}
                  style={{ width: '20px', height: '20px' }}
                />
                <span style={{ fontSize: '16px', color: '#374151' }}>
                  Show calculation explanation tooltips
                </span>
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '12px', color: '#374151' }}>Tab Visibility</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {['projects', 'pipeline', 'vacation', 'program', 'budget', 'map', 'alerts', 'hours', 'revenue'].map(tab => (
                  <label key={tab} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: hiddenTabs.includes(tab) ? '#fee2e2' : '#f0fdf4',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={!hiddenTabs.includes(tab)}
                      onChange={() => toggleTabVisibility(tab)}
                    />
                    <span style={{ textTransform: 'capitalize' }}>{tab}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={saveSettings}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              💾 Save Settings
            </button>
          </div>
        )}

        {activeSettingsTab === 'files' && (
          <div style={{
            background: 'white',
            borderRadius: '0 0 16px 16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Data File Paths</h2>
            <p style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
              Configure the location of your Excel data files. Click Browse to select files from any location.
            </p>
            <div style={{ marginBottom: '20px', padding: '10px', background: '#f3f4f6', borderRadius: '8px' }}>
              <p style={{ fontSize: '12px', marginBottom: '8px' }}>Debug: Test if dialog works</p>
              <button
                type="button"
                onClick={() => {
                  console.log('Direct test clicked');
                  if (typeof open === 'function') {
                    console.log('open is a function');
                    open({ multiple: false }).then(r => console.log('Direct result:', r)).catch(e => console.log('Direct error:', e));
                  } else {
                    console.log('open is NOT a function, it is:', typeof open, open);
                  }
                }}
                style={{ padding: '5px 10px', marginRight: '10px' }}
              >
                Direct Test
              </button>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                Open console (F12) and click to test
              </span>
            </div>
            
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* P.xlsx */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                  P.xlsx (Projects Master Data)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={dataFilePaths.pFile}
                    onChange={(e) => setDataFilePaths({ ...dataFilePaths, pFile: e.target.value })}
                    placeholder="Select or enter path to P.xlsx"
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log('P.xlsx browse clicked');
                      handleBrowseFile('pFile');
                    }}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📁 Browse
                  </button>
                  {loadedFiles.pFile && (
                    <span style={{
                      fontSize: '24px',
                      color: '#22c55e',
                      marginLeft: '8px'
                    }}>✓</span>
                  )}
                </div>
                {isLoadingFiles && loadingProgress.pFile > 0 && loadingProgress.pFile < 100 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading P.xlsx...</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{Math.round(loadingProgress.pFile)}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${loadingProgress.pFile}%`,
                        height: '100%',
                        backgroundColor: loadingProgress.pFile === 100 ? '#22c55e' : '#3b82f6',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
              </div>
              
              {/* PT.xlsx */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                  PT.xlsx (Project Transactions)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={dataFilePaths.ptFile}
                    onChange={(e) => setDataFilePaths({ ...dataFilePaths, ptFile: e.target.value })}
                    placeholder="Select or enter path to PT.xlsx"
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log('PT.xlsx browse clicked');
                      handleBrowseFile('ptFile');
                    }}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📁 Browse
                  </button>
                  {loadedFiles.ptFile && (
                    <span style={{
                      fontSize: '24px',
                      color: '#22c55e',
                      marginLeft: '8px'
                    }}>✓</span>
                  )}
                </div>
                {isLoadingFiles && loadingProgress.ptFile > 0 && loadingProgress.ptFile < 100 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading PT.xlsx...</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{Math.round(loadingProgress.ptFile)}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${loadingProgress.ptFile}%`,
                        height: '100%',
                        backgroundColor: loadingProgress.ptFile === 100 ? '#22c55e' : '#3b82f6',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
              </div>
              
              {/* AE.xlsx */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                  AE.xlsx (Activities Estimates)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={dataFilePaths.aeFile}
                    onChange={(e) => setDataFilePaths({ ...dataFilePaths, aeFile: e.target.value })}
                    placeholder="Select or enter path to AE.xlsx"
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log('AE.xlsx browse clicked');
                      handleBrowseFile('aeFile');
                    }}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📁 Browse
                  </button>
                  {loadedFiles.aeFile && (
                    <span style={{
                      fontSize: '24px',
                      color: '#22c55e',
                      marginLeft: '8px'
                    }}>✓</span>
                  )}
                </div>
                {isLoadingFiles && loadingProgress.aeFile > 0 && loadingProgress.aeFile < 100 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading AE.xlsx...</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{Math.round(loadingProgress.aeFile)}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${loadingProgress.aeFile}%`,
                        height: '100%',
                        backgroundColor: loadingProgress.aeFile === 100 ? '#22c55e' : '#3b82f6',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Program_Management.xlsm */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                  Program_Management.xlsm
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={dataFilePaths.programFile}
                    onChange={(e) => setDataFilePaths({ ...dataFilePaths, programFile: e.target.value })}
                    placeholder="Select or enter path to Program_Management.xlsm"
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Program_Management.xlsm browse clicked');
                      handleBrowseFile('programFile');
                    }}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📁 Browse
                  </button>
                  {loadedFiles.programFile && (
                    <span style={{
                      fontSize: '24px',
                      color: '#22c55e',
                      marginLeft: '8px'
                    }}>✓</span>
                  )}
                </div>
                {isLoadingFiles && loadingProgress.programFile > 0 && loadingProgress.programFile < 100 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading Program_Management.xlsm...</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{Math.round(loadingProgress.programFile)}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${loadingProgress.programFile}%`,
                        height: '100%',
                        backgroundColor: loadingProgress.programFile === 100 ? '#22c55e' : '#3b82f6',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ marginTop: '30px', display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  console.log('Test Dialog button clicked');
                  open({
                    multiple: false,
                    filters: [{
                      name: 'All Files',
                      extensions: ['*']
                    }]
                  }).then(result => {
                    console.log('Test dialog succeeded:', result);
                    alert(`Success: ${result}`);
                  }).catch(err => {
                    console.error('Test dialog failed:', err);
                    alert(`Failed: ${err}`);
                  });
                }}
                style={{
                  padding: '10px 20px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                🧪 Test Dialog
              </button>
              <button
                onClick={() => {
                  setDataFilePaths({
                    pFile: '/Users/chris/Documents/Code/Program Management/data/P.xlsx',
                    ptFile: '/Users/chris/Documents/Code/Program Management/data/PT.xlsx',
                    aeFile: '/Users/chris/Documents/Code/Program Management/data/AE.xlsx',
                    programFile: '/Users/chris/Documents/Code/Program Management/data/Program_Management.xlsm'
                  });
                }}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                🔄 Reset to Default Paths
              </button>
              <button
                onClick={() => {
                  console.log('Saving paths:', dataFilePaths);
                  // Save to localStorage in both places for compatibility
                  localStorage.setItem('dataFilePaths', JSON.stringify(dataFilePaths));
                  
                  // Also save in appSettings
                  const settings = {
                    users,
                    showTooltips,
                    hiddenTabs,
                    dataFilePaths,
                    lastUpdated: new Date().toISOString()
                  };
                  localStorage.setItem('appSettings', JSON.stringify(settings));
                  
                  // Dispatch event to notify other components
                  window.dispatchEvent(new CustomEvent('settingsUpdated', { 
                    detail: { showTooltips, hiddenTabs, users, dataFilePaths } 
                  }));
                  
                  alert('File paths saved!');
                  console.log('Paths saved successfully');
                }}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                💾 Save File Paths
              </button>
              <button
                type="button"
                onClick={() => {
                  console.log('Load Data button clicked');
                  console.log('Current paths:', dataFilePaths);
                  
                  // Save paths before loading
                  localStorage.setItem('dataFilePaths', JSON.stringify(dataFilePaths));
                  
                  // Also save in appSettings
                  const settings = {
                    users,
                    showTooltips,
                    hiddenTabs,
                    dataFilePaths,
                    lastUpdated: new Date().toISOString()
                  };
                  localStorage.setItem('appSettings', JSON.stringify(settings));
                  
                  // Dispatch force reload event
                  window.dispatchEvent(new CustomEvent('forceReloadData'));
                  console.log('Force reload event dispatched');
                  
                  // After data loads, refresh the pivot table data
                  setTimeout(() => {
                    if (window.getGlobalDataCache) {
                      const freshData = window.getGlobalDataCache();
                      console.log('Refreshing pivot table data after load:', {
                        hasData: !!freshData,
                        ptRows: freshData?.pt?.rows?.length || 0,
                        aeRows: freshData?.ae?.rows?.length || 0
                      });
                      setGlobalData(freshData);
                    }
                  }, 5000); // Wait for data to load
                  
                  // Don't show alert, the progress bar will show instead
                }}
                disabled={!dataFilePaths.pFile || !dataFilePaths.ptFile || !dataFilePaths.aeFile || !dataFilePaths.programFile}
                style={{
                  padding: '10px 20px',
                  background: (dataFilePaths.pFile && dataFilePaths.ptFile && dataFilePaths.aeFile && dataFilePaths.programFile) 
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : '#e5e7eb',
                  color: (dataFilePaths.pFile && dataFilePaths.ptFile && dataFilePaths.aeFile && dataFilePaths.programFile)
                    ? 'white' 
                    : '#9ca3af',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: (dataFilePaths.pFile && dataFilePaths.ptFile && dataFilePaths.aeFile && dataFilePaths.programFile)
                    ? 'pointer'
                    : 'not-allowed'
                }}
              >
                🚀 Load Data
              </button>
            </div>
          </div>
        )}

        {activeSettingsTab === 'users' && (
          <div style={{
            background: 'white',
            borderRadius: '0 0 16px 16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>User Management</h2>
            
            {/* Add New User */}
            <div style={{
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              marginBottom: '24px'
            }}>
              <h3 style={{ marginBottom: '16px', color: '#374151' }}>Add New User</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={newUser.name || ''}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email || ''}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                <select
                  value={newUser.role || 'viewer'}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User['role'] })}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={addUser}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  ➕ Add User
                </button>
              </div>
            </div>
            
            {/* User List */}
            <div>
              <h3 style={{ marginBottom: '16px', color: '#374151' }}>Current Users</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {users.map(user => (
                  <div
                    key={user.id}
                    style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, color: '#1f2937' }}>{user.name}</h4>
                      <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '14px' }}>{user.email}</p>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        backgroundColor: user.role === 'admin' ? '#dc2626' : user.role === 'manager' ? '#f59e0b' : '#10b981',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        marginTop: '4px'
                      }}>
                        {user.role.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteUser(user.id)}
                      style={{
                        padding: '8px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveSettings}
              style={{
                marginTop: '20px',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              💾 Save Users
            </button>
          </div>
        )}

        {activeSettingsTab === 'inspector' && (
          <div style={{
            background: 'white',
            borderRadius: '0 0 16px 16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <DataInspector data={globalData} />
          </div>
        )}

        {activeSettingsTab === 'pivot' && (
          <div style={{
            background: 'white',
            borderRadius: '0 0 16px 16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => {
                  console.log('Refreshing pivot table data');
                  if (window.getGlobalDataCache) {
                    const freshData = window.getGlobalDataCache();
                    console.log('Fresh data for pivot:', {
                      hasData: !!freshData,
                      keys: freshData ? Object.keys(freshData) : [],
                      ptRows: freshData?.pt?.rows?.length || 0,
                      aeRows: freshData?.ae?.rows?.length || 0
                    });
                    setGlobalData(freshData);
                    if (!freshData || !freshData.pt) {
                      alert('No data loaded. Please go to File Paths tab and click Load Data first.');
                    }
                  } else {
                    alert('Data not available. Please load data from File Paths tab first.');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                🔄 Refresh Pivot Data
              </button>
              {!globalData && (
                <span style={{ marginLeft: '12px', color: '#ef4444', fontSize: '14px' }}>
                  ⚠️ No data loaded - please load data from File Paths tab
                </span>
              )}
              {globalData && globalData.pt && (
                <span style={{ marginLeft: '12px', color: '#22c55e', fontSize: '14px' }}>
                  ✓ Data loaded: {globalData.pt.rows?.length || 0} PT rows, {globalData.ae?.rows?.length || 0} AE rows
                </span>
              )}
            </div>
            <PivotTables data={globalData} />
          </div>
        )}

        {activeSettingsTab === 'diagnostics' && (
          <div style={{
            background: 'white',
            borderRadius: '0 0 16px 16px',
            padding: '0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <SystemDiagnostics />
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;