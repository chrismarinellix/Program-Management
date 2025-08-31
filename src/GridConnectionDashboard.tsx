import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import EnhancedProjectDashboard from './EnhancedProjectDashboard';
import PipelineManager from './PipelineManager';
import ExcelEditor from './ExcelEditor';
import EnhancedVacationPlanner from './EnhancedVacationPlanner';
import BudgetTracker from './BudgetTracker';
import Settings from './Settings';
import DataInspector from './DataInspector';
import ProjectMap from './ProjectMap';
import BudgetAlerts from './BudgetAlerts';
import HoursTracking from './HoursTracking';
import RevenueAnalysis from './RevenueAnalysis';

// Global data store to avoid reloading
let globalDataCache: any = null;
let dataLoadPromise: Promise<any> | null = null;

// Make these accessible for force reload
(window as any).clearDataCache = () => {
  globalDataCache = null;
  dataLoadPromise = null;
};

function GridConnectionDashboard() {
  const [activeView, setActiveView] = useState<'projects' | 'pipeline' | 'vacation' | 'program' | 'budget' | 'settings' | 'map' | 'alerts' | 'hours' | 'revenue' | 'kanban'>('map');
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({
    'P.xlsx': 0,
    'PT.xlsx': 0,
    'AE.xlsx': 0,
    'Program_Management.xlsm': 0
  });
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [loadStartTime, setLoadStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [loadingFiles, setLoadingFiles] = useState<{[key: string]: boolean}>({});
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [invaderPosition, setInvaderPosition] = useState(0);
  const [invaderDirection, setInvaderDirection] = useState(1);
  const [invaderFrame, setInvaderFrame] = useState(0);

  useEffect(() => {
    loadAllDataOnce();
    
    // Load settings for hidden tabs
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setHiddenTabs(settings.hiddenTabs || []);
    }
    
    // Listen for settings updates
    const handleSettingsUpdate = (event: CustomEvent) => {
      if (event.detail.hiddenTabs) {
        setHiddenTabs(event.detail.hiddenTabs);
      }
    };
    
    // Listen for force reload event
    const handleForceReload = () => {
      // Clear cache using the window function
      if ((window as any).clearDataCache) {
        (window as any).clearDataCache();
      }
      setDataReady(false);
      setLoadingProgress({ 'P.xlsx': 0, 'PT.xlsx': 0, 'AE.xlsx': 0, 'Program_Management.xlsm': 0 });
      setDebugLog([]);
      setLoadStartTime(0); // Reset load start time
      setTimeout(() => {
        loadAllDataOnce();
      }, 100); // Small delay to ensure state is cleared
    };
    
    window.addEventListener('settingsUpdated', handleSettingsUpdate as EventListener);
    window.addEventListener('forceReloadData', handleForceReload as EventListener);
    
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate as EventListener);
      window.removeEventListener('forceReloadData', handleForceReload as EventListener);
    };
  }, []);

  useEffect(() => {
    if (loadStartTime > 0 && !dataReady) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - loadStartTime);
        setSpinnerFrame(prev => (prev + 1) % 2);
        
        // Move Space Invader left and right (slower)
        setInvaderPosition(prev => prev + invaderDirection * 1);
        
        // Animate invader frames
        setInvaderFrame(prev => (prev + 1) % 2);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [loadStartTime, dataReady, invaderDirection]);

  // Play Space Invader sound effect
  const playInvaderSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Classic Space Invader sound - descending tone
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Silently fail if audio not supported
    }
  };

  // Handle invader direction change
  useEffect(() => {
    if (invaderPosition >= 85) {
      setInvaderDirection(-1);
      setInvaderPosition(85);
      playInvaderSound();
    } else if (invaderPosition <= 15) {
      setInvaderDirection(1);
      setInvaderPosition(15);
      playInvaderSound();
    }
  }, [invaderPosition]);

  const addDebugMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
    setDebugLog(prev => [...prev, `[${timestamp}] ${message}`].slice(-10));
  };

  const loadAllDataOnce = async () => {
    // Check if force reload is needed (cache cleared)
    const forceReload = !globalDataCache && !dataLoadPromise;
    
    // If data is already cached and not force reloading, use it
    if (globalDataCache && !forceReload) {
      setDataReady(true);
      return;
    }

    // If a load is already in progress and not force reloading, wait for it
    if (dataLoadPromise && !forceReload) {
      await dataLoadPromise;
      setDataReady(true);
      return;
    }

    setLoadStartTime(Date.now());
    addDebugMessage('SYSTEM: Quantum data stream initialized');
    addDebugMessage('SYSTEM: Establishing neural links...');

    // Different file sizes affect loading speed
    const fileSizes = {
      'P.xlsx': 100,  // Smaller file
      'PT.xlsx': 500, // Large transactions file
      'AE.xlsx': 50,  // Small employee file
      'Program_Management.xlsm': 300 // Medium with macros
    };

    // Simulate realistic progress based on file size
    const simulateProgress = (fileName: string) => {
      let progress = 0;
      const fileSize = fileSizes[fileName as keyof typeof fileSizes];
      const speed = 100 / fileSize; // Smaller files load faster
      
      setLoadingFiles(prev => ({ ...prev, [fileName]: true }));
      addDebugMessage(`INIT: ${fileName} [${fileSize}KB]`);
      
      const interval = setInterval(() => {
        progress += (Math.random() * 20 + 10) * speed;
        if (progress > 90) progress = 90;
        setLoadingProgress(prev => ({ ...prev, [fileName]: Math.min(progress, 90) }));
      }, 150);
      return interval;
    };

    const intervals = [
      simulateProgress('P.xlsx'),
      simulateProgress('PT.xlsx'),
      simulateProgress('AE.xlsx'),
      simulateProgress('Program_Management.xlsm')
    ];
    
    // Get file paths from settings
    const savedSettings = localStorage.getItem('appSettings');
    
    // Detect platform and set default paths
    const isWindows = navigator.platform.toLowerCase().includes('win');
    const defaultDownloadsPath = isWindows 
      ? 'C:\\Users\\' + (window as any).username + '\\Downloads\\'
      : '/Users/' + (window as any).username + '/Downloads/';
    
    // Use relative paths or platform-specific defaults
    let filePaths = {
      pFile: './data/P.xlsx',  // Relative to app directory
      ptFile: './data/PT.xlsx',
      aeFile: './data/AE.xlsx',
      programFile: './data/Program_Management.xlsm'
    };
    
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      if (settings.dataFilePaths) {
        filePaths = settings.dataFilePaths;
      }
    }
    
    dataLoadPromise = Promise.all([
      invoke('read_excel', { filePath: filePaths.pFile })
        .then(data => {
          setLoadingFiles(prev => ({ ...prev, 'P.xlsx': false }));
          addDebugMessage('COMPLETE: P.xlsx [OK]');
          setLoadingProgress(prev => ({ ...prev, 'P.xlsx': 100 }));
          return data;
        }),
      invoke('read_excel', { filePath: filePaths.ptFile })
        .then(data => {
          setLoadingFiles(prev => ({ ...prev, 'PT.xlsx': false }));
          addDebugMessage('COMPLETE: PT.xlsx [OK]');
          setLoadingProgress(prev => ({ ...prev, 'PT.xlsx': 100 }));
          return data;
        }),
      invoke('read_excel', { filePath: filePaths.aeFile })
        .then(data => {
          setLoadingFiles(prev => ({ ...prev, 'AE.xlsx': false }));
          addDebugMessage('COMPLETE: AE.xlsx [OK]');
          setLoadingProgress(prev => ({ ...prev, 'AE.xlsx': 100 }));
          return data;
        }),
      invoke('read_excel', { filePath: filePaths.programFile })
        .then(data => {
          setLoadingFiles(prev => ({ ...prev, 'Program_Management.xlsm': false }));
          addDebugMessage('COMPLETE: Program_Management.xlsm [OK]');
          setLoadingProgress(prev => ({ ...prev, 'Program_Management.xlsm': 100 }));
          return data;
        })
    ]).then(([pData, ptData, aeData, pmData]) => {
      // Clear intervals
      intervals.forEach(i => clearInterval(i));
      
      addDebugMessage('SYSTEM: All data streams synchronized');
      
      // Debug log to see what we're getting
      console.log('Raw data received:', {
        pData: pData,
        ptData: ptData,
        aeData: aeData,
        pmData: pmData
      });
      
      // Check if data is empty or invalid
      if (!pData || !ptData || !aeData || !pmData) {
        console.error('ERROR: One or more data files failed to load:', {
          pData: !!pData,
          ptData: !!ptData,
          aeData: !!aeData,
          pmData: !!pmData
        });
        addDebugMessage('ERROR: Some data files are missing or empty');
      }
      
      // Store data in format expected by components
      // Each Excel file returns an array of sheets, we need the first one
      globalDataCache = { 
        p: pData?.[0] || null,
        pt: ptData?.[0] || null,
        ae: aeData?.[0] || null,
        program: pmData?.[0] || null,
        // Keep old format for backward compatibility
        pData, 
        ptData, 
        aeData, 
        pmData 
      };
      
      console.log('Processed globalDataCache:', globalDataCache);
      console.log('Data validation:', {
        'P sheet': globalDataCache.p ? `${globalDataCache.p.rows?.length || 0} rows` : 'MISSING',
        'PT sheet': globalDataCache.pt ? `${globalDataCache.pt.rows?.length || 0} rows` : 'MISSING',
        'AE sheet': globalDataCache.ae ? `${globalDataCache.ae.rows?.length || 0} rows` : 'MISSING',
        'Program sheet': globalDataCache.program ? `${globalDataCache.program.rows?.length || 0} rows` : 'MISSING'
      });
      
      addDebugMessage('SYSTEM: Quantum matrix stabilized - READY');
      // Small delay to show completion
      setTimeout(() => setDataReady(true), 800);
      return globalDataCache;
    });

    try {
      await dataLoadPromise;
    } catch (error: any) {
      intervals.forEach(i => clearInterval(i));
      addDebugMessage(`ERROR: ${error?.message || error}`);
      console.error('Error loading data:', error);
      dataLoadPromise = null; // Reset to allow retry
    }
  };

  if (!dataReady) {
    const totalProgress = Object.values(loadingProgress).reduce((a, b) => a + b, 0) / 4;
    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const milliseconds = ms % 1000;
      return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
    };
    
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        backgroundColor: '#000000',
        fontFamily: 'Courier New, monospace',
        padding: '20px'
      }}>
        <div style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center', width: '500px' }}>
          {/* Space Invader Animation */}
          <div style={{ 
            fontSize: '60px',
            color: '#00ff00',
            marginBottom: '30px',
            position: 'relative',
            height: '80px',
            width: '100%'
          }}>
            <div style={{
              position: 'absolute',
              left: `${invaderPosition}%`,
              transition: 'left 0.1s linear',
              transform: 'translateX(-50%)',
              color: '#00ff00',
              fontSize: '12px',
              fontFamily: 'Courier New, monospace',
              lineHeight: '1',
              whiteSpace: 'pre'
            }}>
              {invaderFrame === 0 ? 
                `  ▄▄███▄▄
 ▄██▀█▀██▄
 ███▄█▄███
 ▀▀▄▀▄▀▄▀▀
  ▄▀ ▀▄` : 
                `  ▄▄███▄▄
 ▄██▀█▀██▄
 ███▄█▄███
 ▀▀▄▀▄▀▄▀▀
 ▀▄   ▄▀`}
            </div>
          </div>
          
          {/* Loading text with timer */}
          <h2 style={{ 
            color: '#00ff00',
            fontSize: '24px',
            marginBottom: '10px',
            textShadow: '0 0 10px #00ff00',
            letterSpacing: '2px'
          }}>
            LOADING EXCEL DATA
          </h2>
          <div style={{
            color: '#00ff00',
            fontSize: '18px',
            marginBottom: '30px',
            fontWeight: 'bold'
          }}>
            ⏱ {formatTime(elapsedTime)}
          </div>
          
          {/* Reload button */}
          <button
            onClick={() => {
              // Clear everything and force a fresh reload
              if ((window as any).clearDataCache) {
                (window as any).clearDataCache();
              }
              setDataReady(false);
              setLoadingProgress({ 'P.xlsx': 0, 'PT.xlsx': 0, 'AE.xlsx': 0, 'Program_Management.xlsm': 0 });
              setDebugLog([]);
              setLoadStartTime(0);
              setTimeout(() => {
                loadAllDataOnce();
              }, 100);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#00ff00',
              color: '#000',
              border: '2px solid #00ff00',
              borderRadius: '5px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '20px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            🔄 Retry Loading Data
          </button>
          
          {/* File progress bars */}
          <div style={{ textAlign: 'left' }}>
            {Object.entries(loadingProgress).map(([fileName, progress]) => (
              <div key={fileName} style={{ marginBottom: '20px' }}>
                <div style={{ 
                  color: '#00ff00',
                  fontSize: '12px',
                  marginBottom: '5px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{fileName}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div style={{ 
                  width: '100%',
                  height: '20px',
                  backgroundColor: '#001100',
                  border: '1px solid #00ff00',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: '#00ff00',
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 10px #00ff00'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: '#000000',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {progress === 100 ? '✓' : ''}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Overall progress */}
          <div style={{ 
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #00ff00'
          }}>
            <div style={{ 
              color: '#00ff00',
              fontSize: '14px',
              marginBottom: '10px'
            }}>
              TOTAL PROGRESS: {Math.round(totalProgress)}%
            </div>
            <div style={{ 
              width: '100%',
              height: '30px',
              backgroundColor: '#001100',
              border: '2px solid #00ff00',
              position: 'relative'
            }}>
              <div style={{ 
                width: `${totalProgress}%`,
                height: '100%',
                backgroundColor: '#00ff00',
                transition: 'width 0.3s ease',
                position: 'relative'
              }}>
                {/* Animated stripes */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: 'linear-gradient(45deg, transparent 25%, rgba(0,0,0,0.2) 25%, rgba(0,0,0,0.2) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.2) 75%)',
                  backgroundSize: '20px 20px',
                  animation: 'slide 1s linear infinite'
                }}></div>
              </div>
            </div>
          </div>
        </div>
        </div>
        
        {/* Quantum Data Stream Monitor */}
        <div style={{
          width: '450px',
          marginLeft: '40px',
          padding: '20px',
          backgroundColor: '#000814',
          border: '2px solid #00ff41',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          maxHeight: '80vh',
          boxShadow: '0 0 20px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '15px',
            borderBottom: '1px solid #00ff41',
            paddingBottom: '10px'
          }}>
            <div style={{
              color: '#00ff41',
              fontSize: '10px',
              fontFamily: 'monospace',
              marginRight: '10px',
              animation: 'pulse 2s infinite'
            }}>
              {['/', '-', '\\', '|'][spinnerFrame]}
            </div>
            <h3 style={{
              color: '#00ff41',
              fontSize: '12px',
              margin: 0,
              fontFamily: 'monospace',
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>
              Quantum Data Stream Monitor
            </h3>
            <div style={{
              marginLeft: 'auto',
              color: '#00ff41',
              fontSize: '10px',
              fontFamily: 'monospace',
              opacity: 0.7
            }}>
              v2.0.1
            </div>
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            fontSize: '10px',
            fontFamily: 'Courier New, monospace',
            lineHeight: '1.4'
          }}>
            {debugLog.map((log, index) => {
              const isLoading = Object.entries(loadingFiles).some(([file, loading]) => 
                loading && log.includes(file)
              );
              const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
              const dots = '.'.repeat((Math.floor(elapsedTime / 500) % 6));
              
              return (
                <div key={index} style={{
                  color: log.includes('ERROR') ? '#ff0066' : 
                         log.includes('COMPLETE') ? '#00ff41' :
                         log.includes('INIT') ? '#00ffff' : '#00cc33',
                  marginBottom: '3px',
                  opacity: log.includes('ERROR') ? 1 : 0.9,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <span style={{ marginRight: '8px', color: '#00ff41', opacity: 0.5 }}>
                    {isLoading ? spinner[Math.floor(spinnerFrame * 2.5) % spinner.length] : '▪'}
                  </span>
                  <span>{log}</span>
                  {isLoading && (
                    <span style={{ 
                      color: '#00ff41', 
                      opacity: 0.6,
                      marginLeft: '5px'
                    }}>
                      {dots}
                    </span>
                  )}
                </div>
              );
            })}
            {debugLog.length === 0 && (
              <div style={{ color: '#00ff41', opacity: 0.3, textAlign: 'center', marginTop: '20px' }}>
                [SYSTEM IDLE] Awaiting data stream initialization...
              </div>
            )}
          </div>
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #00ff41',
            fontSize: '9px',
            color: '#00ff41',
            opacity: 0.5,
            fontFamily: 'monospace',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>QUANTUM CORE: ACTIVE</span>
            <span>STREAM: {debugLog.length} PACKETS</span>
          </div>
        </div>
        
        {/* CSS for animations */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes slide {
            from { background-position: 0 0; }
            to { background-position: 20px 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f3f4f6' }}>
      {/* Simplified Header with Navigation */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '2px solid #e5e7eb'
      }}>
        {/* Title Bar */}
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: '#1e293b'
          }}>
            Grid Connection Program
          </h1>
          <button
            onClick={() => setActiveView('settings')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeView === 'settings' ? '#3b82f6' : 'transparent',
              color: activeView === 'settings' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            ⚙️ Settings
          </button>
        </div>
        
        {/* Tab Navigation - Organized by Category */}
        <div style={{
          padding: '8px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px'
        }}>
          {/* Core Project Tabs */}
          {!hiddenTabs.includes('projects') && (
            <button
              onClick={() => setActiveView('projects')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'projects' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'projects' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'projects' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'projects' ? '#3b82f6' : '#f8f9fa'}
            >
              📊 Projects
            </button>
          )}
          {!hiddenTabs.includes('budget') && (
            <button
              onClick={() => setActiveView('budget')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'budget' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'budget' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'budget' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'budget' ? '#3b82f6' : '#f8f9fa'}
            >
              💰 Budget
            </button>
          )}
          {!hiddenTabs.includes('alerts') && (
            <button
              onClick={() => setActiveView('alerts')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'alerts' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'alerts' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'alerts' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'alerts' ? '#3b82f6' : '#f8f9fa'}
            >
              ⚠️ Alerts
            </button>
          )}
          {!hiddenTabs.includes('hours') && (
            <button
              onClick={() => setActiveView('hours')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'hours' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'hours' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'hours' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'hours' ? '#3b82f6' : '#f8f9fa'}
            >
              ⏱️ Hours
            </button>
          )}
          {!hiddenTabs.includes('revenue') && (
            <button
              onClick={() => setActiveView('revenue')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'revenue' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'revenue' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'revenue' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'revenue' ? '#3b82f6' : '#f8f9fa'}
            >
              💰 Revenue
            </button>
          )}
          
          {/* Planning & Management */}
          {!hiddenTabs.includes('pipeline') && (
            <button
              onClick={() => setActiveView('pipeline')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'pipeline' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'pipeline' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'pipeline' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'pipeline' ? '#3b82f6' : '#f8f9fa'}
            >
              🔄 Pipeline
            </button>
          )}
          {!hiddenTabs.includes('program') && (
            <button
              onClick={() => setActiveView('program')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'program' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'program' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'program' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'program' ? '#3b82f6' : '#f8f9fa'}
            >
              📈 Program
            </button>
          )}
          <button
            onClick={() => setActiveView('map')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeView === 'map' ? '#3b82f6' : '#f8f9fa',
              color: activeView === 'map' ? 'white' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'map' ? '#3b82f6' : '#e2e8f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'map' ? '#3b82f6' : '#f8f9fa'}
          >
            🗺️ Map
          </button>
          {!hiddenTabs.includes('vacation') && (
            <button
              onClick={() => setActiveView('vacation')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeView === 'vacation' ? '#3b82f6' : '#f8f9fa',
                color: activeView === 'vacation' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeView === 'vacation' ? '#3b82f6' : '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeView === 'vacation' ? '#3b82f6' : '#f8f9fa'}
            >
              🏖️ Vacation
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeView === 'projects' && <EnhancedProjectDashboard data={globalDataCache} />}
        {activeView === 'pipeline' && <PipelineManager data={globalDataCache} />}
        {activeView === 'vacation' && <EnhancedVacationPlanner data={globalDataCache} />}
        {activeView === 'program' && <ExcelEditor data={globalDataCache} sheetName="program" />}
        {activeView === 'budget' && globalDataCache && (
          <BudgetTracker 
            aeData={globalDataCache.ae?.rows || globalDataCache.aeData?.[0]?.rows || []} 
            ptData={globalDataCache.pt?.rows || globalDataCache.ptData?.[0]?.rows || []} 
            pData={globalDataCache.p?.rows || globalDataCache.pData?.[0]?.rows || []} 
          />
        )}
        {activeView === 'map' && <ProjectMap data={globalDataCache} />}
        {activeView === 'alerts' && <BudgetAlerts data={globalDataCache} />}
        {activeView === 'hours' && <HoursTracking data={globalDataCache} />}
        {activeView === 'revenue' && <RevenueAnalysis data={globalDataCache} />}
        {activeView === 'settings' && <Settings data={globalDataCache} />}
      </div>
    </div>
  );
}

export default GridConnectionDashboard;