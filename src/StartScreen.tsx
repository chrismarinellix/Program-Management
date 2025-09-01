import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

interface StartScreenProps {
  onLoadData: (paths: DataFilePaths) => void;
}

interface DataFilePaths {
  pFile: string;
  ptFile: string;
  aeFile: string;
  programFile: string;
}

const StartScreen: React.FC<StartScreenProps> = ({ onLoadData }) => {
  const [dataFilePaths, setDataFilePaths] = useState<DataFilePaths>({
    pFile: '',
    ptFile: '',
    aeFile: '',
    programFile: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load saved paths from localStorage
    const savedPaths = localStorage.getItem('dataFilePaths');
    if (savedPaths) {
      try {
        const paths = JSON.parse(savedPaths);
        setDataFilePaths(paths);
      } catch (e) {
        console.error('Error loading saved paths:', e);
      }
    } else {
      // Set default paths if none saved
      setDataFilePaths({
        pFile: '/Users/chris/Documents/Code/Program Management/data/P.xlsx',
        ptFile: '/Users/chris/Documents/Code/Program Management/data/PT.xlsx',
        aeFile: '/Users/chris/Documents/Code/Program Management/data/AE.xlsx',
        programFile: '/Users/chris/Documents/Code/Program Management/data/Program_Management.xlsm'
      });
    }
  }, []);

  const handleBrowse = async (fileType: keyof DataFilePaths) => {
    const extensions = fileType === 'programFile' ? ['xlsm', 'xlsx', 'xls'] : ['xlsx', 'xls'];
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Excel Files',
        extensions
      }]
    });
    
    if (selected) {
      setDataFilePaths(prev => ({
        ...prev,
        [fileType]: selected as string
      }));
    }
  };

  const handleLoadData = () => {
    // Save paths to localStorage
    localStorage.setItem('dataFilePaths', JSON.stringify(dataFilePaths));
    setIsLoading(true);
    
    // Call parent's load data function
    onLoadData(dataFilePaths);
  };

  const handleUseDefaults = () => {
    const defaultPaths = {
      pFile: '/Users/chris/Documents/Code/Program Management/data/P.xlsx',
      ptFile: '/Users/chris/Documents/Code/Program Management/data/PT.xlsx',
      aeFile: '/Users/chris/Documents/Code/Program Management/data/AE.xlsx',
      programFile: '/Users/chris/Documents/Code/Program Management/data/Program_Management.xlsm'
    };
    setDataFilePaths(defaultPaths);
  };

  const allPathsSelected = dataFilePaths.pFile && dataFilePaths.ptFile && 
                           dataFilePaths.aeFile && dataFilePaths.programFile;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '800px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px'
          }}>
            Program Management Tool
          </h1>
          <p style={{ color: '#6b7280', fontSize: '18px' }}>
            Select your Excel data files to begin
          </p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#374151' }}>
            Data File Locations
          </h2>

          <div style={{ display: 'grid', gap: '20px' }}>
            {/* P.xlsx */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: '#374151', 
                fontWeight: '500',
                fontSize: '14px'
              }}>
                Projects Master Data (P.xlsx)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={dataFilePaths.pFile}
                  onChange={(e) => setDataFilePaths({ ...dataFilePaths, pFile: e.target.value })}
                  placeholder="Select or enter path to P.xlsx"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    backgroundColor: dataFilePaths.pFile ? '#f9fafb' : 'white'
                  }}
                />
                <button
                  onClick={() => handleBrowse('pFile')}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  📁 Browse
                </button>
              </div>
            </div>

            {/* PT.xlsx */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: '#374151', 
                fontWeight: '500',
                fontSize: '14px'
              }}>
                Project Transactions (PT.xlsx)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={dataFilePaths.ptFile}
                  onChange={(e) => setDataFilePaths({ ...dataFilePaths, ptFile: e.target.value })}
                  placeholder="Select or enter path to PT.xlsx"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    backgroundColor: dataFilePaths.ptFile ? '#f9fafb' : 'white'
                  }}
                />
                <button
                  onClick={() => handleBrowse('ptFile')}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  📁 Browse
                </button>
              </div>
            </div>

            {/* AE.xlsx */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: '#374151', 
                fontWeight: '500',
                fontSize: '14px'
              }}>
                Activities Estimates (AE.xlsx)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={dataFilePaths.aeFile}
                  onChange={(e) => setDataFilePaths({ ...dataFilePaths, aeFile: e.target.value })}
                  placeholder="Select or enter path to AE.xlsx"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    backgroundColor: dataFilePaths.aeFile ? '#f9fafb' : 'white'
                  }}
                />
                <button
                  onClick={() => handleBrowse('aeFile')}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  📁 Browse
                </button>
              </div>
            </div>

            {/* Program_Management.xlsm */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: '#374151', 
                fontWeight: '500',
                fontSize: '14px'
              }}>
                Program Management (Program_Management.xlsm)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={dataFilePaths.programFile}
                  onChange={(e) => setDataFilePaths({ ...dataFilePaths, programFile: e.target.value })}
                  placeholder="Select or enter path to Program_Management.xlsm"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    backgroundColor: dataFilePaths.programFile ? '#f9fafb' : 'white'
                  }}
                />
                <button
                  onClick={() => handleBrowse('programFile')}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  📁 Browse
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'center',
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={handleUseDefaults}
            style={{
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🔄 Use Default Paths
          </button>

          <button
            onClick={handleLoadData}
            disabled={!allPathsSelected || isLoading}
            style={{
              padding: '14px 32px',
              background: allPathsSelected 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : '#e5e7eb',
              color: allPathsSelected ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '16px',
              cursor: allPathsSelected ? 'pointer' : 'not-allowed',
              transition: 'transform 0.2s',
              minWidth: '180px'
            }}
            onMouseOver={(e) => allPathsSelected && (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isLoading ? (
              <span>Loading...</span>
            ) : (
              <span>🚀 Load Data & Start</span>
            )}
          </button>
        </div>

        {!allPathsSelected && (
          <p style={{
            textAlign: 'center',
            marginTop: '20px',
            color: '#ef4444',
            fontSize: '14px'
          }}>
            ⚠️ Please select all four Excel files before loading data
          </p>
        )}
      </div>
    </div>
  );
};

export default StartScreen;