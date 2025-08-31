import React, { useState, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, CellEditingStoppedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ExcelData, DataValue } from '../../services/excel.service';
import { Save, Download } from 'lucide-react';

interface ExcelGridProps {
  data: ExcelData;
  onCellEdit?: (row: number, col: number, value: DataValue) => void;
  onSave?: () => void;
  onExport?: () => void;
  editable?: boolean;
}

export const ExcelGrid: React.FC<ExcelGridProps> = ({
  data,
  onCellEdit,
  onSave,
  onExport,
  editable = true,
}) => {
  const [gridApi, setGridApi] = useState<any>(null);
  const [rowData, setRowData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);

  useMemo(() => {
    // Convert Excel data to AG-Grid format
    const rows = data.rows.map((row, rowIndex) => {
      const rowObj: any = { _rowIndex: rowIndex };
      data.headers.forEach((header, colIndex) => {
        const value = row[colIndex];
        if (value && typeof value === 'object') {
          rowObj[header] = value.Text || value.Number || value.Integer || value.Boolean || '';
        } else {
          rowObj[header] = value || '';
        }
      });
      return rowObj;
    });
    setRowData(rows);

    // Create column definitions
    const cols: ColDef[] = data.headers.map((header) => ({
      field: header,
      headerName: header,
      editable: editable,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100,
      cellClass: 'text-sm',
      valueFormatter: (params) => {
        const value = params.value;
        if (typeof value === 'number') {
          return value.toFixed(2);
        }
        return value;
      },
    }));
    setColumnDefs(cols);
  }, [data, editable]);

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  };

  const onCellEditingStopped = useCallback((event: CellEditingStoppedEvent) => {
    if (onCellEdit && event.rowIndex !== null && event.column) {
      const colIndex = data.headers.indexOf(event.column.getColId());
      if (colIndex >= 0) {
        const value = event.newValue;
        const dataValue: DataValue = 
          typeof value === 'number' ? { Number: value } :
          typeof value === 'boolean' ? { Boolean: value } :
          typeof value === 'string' ? { Text: value } :
          { Empty: null };
        
        onCellEdit(event.rowIndex, colIndex, dataValue);
      }
    }
  }, [onCellEdit, data.headers]);

  const exportData = () => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `export_${new Date().toISOString()}.csv`,
      });
    }
    onExport?.();
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {data.sheet_name}
        </h3>
        <div className="flex gap-2">
          {editable && onSave && (
            <button
              onClick={onSave}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2 text-sm"
            >
              <Save size={16} />
              Save
            </button>
          )}
          <button
            onClick={exportData}
            className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center gap-2 text-sm"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>
      
      <div className="flex-1 ag-theme-alpine" style={{ height: '500px' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          onCellEditingStopped={onCellEditingStopped}
          animateRows={true}
          defaultColDef={{
            editable: editable,
            sortable: true,
            filter: true,
            resizable: true,
          }}
          enableCellTextSelection={true}
          ensureDomOrder={true}
        />
      </div>
    </div>
  );
};