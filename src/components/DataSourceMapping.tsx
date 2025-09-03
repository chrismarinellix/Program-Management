import React, { useState, useEffect } from 'react';
import { ColumnMappingService } from '../services/columnMappingService';

export interface ColumnMapping {
  displayName: string;
  source: string;
  column: string;
  editable?: boolean;
}

interface DataSourceMappingProps {
  mappings: { [key: string]: ColumnMapping };
  onMappingChange?: (key: string, newMapping: ColumnMapping) => void;
  onClose?: () => void;
  onSaveAll?: (allMappings: { [key: string]: ColumnMapping }) => void;
  title?: string;
  showGlobalSave?: boolean;
}

export const DataSourceMapping: React.FC<DataSourceMappingProps> = ({ 
  mappings, 
  onMappingChange,
  onClose,
  onSaveAll,
  title = 'Data Source Mappings',
  showGlobalSave = true
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempMapping, setTempMapping] = useState<ColumnMapping | null>(null);
  const [currentMappings, setCurrentMappings] = useState(mappings);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Update current mappings when props change
  useEffect(() => {
    setCurrentMappings(mappings);
    setHasUnsavedChanges(false);
  }, [mappings]);

  const handleEdit = (key: string) => {
    setEditingKey(key);
    setTempMapping({ ...mappings[key] });
  };

  const handleSave = () => {
    if (editingKey && tempMapping) {
      const updatedMappings = {
        ...currentMappings,
        [editingKey]: tempMapping
      };
      setCurrentMappings(updatedMappings);
      setHasUnsavedChanges(true);
      
      if (onMappingChange) {
        onMappingChange(editingKey, tempMapping);
      }
    }
    setEditingKey(null);
    setTempMapping(null);
  };
  
  const handleSaveAll = () => {
    if (onSaveAll) {
      onSaveAll(currentMappings);
    } else {
      // Default behavior: save to ColumnMappingService
      const success = ColumnMappingService.saveColumnMappings({
        ...ColumnMappingService.getColumnMappings(),
        // Convert our mappings to the expected format
        'Current_View': Object.fromEntries(
          Object.entries(currentMappings).map(([key, mapping]) => [
            mapping.column,
            mapping.displayName
          ])
        )
      });
      
      if (success) {
        setHasUnsavedChanges(false);
        alert('All mappings saved successfully!');
      } else {
        alert('Error saving mappings. Please try again.');
      }
    }
  };
  
  const handleResetAll = () => {
    setCurrentMappings(mappings);
    setHasUnsavedChanges(false);
    setEditingKey(null);
    setTempMapping(null);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setTempMapping(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      maxHeight: '80vh',
      overflowY: 'auto',
      minWidth: '500px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#1f2937' }}>{title}</h3>
          {hasUnsavedChanges && (
            <p style={{ margin: '5px 0 0 0', color: '#f59e0b', fontSize: '13px', fontWeight: '500' }}>
              ⚠️ You have unsaved changes
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ✕ Close
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '10px', textAlign: 'left' }}>Field</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Source File</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Column</th>
            <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(mappings).map(([key, mapping]) => (
            <tr key={key} style={{ borderBottom: '1px solid #e5e7eb' }}>
              {editingKey === key ? (
                <>
                  <td style={{ padding: '10px', backgroundColor: '#fef3c7' }}>
                    <strong>{mapping.displayName}</strong>
                    <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px' }}>Editing...</div>
                  </td>
                  <td style={{ padding: '10px', backgroundColor: '#fef3c7' }}>
                    <select
                      value={tempMapping?.source}
                      onChange={(e) => setTempMapping({ ...tempMapping!, source: e.target.value })}
                      style={{ 
                        width: '100%', 
                        padding: '6px 8px', 
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="PT">PT.xlsx (Transactions)</option>
                      <option value="AE">AE.xlsx (Estimates)</option>
                      <option value="P">P.xlsx (Projects)</option>
                      <option value="PM">Program_Management.xlsm</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px', backgroundColor: '#fef3c7' }}>
                    <input
                      type="text"
                      value={tempMapping?.column}
                      onChange={(e) => setTempMapping({ ...tempMapping!, column: e.target.value.toUpperCase() })}
                      style={{ 
                        width: '100%', 
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        textTransform: 'uppercase'
                      }}
                      placeholder="e.g., E, AH, S"
                      maxLength={3}
                    />
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', backgroundColor: '#fef3c7' }}>
                    <button
                      onClick={handleSave}
                      style={{
                        marginRight: '8px',
                        padding: '6px 12px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      ✓ Save
                    </button>
                    <button
                      onClick={handleCancel}
                      style={{
                        padding: '6px 12px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      ✕ Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td style={{ padding: '10px' }}>
                    <strong>{currentMappings[key]?.displayName || mapping.displayName}</strong>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {currentMappings[key]?.source || mapping.source}.xlsx
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      Column {currentMappings[key]?.column || mapping.column}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {mapping.editable !== false && (
                      <button
                        onClick={() => handleEdit(key)}
                        style={{
                          padding: '6px 12px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Global Save Actions */}
      {showGlobalSave && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              {hasUnsavedChanges ? (
                <span style={{ color: '#f59e0b', fontWeight: '500' }}>
                  ⚠️ You have unsaved changes that need to be saved
                </span>
              ) : (
                'All changes are saved'
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleResetAll}
                disabled={!hasUnsavedChanges}
                style={{
                  padding: '8px 16px',
                  backgroundColor: hasUnsavedChanges ? '#f59e0b' : '#e5e7eb',
                  color: hasUnsavedChanges ? 'white' : '#9ca3af',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                title="Reset all changes to original values"
              >
                🔄 Reset All
              </button>
              
              <button
                onClick={handleSaveAll}
                disabled={!hasUnsavedChanges}
                style={{
                  padding: '8px 16px',
                  backgroundColor: hasUnsavedChanges ? '#10b981' : '#e5e7eb',
                  color: hasUnsavedChanges ? 'white' : '#9ca3af',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
                title="Save all mapping changes"
              >
                💾 Save All Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ColumnHeader: React.FC<{
  label: string;
  mapping?: ColumnMapping;
  onEditClick?: () => void;
  textAlign?: 'left' | 'right' | 'center';
}> = ({ label, mapping, onEditClick, textAlign = 'left' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <th 
      style={{ 
        padding: '12px', 
        textAlign: textAlign, 
        fontWeight: '600',
        position: 'relative',
        cursor: mapping ? 'help' : 'default'
      }}
      onMouseEnter={() => mapping && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {label}
      {mapping && (
        <span style={{ 
          fontSize: '12px', 
          color: '#6b7280', 
          marginLeft: '4px',
          fontWeight: 'normal'
        }}>
          ({mapping.source}, {mapping.column})
        </span>
      )}
      {showTooltip && mapping && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          background: 'rgba(31, 41, 55, 0.95)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          zIndex: 100,
          marginTop: '4px'
        }}>
          <div>Source: {mapping.source}.xlsx</div>
          <div>Column: {mapping.column}</div>
          {mapping.editable !== false && (
            <div 
              style={{ 
                marginTop: '4px', 
                color: '#60a5fa',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEditClick?.();
              }}
            >
              Click to edit mapping
            </div>
          )}
        </div>
      )}
    </th>
  );
};