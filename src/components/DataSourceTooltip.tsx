import React from 'react';
import { getDataSourceInfo } from '../config/dataSourceMapping';

interface DataSourceTooltipProps {
  viewName: string;
  visible: boolean;
  position?: { x: number; y: number };
}

const DataSourceTooltip: React.FC<DataSourceTooltipProps> = ({ 
  viewName, 
  visible,
  position 
}) => {
  if (!visible) return null;
  
  const sourceInfo = getDataSourceInfo(viewName);
  if (!sourceInfo) return null;
  
  return (
    <div style={{
      position: 'fixed',
      left: position?.x || 0,
      top: position?.y || 0,
      zIndex: 10000,
      background: 'rgba(31, 41, 55, 0.95)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      maxWidth: '350px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(10px)',
      pointerEvents: 'none',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{ fontWeight: '600', marginBottom: '8px', color: '#60a5fa' }}>
        📊 {sourceInfo.displayName}
      </div>
      
      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#9ca3af' }}>Source Files:</span>{' '}
        <span style={{ color: '#fbbf24' }}>{sourceInfo.sourceFiles.join(', ')}</span>
      </div>
      
      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#9ca3af' }}>Sheet:</span>{' '}
        <span style={{ color: '#a78bfa' }}>{sourceInfo.sourceSheets.join(', ')}</span>
      </div>
      
      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#9ca3af' }}>Header Row:</span>{' '}
        <span style={{ color: '#34d399' }}>{sourceInfo.headerRow}</span>
      </div>
      
      {sourceInfo.keyColumns.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          <span style={{ color: '#9ca3af' }}>Key Columns:</span>{' '}
          <div style={{ fontSize: '12px', marginTop: '4px', color: '#e5e7eb' }}>
            {sourceInfo.keyColumns.join(' • ')}
          </div>
        </div>
      )}
      
      {sourceInfo.notes && (
        <div style={{ 
          marginTop: '8px', 
          paddingTop: '8px', 
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '12px',
          color: '#fde68a'
        }}>
          ⚠️ {sourceInfo.notes}
        </div>
      )}
    </div>
  );
};

export default DataSourceTooltip;