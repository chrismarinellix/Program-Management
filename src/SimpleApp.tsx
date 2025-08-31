import React, { useEffect, useState } from 'react';
import { DebugLogger } from './debug-logger';

function SimpleApp() {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    DebugLogger.log('SimpleApp mounted');
    setMounted(true);
    
    // Update logs every second
    const interval = setInterval(() => {
      setLogs([...DebugLogger.getLogs()]);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: 'blue' }}>Debug Mode Active</h1>
      <p>Component mounted: {mounted ? 'Yes' : 'No'}</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Debug Logs:</h2>
        <div id="debug-output" style={{ 
          backgroundColor: 'black', 
          color: 'lime', 
          padding: '10px',
          fontFamily: 'monospace',
          fontSize: '12px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
      
      <button 
        onClick={() => {
          DebugLogger.log('Button clicked at ' + new Date().toISOString());
          alert('Button works!');
        }}
        style={{ 
          marginTop: '20px',
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test Button
      </button>
    </div>
  );
}

export default SimpleApp;