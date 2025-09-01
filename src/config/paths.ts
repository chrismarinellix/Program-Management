// Cross-platform path configuration
import { platform } from '@tauri-apps/plugin-os';

// Get the appropriate data directory based on OS
export const getDataDirectory = async (): Promise<string> => {
  const os = await platform();
  
  // Use relative paths from the app directory
  // These will work on any OS
  return './data';
};

// Default file paths (relative to app directory)
export const DEFAULT_PATHS = {
  pFile: './data/P.xlsx',
  ptFile: './data/PT.xlsx',
  aeFile: './data/AE.xlsx',
  programFile: './data/Program_Management.xlsm'
};

// For development, use sample data location
export const DEV_PATHS = {
  pFile: process.env.NODE_ENV === 'development' ? './data/P.xlsx' : '',
  ptFile: process.env.NODE_ENV === 'development' ? './data/PT.xlsx' : '',
  aeFile: process.env.NODE_ENV === 'development' ? './data/AE.xlsx' : '',
  programFile: process.env.NODE_ENV === 'development' ? './data/Program_Management.xlsm' : ''
};

// Helper to normalize paths for the current OS
export const normalizePath = (path: string): string => {
  // Convert forward slashes to backslashes on Windows
  if (typeof window !== 'undefined' && window.navigator.platform.includes('Win')) {
    return path.replace(/\//g, '\\');
  }
  return path;
};

// Get user's documents folder cross-platform
export const getDocumentsFolder = async (): Promise<string> => {
  try {
    const { documentDir } = await import('@tauri-apps/api/path');
    return await documentDir();
  } catch {
    // Fallback for development
    if (typeof window !== 'undefined' && window.navigator.platform.includes('Win')) {
      return 'C:\\Users\\User\\Documents';
    }
    return '~/Documents';
  }
};

// Get user's downloads folder cross-platform  
export const getDownloadsFolder = async (): Promise<string> => {
  try {
    const { downloadDir } = await import('@tauri-apps/api/path');
    return await downloadDir();
  } catch {
    // Fallback for development
    if (typeof window !== 'undefined' && window.navigator.platform.includes('Win')) {
      return 'C:\\Users\\User\\Downloads';
    }
    return '~/Downloads';
  }
};