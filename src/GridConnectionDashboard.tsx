import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import EnhancedProjectDashboard from "./EnhancedProjectDashboard";
import PipelineManagerCached from "./PipelineManagerCached";
import ExcelEditor from "./ExcelEditor";
import VacationPlannerCached from "./VacationPlannerCached";
import BudgetTracker from "./BudgetTracker";
import Settings from "./Settings";
import DataInspector from "./DataInspector";
import ProjectMap from "./ProjectMap";
import TimelineView from "./TimelineView";
import ProjectBudgetReport from "./ProjectBudgetReport";
import PipelineChart from "./PipelineChart";
import PivotTables from "./PivotTables";
import BudgetAlerts from "./BudgetAlerts";
import HoursTracking from "./HoursTracking";
import RevenueAnalysis from "./RevenueAnalysis";
import { saveDataCache, loadDataCache, clearDataCache, initDatabase } from "./services/database";
import { formatSourceTooltip, getDataSourceInfo } from "./config/dataSourceMapping";
import { DEFAULT_PATHS, normalizePath } from "./config/paths";

// Global data store to avoid reloading
let globalDataCache: any = null;
let dataLoadPromise: Promise<any> | null = null;

// Make these accessible for force reload and data access
(window as any).clearDataCache = async () => {
  globalDataCache = null;
  dataLoadPromise = null;
  // Also clear SQL cache when force reloading
  await clearDataCache();
};

(window as any).getGlobalDataCache = () => {
  return globalDataCache;
};

