import { invoke } from '@tauri-apps/api/core';

export interface DataValue {
  Text?: string;
  Number?: number;
  Integer?: number;
  Boolean?: boolean;
  Empty?: null;
}

export interface ExcelData {
  headers: string[];
  rows: DataValue[][];
  sheet_name: string;
}

export interface StockData {
  date: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjusted_close?: number;
}

export class ExcelService {
  static async readExcel(filePath: string): Promise<ExcelData[]> {
    return await invoke<ExcelData[]>('read_excel', { filePath });
  }

  static async writeExcel(filePath: string, data: ExcelData[]): Promise<void> {
    return await invoke<void>('write_excel', { filePath, data });
  }

  static async updateCell(
    filePath: string,
    sheetName: string,
    row: number,
    col: number,
    value: DataValue
  ): Promise<void> {
    return await invoke<void>('update_cell', {
      filePath,
      sheetName,
      row,
      col,
      value
    });
  }

  static parseStockData(excelData: ExcelData): StockData[] {
    const stockData: StockData[] = [];
    
    for (const row of excelData.rows) {
      const stock: any = {};
      excelData.headers.forEach((header, index) => {
        const value = row[index];
        const headerLower = header.toLowerCase();
        
        if (headerLower.includes('date')) {
          stock.date = value?.Text || '';
        } else if (headerLower.includes('symbol') || headerLower.includes('ticker')) {
          stock.symbol = value?.Text || '';
        } else if (headerLower.includes('open')) {
          stock.open = value?.Number || 0;
        } else if (headerLower.includes('high')) {
          stock.high = value?.Number || 0;
        } else if (headerLower.includes('low')) {
          stock.low = value?.Number || 0;
        } else if (headerLower.includes('close')) {
          stock.close = value?.Number || 0;
        } else if (headerLower.includes('volume')) {
          stock.volume = value?.Number || value?.Integer || 0;
        } else if (headerLower.includes('adjusted')) {
          stock.adjusted_close = value?.Number;
        }
      });
      
      if (stock.date && stock.symbol) {
        stockData.push(stock as StockData);
      }
    }
    
    return stockData;
  }
}