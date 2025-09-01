import React, { useState } from 'react';

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
}

export const DataSourceMapping: React.FC<DataSourceMappingProps> = ({ 
  mappings, 
  onMappingChange,
  onClose
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempMapping, setTempMapping] = useState<ColumnMapping | null>(null);

  const handleEdit = (key: string) => {
    setEditingKey(key);
    setTempMapping({ ...mappings[key] });
  };

  const handleSave = () => {
    if (editingKey && tempMapping && onMappingChange) {
      onMappingChange(editingKey, tempMapping);
    }
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
        <h3 style={{ margin: 0 }}>Data Source Mappings</h3>
        <button
          onClick={onClose}
          style={{
            padding: '6px 12px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Close
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
                  <td style={{ padding: '10px' }}>{mapping.displayName}</td>
                  <td style={{ padding: '10px' }}>
                    <select
                      value={tempMapping?.source}
                      onChange={(e) => setTempMapping({ ...tempMapping!, source: e.target.value })}
                      style={{ width: '100%', padding: '4px' }}
                    >
                      <option value="PT">PT.xlsx</option>
                      <option value="AE">AE.xlsx</option>
                      <option value="P">P.xlsx</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <input
                      type="text"
                      value={tempMapping?.column}
                      onChange={(e) => setTempMapping({ ...tempMapping!, column: e.target.value })}
                      style={{ width: '100%', padding: '4px' }}
                      placeholder="e.g., E, AH, S"
                    />
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={handleSave}
                      style={{
                        marginRight: '5px',
                        padding: '4px 8px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      style={{
                        padding: '4px 8px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td style={{ padding: '10px' }}>{mapping.displayName}</td>
                  <td style={{ padding: '10px' }}>{mapping.source}.xlsx</td>
                  <td style={{ padding: '10px' }}>Column {mapping.column}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {mapping.editable !== false && (
                      <button
                        onClick={() => handleEdit(key)}
                        style={{
                          padding: '4px 8px',
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