function GridConnectionDashboard() {
  const [showDataSourceTooltips, setShowDataSourceTooltips] = useState<boolean>(() => {
    const saved = localStorage.getItem('showDataSourceTooltips');
    return saved === null ? true : JSON.parse(saved);
  });
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    | "projects"
    | "pipeline"
    | "pChart"
    | "timeline"
    | "report"
    | "pivot"
    | "vacation"
    | "program"
    | "budget"
    | "settings"
    | "map"
    | "alerts"
    | "hours"
    | "revenue"
    | "kanban"
  >("map");
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({
    "P.xlsx": 0,
    "PT.xlsx": 0,
    "AE.xlsx": 0,
    "Program_Management.xlsm": 0,
  });
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [loadStartTime, setLoadStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [loadingFiles, setLoadingFiles] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [dataLoadTime, setDataLoadTime] = useState<Date | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load data on component mount
  useEffect(() => {
    console.log('Component mounted, loading data...');
    loadAllDataOnce(false); // Load from cache if available
  }, []); // Empty dependency array = run once on mount

  useEffect(() => {
    // Load settings for hidden tabs
    const savedSettings = localStorage.getItem("appSettings");
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
    const handleForceReload = async () => {
      console.log('Force reload triggered');
      // Clear both the cache AND the global data cache
      if ((window as any).clearDataCache) {
        console.log('Clearing data cache');
        await (window as any).clearDataCache(); // Now async to clear SQL too
      }
      // IMPORTANT: Clear the global cache and promise so it forces a fresh load
      globalDataCache = null;
      dataLoadPromise = null;
      
      setDataReady(false);
      setLoadingProgress({
        "P.xlsx": 0,
        "PT.xlsx": 0,
        "AE.xlsx": 0,
        "Program_Management.xlsm": 0,
      });
      setDebugLog([]);
      setLoadStartTime(0); // Reset load start time
      console.log('State reset, calling loadAllDataOnce in 100ms');
      setTimeout(() => {
        loadAllDataOnce(true); // Pass true to force reload
      }, 100); // Small delay to ensure state is cleared
    };

    window.addEventListener(
      "settingsUpdated",
      handleSettingsUpdate as EventListener,
    );
    window.addEventListener("forceReloadData", handleForceReload);

    return () => {
      window.removeEventListener(
        "settingsUpdated",
        handleSettingsUpdate as EventListener,
      );
      window.removeEventListener("forceReloadData", handleForceReload);
    };
  }, []);

  // Timer effect for elapsed time
  useEffect(() => {
    if (loadStartTime > 0 && !dataReady) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - loadStartTime);
      }, 47); // Update roughly 20 times per second for smooth display
      return () => clearInterval(timer);
    }
  }, [loadStartTime, dataReady]);

  const addDebugMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
    setDebugLog((prev) => [...prev, `[${timestamp}] ${message}`].slice(-10));
  };

  const loadAllDataOnce = async (forceReload: boolean = false) => {
    console.log('loadAllDataOnce called', { 
      hasCache: !!globalDataCache, 
      hasPromise: !!dataLoadPromise,
      forceReload
    });
    
    // Ensure database is initialized first
    try {
      await initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // Continue anyway - app can work without SQL features
    }
    
    // If not forcing reload and a load is already in progress, wait for it
    if (!forceReload && dataLoadPromise) {
      console.log('Waiting for existing load promise');
      await dataLoadPromise;
      setDataReady(true);
      return;
    }
    
    // ALWAYS try to load from SQL cache first (even if globalDataCache exists)
    // This ensures data persists across app restarts and code changes
    if (!forceReload) {
      try {
      const [cachedP, cachedPT, cachedAE, cachedPipeline, cachedProgram, cachedVacation] = await Promise.all([
        loadDataCache('p_data'),
        loadDataCache('pt_data'),
        loadDataCache('ae_data'),
        loadDataCache('pipeline_data'),
        loadDataCache('program_data'),
        loadDataCache('vacation_data')
      ]);
      
      // If we have cached data, use it and skip loading from Excel
      if (cachedP && cachedPT && cachedAE) {
        console.log('Found cached Excel data, using cache instead of loading files');
        
        globalDataCache = {
          p: cachedP,
          pt: cachedPT,
          ae: cachedAE,
          pipeline: cachedPipeline,
          program: cachedProgram,
          vacation: cachedVacation,
          // Keep arrays for compatibility
          pData: [cachedP],
          ptData: [cachedPT],
          aeData: [cachedAE],
          pmData: [cachedProgram, cachedPipeline, cachedVacation].filter(Boolean)
        };
        
        // Mark as ready immediately
        setDataReady(true);
        setIsLoadingData(false);
        setDataLoadTime(new Date());
        
        // Notify that data is loaded from cache
        window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
          detail: {
            progress: {
              pFile: 100,
              ptFile: 100,
              aeFile: 100,
              programFile: 100,
            },
            isLoading: false
          }
        }));
        
        console.log('Data loaded from cache successfully');
        return; // Skip Excel loading entirely
      } else {
        console.log('Cache incomplete, will load from Excel files');
      }
    } catch (error) {
      console.error('Failed to load cached data:', error);
    }
    } // Close the if (!forceReload) block

    console.log('Starting new data load');
    setIsLoadingData(true);
    setLoadStartTime(Date.now());
    addDebugMessage("SYSTEM: Quantum data stream initialized");
    addDebugMessage("SYSTEM: Establishing neural links...");
    
    // Reset progress and notify Settings
    window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
      detail: {
        progress: {
          pFile: 0,
          ptFile: 0,
          aeFile: 0,
          programFile: 0,
        },
        isLoading: true
      }
    }));

    // Different file sizes affect loading speed
    const fileSizes = {
      "P.xlsx": 100, // Smaller file
      "PT.xlsx": 500, // Large transactions file
      "AE.xlsx": 50, // Small employee file
      "Program_Management.xlsm": 300, // Medium with macros
    };

    // Simulate realistic progress based on file size
    const simulateProgress = (fileName: string) => {
      let progress = 0;
      const fileSize = fileSizes[fileName as keyof typeof fileSizes];
      const speed = 100 / fileSize; // Smaller files load faster

      setLoadingFiles((prev) => ({ ...prev, [fileName]: true }));
      addDebugMessage(`INIT: ${fileName} [${fileSize}KB]`);

      const interval = setInterval(() => {
        progress += (Math.random() * 20 + 10) * speed;
        if (progress > 90) progress = 90;
        setLoadingProgress((prev) => {
          const newProgress = {
            ...prev,
            [fileName]: Math.min(progress, 90),
          };
          
          // Send progress to Settings component
          const progressEvent = new CustomEvent('dataLoadingProgress', {
            detail: {
              progress: {
                pFile: fileName === 'P.xlsx' ? newProgress[fileName] : prev['P.xlsx'] || 0,
                ptFile: fileName === 'PT.xlsx' ? newProgress[fileName] : prev['PT.xlsx'] || 0,
                aeFile: fileName === 'AE.xlsx' ? newProgress[fileName] : prev['AE.xlsx'] || 0,
                programFile: fileName === 'Program_Management.xlsm' ? newProgress[fileName] : prev['Program_Management.xlsm'] || 0,
              },
              isLoading: true
            }
          });
          window.dispatchEvent(progressEvent);
          
          return newProgress;
        });
      }, 150);
      return interval;
    };

    const intervals = [
      simulateProgress("P.xlsx"),
      simulateProgress("PT.xlsx"),
      simulateProgress("AE.xlsx"),
      simulateProgress("Program_Management.xlsm"),
    ];

    // Get file paths from localStorage or defaults
    const savedPaths = localStorage.getItem("dataFilePaths");
    const savedSettings = localStorage.getItem("appSettings");

    let filePaths = {
      pFile: normalizePath(DEFAULT_PATHS.pFile),
      ptFile: normalizePath(DEFAULT_PATHS.ptFile),
      aeFile: normalizePath(DEFAULT_PATHS.aeFile),
      programFile: normalizePath(DEFAULT_PATHS.programFile),
    };

    if (savedPaths) {
      try {
        filePaths = JSON.parse(savedPaths);
      } catch (e) {
        console.error("Error parsing saved paths:", e);
      }
    } else if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      if (settings.dataFilePaths) {
        filePaths = settings.dataFilePaths;
      }
    }

    console.log('Loading files from paths:', filePaths);
    
    dataLoadPromise = Promise.all([
      invoke("read_excel", { filePath: filePaths.pFile }).then((data) => {
        console.log('P.xlsx loaded:', !!data);
        setLoadingFiles((prev) => ({ ...prev, "P.xlsx": false }));
        addDebugMessage("COMPLETE: P.xlsx [OK]");
        setLoadingProgress((prev) => {
          const newProgress = { ...prev, "P.xlsx": 100 };
          window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
            detail: {
              progress: {
                pFile: 100,
                ptFile: prev["PT.xlsx"] || 0,
                aeFile: prev["AE.xlsx"] || 0,
                programFile: prev["Program_Management.xlsm"] || 0,
              },
              isLoading: true
            }
          }));
          return newProgress;
        });
        return data;
      }),
      invoke("read_excel", { filePath: filePaths.ptFile }).then((data) => {
        console.log('PT.xlsx loaded:', !!data);
        setLoadingFiles((prev) => ({ ...prev, "PT.xlsx": false }));
        addDebugMessage("COMPLETE: PT.xlsx [OK]");
        setLoadingProgress((prev) => {
          const newProgress = { ...prev, "PT.xlsx": 100 };
          window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
            detail: {
              progress: {
                pFile: prev["P.xlsx"] || 0,
                ptFile: 100,
                aeFile: prev["AE.xlsx"] || 0,
                programFile: prev["Program_Management.xlsm"] || 0,
              },
              isLoading: true
            }
          }));
          return newProgress;
        });
        return data;
      }),
      invoke("read_excel", { filePath: filePaths.aeFile }).then((data) => {
        console.log('AE.xlsx loaded:', !!data);
        setLoadingFiles((prev) => ({ ...prev, "AE.xlsx": false }));
        addDebugMessage("COMPLETE: AE.xlsx [OK]");
        setLoadingProgress((prev) => {
          const newProgress = { ...prev, "AE.xlsx": 100 };
          window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
            detail: {
              progress: {
                pFile: prev["P.xlsx"] || 0,
                ptFile: prev["PT.xlsx"] || 0,
                aeFile: 100,
                programFile: prev["Program_Management.xlsm"] || 0,
              },
              isLoading: true
            }
          }));
          return newProgress;
        });
        return data;
      }),
      invoke("read_excel", { filePath: filePaths.programFile }).then((data) => {
        console.log('Program_Management.xlsm loaded:', !!data);
        setLoadingFiles((prev) => ({
          ...prev,
          "Program_Management.xlsm": false,
        }));
        addDebugMessage("COMPLETE: Program_Management.xlsm [OK]");
        setLoadingProgress((prev) => {
          const newProgress = { ...prev, "Program_Management.xlsm": 100 };
          window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
            detail: {
              progress: {
                pFile: prev["P.xlsx"] || 0,
                ptFile: prev["PT.xlsx"] || 0,
                aeFile: prev["AE.xlsx"] || 0,
                programFile: 100,
              },
              isLoading: true
            }
          }));
          return newProgress;
        });
        return data;
      }),
    ]).then(async ([pData, ptData, aeData, pmData]) => {
      // Clear intervals
      intervals.forEach((i) => clearInterval(i));

      console.log('All files loaded:', {
        pData: !!pData,
        ptData: !!ptData,
        aeData: !!aeData,
        pmData: !!pmData
      });
      
      addDebugMessage("SYSTEM: All data streams synchronized");

      // Debug log to see what we're getting
      console.log("Raw data received:", {
        pData: pData,
        ptData: ptData,
        aeData: aeData,
        pmData: pmData,
      });
      
      // Log actual sheet names from Program_Management
      if (pmData && Array.isArray(pmData)) {
        console.log('Program_Management sheets found:', pmData.map((s: any) => ({
          name: s.sheet_name,
          rows: s.rows?.length || 0,
          headers: s.headers?.slice(0, 5) || []
        })));
        
        // Debug: Log exact sheet names for matching
        pmData.forEach((sheet: any) => {
          console.log(`Sheet: "${sheet.sheet_name}" (lowercase: "${sheet.sheet_name?.toLowerCase()}")`);
        });
      }

      // Check if data is empty or invalid
      if (!pData || !ptData || !aeData || !pmData) {
        console.error("ERROR: One or more data files failed to load:", {
          pData: !!pData,
          ptData: !!ptData,
          aeData: !!aeData,
          pmData: !!pmData,
        });
        addDebugMessage("ERROR: Some data files are missing or empty");
      }

      // Store data in format expected by components
      // Each Excel file returns an array of sheets
      // Program_Management.xlsm has multiple sheets: Pipeline, Program, Vacation
      console.log('Program_Management sheets:', pmData?.map((s: any) => s.sheet_name));
      
      const pipelineSheet = pmData?.find((sheet: any) => 
        sheet.sheet_name?.toLowerCase().includes('pipeline')
      ) || pmData?.[0];
      
      // Look for "Program Quick View" sheet specifically
      const programSheet = pmData?.find((sheet: any) => {
        const name = sheet.sheet_name?.toLowerCase() || '';
        // Try different variations of the sheet name
        return name === 'program quick view' || 
               name === 'program_quick_view' ||
               (name.includes('program') && name.includes('quick')) ||
               name === 'program management';
      }) || pmData?.[1];
      
      const vacationSheet = pmData?.find((sheet: any) => 
        sheet.sheet_name?.toLowerCase().includes('vacation')
      ) || pmData?.[2];
      
      globalDataCache = {
        p: pData?.[0] || null,
        pt: ptData?.[0] || null,
        ae: aeData?.[0] || null,
        program: programSheet || pmData?.[0] || null,
        pipeline: pipelineSheet || null,
        vacation: vacationSheet || null,
        // Keep old format for backward compatibility
        pData,
        ptData,
        aeData,
        pmData,
      };
      
      // Cache ALL data including P, PT, AE files
      Promise.all([
        pData?.[0] ? saveDataCache('p_data', pData[0], ['P.xlsx']) : Promise.resolve(),
        ptData?.[0] ? saveDataCache('pt_data', ptData[0], ['PT.xlsx']) : Promise.resolve(),
        aeData?.[0] ? saveDataCache('ae_data', aeData[0], ['AE.xlsx']) : Promise.resolve(),
        pipelineSheet ? saveDataCache('pipeline_data', pipelineSheet, ['Program_Management.xlsm']) : Promise.resolve(),
        programSheet ? saveDataCache('program_data', programSheet, ['Program_Management.xlsm']) : Promise.resolve(),
        vacationSheet ? saveDataCache('vacation_data', vacationSheet, ['Program_Management.xlsm']) : Promise.resolve()
      ]).then(() => {
        console.log('Successfully cached ALL data files');
      }).catch(error => {
        console.error('Failed to cache data:', error);
      });

      console.log("Processed globalDataCache:", globalDataCache);
      console.log("Data validation:", {
        "P sheet": globalDataCache.p
          ? `${globalDataCache.p.rows?.length || 0} rows`
          : "MISSING",
        "PT sheet": globalDataCache.pt
          ? `${globalDataCache.pt.rows?.length || 0} rows`
          : "MISSING",
        "AE sheet": globalDataCache.ae
          ? `${globalDataCache.ae.rows?.length || 0} rows`
          : "MISSING",
        "Program sheet": globalDataCache.program
          ? `${globalDataCache.program.rows?.length || 0} rows`
          : "MISSING",
        "Pipeline sheet": globalDataCache.pipeline
          ? `${globalDataCache.pipeline.rows?.length || 0} rows`
          : "MISSING",
        "Vacation sheet": globalDataCache.vacation
          ? `${globalDataCache.vacation.rows?.length || 0} rows`
          : "MISSING",
      });

      addDebugMessage("SYSTEM: Quantum matrix stabilized - READY");
      // Small delay to show completion
      setTimeout(() => {
        setDataReady(true);
        setIsLoadingData(false);
        setDataLoadTime(new Date());
        // Send final event to clear loading state in Settings
        window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
          detail: {
            progress: {
              pFile: 100,
              ptFile: 100,
              aeFile: 100,
              programFile: 100,
            },
            isLoading: false
          }
        }));
      }, 800);
      return globalDataCache;
    });

    try {
      await dataLoadPromise;
    } catch (error: any) {
      intervals.forEach((i) => clearInterval(i));
      addDebugMessage(`ERROR: ${error?.message || error}`);
      console.error("Error loading data:", error);
      dataLoadPromise = null; // Reset to allow retry
      setIsLoadingData(false);
      
      // Send error event to clear loading state in Settings
      window.dispatchEvent(new CustomEvent('dataLoadingProgress', {
        detail: {
          progress: {
            pFile: 0,
            ptFile: 0,
            aeFile: 0,
            programFile: 0,
          },
          isLoading: false
        }
      }));
    }
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f3f4f6",
        }}
      >
      {/* Simplified Header with Navigation */}
      <div
        style={{
          backgroundColor: "white",
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        {/* Title Bar */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "bold",
                color: "#1e293b",
              }}
            >
              Grid Connection Program
            </h1>
            
            {/* Data Status Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              backgroundColor: dataReady ? '#dcfce7' : isLoadingData ? '#fef3c7' : '#fee2e2',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: dataReady ? '#22c55e' : isLoadingData ? '#f59e0b' : '#ef4444',
                animation: isLoadingData ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ color: dataReady ? '#166534' : isLoadingData ? '#92400e' : '#991b1b' }}>
                {dataReady ? 'Data Loaded' : isLoadingData ? 'Loading...' : 'No Data'}
              </span>
              {dataLoadTime && (
                <span style={{ color: '#6b7280', fontSize: '11px' }}>
                  ({Math.floor((new Date().getTime() - dataLoadTime.getTime()) / 60000)} min ago)
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setActiveView("settings")}
            style={{
              padding: "8px 16px",
              backgroundColor:
                activeView === "settings" ? "#3b82f6" : "transparent",
              color: activeView === "settings" ? "white" : "#64748b",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            ⚙️ Settings
          </button>
        </div>
        
        {/* Progress Bar */}
        {isLoadingData && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading data files...</span>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {Math.round(Object.values(loadingProgress).reduce((a, b) => a + b, 0) / 4)}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#e5e7eb',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Object.values(loadingProgress).reduce((a, b) => a + b, 0) / 4}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginTop: '8px'
            }}>
              {Object.entries(loadingProgress).map(([file, progress]) => (
                <div key={file} style={{ fontSize: '10px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#6b7280',
                    marginBottom: '2px'
                  }}>
                    <span>{file.split('.')[0]}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '1px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${progress}%`,
                      height: '100%',
                      backgroundColor: progress === 100 ? '#22c55e' : '#3b82f6',
                      borderRadius: '1px',
                      transition: 'width 0.2s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation - Organized by Category */}
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            flexWrap: "wrap",
            gap: "2px",
          }}
        >
          {/* Core Project Tabs */}
          {!hiddenTabs.includes("projects") && (
            <button
              onClick={() => setActiveView("projects")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "projects" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "projects" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "projects" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "projects" ? "#3b82f6" : "#f8f9fa")
              }
            >
              📊 Projects
            </button>
          )}
          {!hiddenTabs.includes("budget") && (
            <button
              onClick={() => setActiveView("budget")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "budget" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "budget" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "budget" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "budget" ? "#3b82f6" : "#f8f9fa")
              }
            >
              💰 Budget
            </button>
          )}
          {!hiddenTabs.includes("alerts") && (
            <button
              onClick={() => setActiveView("alerts")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "alerts" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "alerts" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "alerts" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "alerts" ? "#3b82f6" : "#f8f9fa")
              }
            >
              ⚠️ Alerts
            </button>
          )}
          {!hiddenTabs.includes("hours") && (
            <button
              onClick={() => setActiveView("hours")}
              style={{
                padding: "8px 16px",
                backgroundColor: activeView === "hours" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "hours" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "hours" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "hours" ? "#3b82f6" : "#f8f9fa")
              }
            >
              ⏱️ Hours
            </button>
          )}
          {!hiddenTabs.includes("revenue") && (
            <button
              onClick={() => setActiveView("revenue")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "revenue" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "revenue" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "revenue" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "revenue" ? "#3b82f6" : "#f8f9fa")
              }
            >
              💵 Revenue
            </button>
          )}

          {/* Planning & Management */}
          {!hiddenTabs.includes("pipeline") && (
            <button
              onClick={() => setActiveView("pipeline")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "pipeline" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "pipeline" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "pipeline" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "pipeline" ? "#3b82f6" : "#f8f9fa")
              }
            >
              🔄 Pipeline
            </button>
          )}
          {!hiddenTabs.includes("pChart") && (
            <button
              onClick={() => setActiveView("pChart")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "pChart" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "pChart" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "pChart" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "pChart" ? "#3b82f6" : "#f8f9fa")
              }
            >
              📊 pChart
            </button>
          )}
          {!hiddenTabs.includes("timeline") && (
            <button
              onClick={() => setActiveView("timeline")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "timeline" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "timeline" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "timeline" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "timeline" ? "#3b82f6" : "#f8f9fa")
              }
            >
              ⏰ Timeline
            </button>
          )}
          {!hiddenTabs.includes("report") && (
            <button
              onClick={() => setActiveView("report")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "report" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "report" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "report" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "report" ? "#3b82f6" : "#f8f9fa")
              }
            >
              📊 Report
            </button>
          )}
          {!hiddenTabs.includes("pivot") && (
            <button
              onClick={() => setActiveView("pivot")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "pivot" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "pivot" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "pivot" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "pivot" ? "#3b82f6" : "#f8f9fa")
              }
            >
              🔄 Pivot
            </button>
          )}
          {!hiddenTabs.includes("program") && (
            <button
              onClick={() => setActiveView("program")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "program" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "program" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "program" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "program" ? "#3b82f6" : "#f8f9fa")
              }
            >
              📈 Program
            </button>
          )}
          {!hiddenTabs.includes("map") && (
            <button
              onClick={() => setActiveView("map")}
              style={{
                padding: "8px 16px",
                backgroundColor: activeView === "map" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "map" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "map" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "map" ? "#3b82f6" : "#f8f9fa")
              }
            >
              🗺️ Map
            </button>
          )}
          {!hiddenTabs.includes("vacation") && (
            <button
              onClick={() => setActiveView("vacation")}
              style={{
                padding: "8px 16px",
                backgroundColor:
                  activeView === "vacation" ? "#3b82f6" : "#f8f9fa",
                color: activeView === "vacation" ? "white" : "#475569",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "vacation" ? "#3b82f6" : "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  activeView === "vacation" ? "#3b82f6" : "#f8f9fa")
              }
            >
              🏖️ Vacation
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
        {activeView === "projects" && globalDataCache && (
          <EnhancedProjectDashboard data={globalDataCache} />
        )}
        {activeView === "pipeline" && (
          <PipelineManagerCached data={globalDataCache?.pipeline || globalDataCache?.program} />
        )}
        {activeView === "pChart" && (
          <PipelineChart data={globalDataCache?.pipeline || globalDataCache?.program} />
        )}
        {activeView === "timeline" && (
          <TimelineView data={globalDataCache?.pipeline || globalDataCache?.program} />
        )}
        {activeView === "report" && (
          <ProjectBudgetReport data={globalDataCache} />
        )}
        {activeView === "pivot" && (
          <PivotTables data={globalDataCache} />
        )}
        {activeView === "vacation" && (
          <VacationPlannerCached data={globalDataCache?.vacation || globalDataCache?.program} />
        )}
        {activeView === "program" && globalDataCache && (
          <ExcelEditor
            data={globalDataCache}
            sheetName="program"
          />
        )}
        {activeView === "budget" && globalDataCache && (
          <BudgetTracker
            pData={globalDataCache.p}
            ptData={globalDataCache.pt}
            aeData={globalDataCache.ae}
          />
        )}
        {activeView === "settings" && <Settings />}
        {activeView === "map" && globalDataCache && (
          <ProjectMap projectData={globalDataCache.p} />
        )}
        {activeView === "alerts" && globalDataCache && (
          <BudgetAlerts
            pData={globalDataCache.p}
            ptData={globalDataCache.pt}
            aeData={globalDataCache.ae}
          />
        )}
        {activeView === "hours" && globalDataCache && (
          <HoursTracking ptData={globalDataCache.pt} />
        )}
        {activeView === "revenue" && globalDataCache && (
          <RevenueAnalysis ptData={globalDataCache.pt} />
        )}
        {!globalDataCache && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#6b7280",
              fontSize: "18px",
            }}
          >
            📁 Please select your Excel files and click "Load Data" to begin
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default GridConnectionDashboard;
