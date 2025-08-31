import React, { useState, useEffect } from 'react';
import DataInspector from './DataInspector';
import PivotTables from './PivotTables';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  permissions: {
    projects: boolean;
    pipeline: boolean;
    vacation: boolean;
    program: boolean;
    budget: boolean;
    settings: boolean;
  };
  showTooltips: boolean;
}

interface SettingsProps {
  currentUser?: User;
  data?: any;
}

interface DataFilePaths {
  pFile: string;
  ptFile: string;
  aeFile: string;
  programFile: string;
}

const Settings: React.FC<SettingsProps> = ({ currentUser, data }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [showTooltips, setShowTooltips] = useState(true);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'inspector' | 'pivot'>('general');
  const [dataFilePaths, setDataFilePaths] = useState<DataFilePaths>({
    pFile: './data/P.xlsx',
    ptFile: './data/PT.xlsx',
    aeFile: './data/AE.xlsx',
    programFile: './data/Program_Management.xlsm'
  });
  const [newUser, setNewUser] = useState<Partial<User>>({
    permissions: {
      projects: false,
      pipeline: false,
      vacation: false,
      program: false,
      budget: false,
      settings: false
    },
    showTooltips: true
  });
  
  // Load settings from localStorage
  useEffect(() => {
    // Check if already authenticated today
    const lastAuthDate = localStorage.getItem('lastAuthDate');
    const today = new Date().toDateString();
    if (lastAuthDate === today) {
      setIsAuthenticated(true);
    }
    
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setUsers(settings.users || []);
      setShowTooltips(settings.showTooltips ?? true);
      setHiddenTabs(settings.hiddenTabs || []);
      setDataFilePaths(settings.dataFilePaths || {
        pFile: './data/P.xlsx',
        ptFile: './data/PT.xlsx',
        aeFile: './data/AE.xlsx',
        programFile: './data/Program_Management.xlsm'
      });
    } else {
      // Initialize with default admin
      const defaultAdmin: User = {
        id: '1',
        name: 'Admin',
        email: 'admin@company.com',
        role: 'admin',
        permissions: {
          projects: true,
          pipeline: true,
          vacation: true,
          program: true,
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
      alert('Please fill in all user fields');
      return;
    }

    const user: User = {
      id: Date.now().toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role || 'viewer',
      permissions: newUser.permissions || {
        projects: false,
        pipeline: false,
        vacation: false,
        program: false,
        budget: false,
        settings: false
      },
      showTooltips: newUser.showTooltips ?? true
    };

    setUsers([...users, user]);
    setNewUser({
      permissions: {
        projects: false,
        pipeline: false,
        vacation: false,
        program: false,
        budget: false,
        settings: false
      },
      showTooltips: true
    });
  };

  const updateUserPermission = (userId: string, tab: keyof User['permissions'], value: boolean) => {
    setUsers(users.map(user => {
      if (user.id === userId) {
        return {
          ...user,
          permissions: {
            ...user.permissions,
            [tab]: value
          }
        };
      }
      return user;
    }));
  };

  const deleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  const toggleTabVisibility = (tab: string) => {
    if (hiddenTabs.includes(tab)) {
      setHiddenTabs(hiddenTabs.filter(t => t !== tab));
    } else {
      setHiddenTabs([...hiddenTabs, tab]);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          width: '400px'
        }}>
          <h2 style={{ marginBottom: '24px', color: '#1f2937' }}>Settings Access</h2>
          <p style={{ marginBottom: '20px', color: '#6b7280' }}>
            Enter admin password to access settings
          </p>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              marginBottom: '16px'
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
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px 24px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{
            margin: '0 0 8px 0',
            color: 'white',
            fontSize: '32px',
            fontWeight: '700'
          }}>
            Settings & Access Control
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px', margin: 0 }}>
            Manage users, permissions, and application settings
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '24px',
          borderBottom: '2px solid #e5e7eb',
          backgroundColor: 'white',
          borderRadius: '8px 8px 0 0',
          padding: '10px 10px 0 10px',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setActiveSettingsTab('general')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'general' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'general' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ⚙️ General Settings
            </button>
            <button
              onClick={() => setActiveSettingsTab('inspector')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'inspector' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'inspector' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🔍 Data Inspector
            </button>
            <button
              onClick={() => setActiveSettingsTab('pivot')}
              style={{
                padding: '12px 24px',
                backgroundColor: activeSettingsTab === 'pivot' ? '#3b82f6' : 'transparent',
                color: activeSettingsTab === 'pivot' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📊 Pivot Tables
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                // Force reload by dispatching a custom event
                window.dispatchEvent(new CustomEvent('forceReloadData'));
                alert('Data reload initiated. Please wait for the loading screen to complete.');
              }}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🔄 Force Reload All Data
            </button>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                localStorage.removeItem('lastAuthDate');
                alert('Logged out successfully');
              }}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🔒 Logout
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeSettingsTab === 'general' ? (
          <>
        {/* General Settings */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
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
              {['projects', 'pipeline', 'vacation', 'program', 'budget'].map(tab => (
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

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: '#374151' }}>Documentation</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => window.open('file:///Users/chris/Documents/Code/Tiinos%20magic%20code/2025%2005%20-%20Itteration/stock-visualizer/CALCULATIONS.md', '_blank')}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                📊 View Calculations Documentation
              </button>
              <button
                onClick={() => window.open('file:///Users/chris/Documents/Code/Tiinos%20magic%20code/2025%2005%20-%20Itteration/stock-visualizer/CALCULATION_RULES.md', '_blank')}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                📋 View Calculation Rules
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
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
              Save Settings
            </button>
            <button
              onClick={handlePasswordChange}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Change Password
            </button>
          </div>
        </div>

        {/* Data File Paths Configuration */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Data File Paths</h2>
          <p style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
            Configure the location of your Excel data files
          </p>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                P.xlsx (Projects Master Data)
              </label>
              <input
                type="text"
                value={dataFilePaths.pFile}
                onChange={(e) => setDataFilePaths({ ...dataFilePaths, pFile: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                PT.xlsx (Project Transactions)
              </label>
              <input
                type="text"
                value={dataFilePaths.ptFile}
                onChange={(e) => setDataFilePaths({ ...dataFilePaths, ptFile: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                AE.xlsx (Activities Estimates)
              </label>
              <input
                type="text"
                value={dataFilePaths.aeFile}
                onChange={(e) => setDataFilePaths({ ...dataFilePaths, aeFile: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>
                Program_Management.xlsm
              </label>
              <input
                type="text"
                value={dataFilePaths.programFile}
                onChange={(e) => setDataFilePaths({ ...dataFilePaths, programFile: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>
          
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                setDataFilePaths({
                  pFile: './data/P.xlsx',
                  ptFile: './data/PT.xlsx',
                  aeFile: './data/AE.xlsx',
                  programFile: './data/Program_Management.xlsm'
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
                saveSettings();
                alert('File paths saved! Please reload data in the main dashboard.');
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
          </div>
        </div>

        {/* User Management */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
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
            </div>
            <button
              onClick={addUser}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Add User
            </button>
          </div>

          {/* Users List */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#6b7280' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#6b7280' }}>Email</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#6b7280' }}>Role</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>Projects</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>Pipeline</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>Vacation</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>Program</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>Budget</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>Settings</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{user.name}</td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>{user.email}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: 
                          user.role === 'admin' ? '#dbeafe' : 
                          user.role === 'manager' ? '#fef3c7' : '#f3f4f6',
                        color:
                          user.role === 'admin' ? '#1e40af' :
                          user.role === 'manager' ? '#92400e' : '#374151'
                      }}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    {(['projects', 'pipeline', 'vacation', 'program', 'budget', 'settings'] as const).map(perm => (
                      <td key={perm} style={{ padding: '12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={user.permissions[perm]}
                          onChange={(e) => updateUserPermission(user.id, perm, e.target.checked)}
                          disabled={user.role === 'admin'}
                          style={{ cursor: user.role === 'admin' ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => deleteUser(user.id)}
                        disabled={user.role === 'admin'}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: user.role === 'admin' ? '#e5e7eb' : '#ef4444',
                          color: user.role === 'admin' ? '#9ca3af' : 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: user.role === 'admin' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        ) : activeSettingsTab === 'inspector' ? (
          <DataInspector data={data} />
        ) : (
          <PivotTables data={data} />
        )}
      </div>
    </div>
  );
};

export default Settings;