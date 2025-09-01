import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface VacationPlannerProps {
  data?: any;
}

interface VacationEntry {
  employee: string;
  date: Date;
  type: 'vacation' | 'sick' | 'holiday' | 'other';
}

interface EmployeeVacation {
  name: string;
  totalDays: number;
  usedDays: number;
  periods: { start: Date; end: Date; type: string }[];
}

function EnhancedVacationPlanner({ data }: VacationPlannerProps) {
  const [view, setView] = useState<'grid' | 'calendar' | 'timeline' | 'analytics'>('grid');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [vacationData, setVacationData] = useState<any>(null);
  const [employees, setEmployees] = useState<string[]>([]);
  const [vacationGrid, setVacationGrid] = useState<any[][]>([]);
  const [dates, setDates] = useState<Date[]>([]);
  const [editedCells, setEditedCells] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  useEffect(() => {
    loadVacationData();
  }, [data]);

  const loadVacationData = () => {
    // Check if vacation data is directly available
    let vacationSheet = null;
    
    if (data?.vacation) {
      vacationSheet = data.vacation;
      console.log('Using cached vacation data');
    } else if (data?.pmData) {
      console.log('Available sheets:', data.pmData.map((s: any) => s.sheet_name));
      
      for (const sheet of (data.pmData as any[])) {
        if (sheet.sheet_name && sheet.sheet_name.toLowerCase().includes('vacation')) {
          vacationSheet = sheet;
          console.log('Found vacation sheet:', sheet.sheet_name);
          break;
        }
      }
    } else {
      console.log('No vacation data available');
      return;
    }
    
    if (vacationSheet) {
      console.log('Vacation sheet structure:', {
        headers: vacationSheet.headers?.slice(0, 5),
        rowCount: vacationSheet.rows?.length,
        firstRow: vacationSheet.rows?.[0]?.slice(0, 5)
      });
      setVacationData(vacationSheet);
      
      if (vacationSheet.rows && vacationSheet.rows.length > 0) {
        // First row contains dates
        const dateRow = vacationSheet.rows[0];
        console.log('Date row:', dateRow.slice(0, 10));
        const parsedDates: Date[] = [];
        
        dateRow.forEach((cell: any, index: number) => {
          if (index > 0) { // Skip first cell (empty or label)
            // Handle different cell formats
            let dateValue = cell;
            if (cell && typeof cell === 'object') {
              if (cell.Number !== undefined) dateValue = cell.Number;
              else if (cell.Text !== undefined) dateValue = cell.Text;
              else if (cell.DateTime !== undefined) dateValue = cell.DateTime;
              else if (cell.Empty !== undefined) dateValue = null;
            }
            
            if (dateValue !== null && dateValue !== '') {
              const date = parseDate(dateValue);
              if (date) {
                parsedDates.push(date);
                if (index < 5) { // Log first few dates for debugging
                  console.log(`Date ${index}:`, dateValue, '->', date.toLocaleDateString());
                }
              }
            }
          }
        });
        
        console.log(`Parsed ${parsedDates.length} dates`);
        setDates(parsedDates);
        
        // Process employee rows (all rows after the first)
        const empNames: string[] = [];
        const grid: any[][] = [];
        
        for (let i = 1; i < vacationSheet.rows.length; i++) {
          const row = vacationSheet.rows[i];
          if (row && row[0]) {
            const name = getCellValue(row[0]);
            if (name && name.trim() !== '') {
              empNames.push(name);
              grid.push(row.slice(1)); // Store vacation data (excluding name)
              if (i <= 3) { // Log first few employees for debugging
                console.log(`Employee ${i}: ${name}`);
              }
            }
          }
        }
        
        console.log(`Loaded ${empNames.length} employees`);
        setEmployees(empNames);
        setVacationGrid(grid);
      }
    }
  };

  const getCellValue = (cell: any): string => {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
    if (cell.Text !== undefined) return cell.Text;
    if (cell.Number !== undefined) return String(cell.Number);
    return '';
  };

  const parseDate = (dateValue: any): Date | null => {
    try {
      // If it's already a number (Excel serial date)
      if (typeof dateValue === 'number') {
        const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) return excelDate;
      }
      
      // If it's a string, try parsing
      const dateStr = String(dateValue);
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date;
      
      // Try parsing as Excel serial number from string
      const excelSerial = parseFloat(dateStr);
      if (!isNaN(excelSerial) && excelSerial > 25569 && excelSerial < 50000) {
        const excelDate = new Date((excelSerial - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) return excelDate;
      }
    } catch (e) {
      console.error('Error parsing date:', dateValue, e);
    }
    return null;
  };

  const getTeamCoverage = (date: Date): number => {
    const dateIndex = dates.findIndex(d => 
      d.getDate() === date.getDate() && 
      d.getMonth() === date.getMonth()
    );
    
    if (dateIndex === -1) return 100;
    
    let available = 0;
    let total = employees.length;
    
    employees.forEach((_, empIndex) => {
      if (vacationGrid[empIndex] && !getCellValue(vacationGrid[empIndex][dateIndex])) {
        available++;
      }
    });
    
    return total > 0 ? Math.round((available / total) * 100) : 100;
  };

  const getEmployeesOnVacation = (date: Date): string[] => {
    const dateIndex = dates.findIndex(d => 
      d.getDate() === date.getDate() && 
      d.getMonth() === date.getMonth()
    );
    
    if (dateIndex === -1) return [];
    
    const onVacation: string[] = [];
    
    employees.forEach((emp, empIndex) => {
      if (vacationGrid[empIndex] && getCellValue(vacationGrid[empIndex][dateIndex])) {
        onVacation.push(emp);
      }
    });
    
    return onVacation;
  };

  const getVacationPeriods = (employeeIndex: number): { start: Date; end: Date }[] => {
    const periods: { start: Date; end: Date }[] = [];
    let currentPeriod: { start: Date; end: Date } | null = null;
    
    dates.forEach((date, dateIndex) => {
      const hasVacation = vacationGrid[employeeIndex] && 
                         getCellValue(vacationGrid[employeeIndex][dateIndex]);
      
      if (hasVacation) {
        if (!currentPeriod) {
          currentPeriod = { start: date, end: date };
        } else {
          currentPeriod.end = date;
        }
      } else if (currentPeriod) {
        periods.push(currentPeriod);
        currentPeriod = null;
      }
    });
    
    if (currentPeriod) {
      periods.push(currentPeriod);
    }
    
    return periods;
  };

  const toggleVacation = (empIndex: number, dateIndex: number) => {
    const key = `${empIndex}-${dateIndex}`;
    const currentValue = getCellValue(vacationGrid[empIndex][dateIndex]);
    const newValue = currentValue ? '' : 'V';
    
    const newGrid = [...vacationGrid];
    newGrid[empIndex][dateIndex] = newValue;
    setVacationGrid(newGrid);
    
    const newEdits = new Map(editedCells);
    newEdits.set(key, newValue);
    setEditedCells(newEdits);
  };

  const saveChanges = async () => {
    if (editedCells.size === 0) return;
    
    setSaving(true);
    try {
      const updates: any[] = [];
      
      editedCells.forEach((value, key) => {
        const [row, col] = key.split('-').map(Number);
        updates.push({
          row: row + 2,
          column: parseInt(col) + 1,
          value: value
        });
      });
      
      await invoke('update_excel_cells', {
        filePath: '/Users/chris/Downloads/Program_Management.xlsm',
        sheetName: 'Vacation',
        updates
      });
      
      setEditedCells(new Map());
    } catch (error) {
      console.error('Error saving vacation data:', error);
    }
    setSaving(false);
  };

  const renderGridView = () => {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
          Vacation Schedule Grid
        </h3>
        
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
              <tr>
                <th style={{ 
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f8fafc',
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  minWidth: '150px',
                  textAlign: 'left',
                  fontWeight: '600',
                  zIndex: 11
                }}>
                  Employee
                </th>
                {dates.map((date, index) => (
                  <th key={index} style={{ 
                    padding: '8px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#f8fafc',
                    minWidth: '80px',
                    fontSize: '11px',
                    fontWeight: '500'
                  }}>
                    {date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: '2-digit'
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, empIndex) => (
                <tr key={empIndex}>
                  <td style={{ 
                    position: 'sticky',
                    left: 0,
                    backgroundColor: 'white',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    fontWeight: '500',
                    zIndex: 1
                  }}>
                    {employee}
                  </td>
                  {dates.map((date, dateIndex) => {
                    const hasVacation = vacationGrid[empIndex] && 
                                       getCellValue(vacationGrid[empIndex][dateIndex]);
                    const key = `${empIndex}-${dateIndex}`;
                    const isEdited = editedCells.has(key);
                    
                    return (
                      <td 
                        key={dateIndex}
                        onClick={() => toggleVacation(empIndex, dateIndex)}
                        style={{ 
                          padding: '8px',
                          border: '1px solid #e5e7eb',
                          backgroundColor: hasVacation ? '#fb923c' : (isEdited ? '#fef3c7' : 'white'),
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        {hasVacation && (
                          <span style={{ color: 'white', fontWeight: '600' }}>V</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Summary Stats */}
        <div style={{ 
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontWeight: '600' }}>Total Employees:</span> {employees.length}
          </div>
          <div>
            <span style={{ fontWeight: '600' }}>Date Range:</span> {dates.length > 0 && (
              <span>
                {dates[0].toLocaleDateString()} - {dates[dates.length - 1].toLocaleDateString()}
              </span>
            )}
          </div>
          <div>
            <span style={{ fontWeight: '600' }}>Unsaved Changes:</span> {editedCells.size}
          </div>
        </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const weeks = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= lastDay || currentDate.getDay() !== 0) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }
    
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={() => {
            const newMonth = new Date(selectedMonth);
            newMonth.setMonth(newMonth.getMonth() - 1);
            setSelectedMonth(newMonth);
          }} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }}>
            ← Previous
          </button>
          <h3 style={{ fontSize: '20px', fontWeight: '600' }}>
            {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => {
            const newMonth = new Date(selectedMonth);
            newMonth.setMonth(newMonth.getMonth() + 1);
            setSelectedMonth(newMonth);
          }} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }}>
            Next →
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{ 
              backgroundColor: '#f8fafc', 
              padding: '10px', 
              textAlign: 'center', 
              fontWeight: '600',
              fontSize: '14px'
            }}>
              {day}
            </div>
          ))}
          
          {weeks.map((week, weekIndex) => 
            week.map((date, dayIndex) => {
              const isCurrentMonth = date.getMonth() === month;
              const coverage = getTeamCoverage(date);
              const onVacation = getEmployeesOnVacation(date);
              const isToday = date.toDateString() === new Date().toDateString();
              
              const coverageColor = coverage >= 80 ? '#10b981' : 
                                   coverage >= 60 ? '#f59e0b' : '#ef4444';
              
              return (
                <div 
                  key={`${weekIndex}-${dayIndex}`}
                  onClick={() => setSelectedDate(date)}
                  style={{ 
                    backgroundColor: isCurrentMonth ? 'white' : '#f8fafc',
                    padding: '10px',
                    minHeight: '80px',
                    cursor: 'pointer',
                    position: 'relative',
                    border: isToday ? '2px solid #3b82f6' : 'none',
                    opacity: isCurrentMonth ? 1 : 0.5
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '4px'
                  }}>
                    <span style={{ fontWeight: isToday ? '700' : '500' }}>
                      {date.getDate()}
                    </span>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%',
                      backgroundColor: coverageColor
                    }} />
                  </div>
                  
                  {onVacation.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      <div>{onVacation.length} away</div>
                      {onVacation.length <= 2 && onVacation.map((emp, i) => (
                        <div key={i} style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis' 
                        }}>
                          {emp.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div style={{ 
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    fontSize: '10px',
                    color: coverageColor,
                    fontWeight: '600'
                  }}>
                    {coverage}%
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {selectedDate && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#f8fafc',
            borderRadius: '8px'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>Team Coverage</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: getTeamCoverage(selectedDate) >= 80 ? '#10b981' : 
                                                                        getTeamCoverage(selectedDate) >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {getTeamCoverage(selectedDate)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>On Vacation</div>
                <div>
                  {getEmployeesOnVacation(selectedDate).length === 0 ? (
                    <span style={{ color: '#10b981' }}>Full team available</span>
                  ) : (
                    getEmployeesOnVacation(selectedDate).map((emp, i) => (
                      <div key={i} style={{ fontSize: '14px' }}>{emp}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTimelineView = () => {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>Vacation Timeline</h3>
        
        <div style={{ overflowX: 'auto' }}>
          {employees.map((employee, empIndex) => {
            const periods = getVacationPeriods(empIndex);
            const totalDays = periods.reduce((sum, p) => {
              const days = Math.ceil((p.end.getTime() - p.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              return sum + days;
            }, 0);
            
            return (
              <div key={empIndex} style={{ 
                marginBottom: '15px',
                padding: '15px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{employee}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {totalDays} days total • {periods.length} period{periods.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '4px 12px',
                    backgroundColor: totalDays > 20 ? '#fee2e2' : totalDays > 10 ? '#fef3c7' : '#dcfce7',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {25 - totalDays} days remaining
                  </div>
                </div>
                
                <div style={{ position: 'relative', height: '40px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>
                  {periods.map((period, periodIndex) => {
                    const yearStart = new Date(selectedMonth.getFullYear(), 0, 1);
                    const yearEnd = new Date(selectedMonth.getFullYear(), 11, 31);
                    const totalYearDays = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
                    
                    const startOffset = Math.max(0, Math.ceil((period.start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)));
                    const duration = Math.ceil((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    
                    const leftPercent = (startOffset / totalYearDays) * 100;
                    const widthPercent = (duration / totalYearDays) * 100;
                    
                    return (
                      <div
                        key={periodIndex}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          bottom: '5px',
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          backgroundColor: '#fb923c',
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          color: 'white',
                          fontWeight: '500',
                          minWidth: '40px'
                        }}
                        title={`${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`}
                      >
                        {duration}d
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Year timeline reference */}
        <div style={{ 
          marginTop: '20px',
          paddingTop: '10px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
    );
  };

  const renderAnalyticsView = () => {
    const totalEmployees = employees.length;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Calculate monthly statistics
    const monthlyStats = Array.from({ length: 12 }, (_, monthIndex) => {
      let totalVacationDays = 0;
      let peakDay = { date: null as Date | null, count: 0 };
      
      dates.forEach((date, dateIndex) => {
        if (date.getMonth() === monthIndex && date.getFullYear() === currentYear) {
          let dayCount = 0;
          employees.forEach((_, empIndex) => {
            if (vacationGrid[empIndex] && getCellValue(vacationGrid[empIndex][dateIndex])) {
              dayCount++;
              totalVacationDays++;
            }
          });
          
          if (dayCount > peakDay.count) {
            peakDay = { date, count: dayCount };
          }
        }
      });
      
      return {
        month: monthIndex,
        totalDays: totalVacationDays,
        peakDay
      };
    });
    
    // Calculate employee statistics
    const employeeStats = employees.map((emp, empIndex) => {
      const periods = getVacationPeriods(empIndex);
      const totalDays = periods.reduce((sum, p) => {
        const days = Math.ceil((p.end.getTime() - p.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return sum + days;
      }, 0);
      
      return { name: emp, totalDays, periods: periods.length };
    }).sort((a, b) => b.totalDays - a.totalDays);
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Coverage Overview */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Coverage Overview</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0284c7' }}>
                {totalEmployees}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Employees</div>
            </div>
            
            <div style={{ padding: '15px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#d97706' }}>
                {employeeStats.reduce((sum, e) => sum + e.totalDays, 0)}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Vacation Days</div>
            </div>
          </div>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Monthly Distribution</h4>
            <div style={{ display: 'flex', height: '150px', alignItems: 'flex-end', gap: '8px' }}>
              {monthlyStats.map((stat, index) => {
                const maxDays = Math.max(...monthlyStats.map(s => s.totalDays));
                const heightPercent = maxDays > 0 ? (stat.totalDays / maxDays) * 100 : 0;
                const isCurrentMonth = index === currentMonth;
                
                return (
                  <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ 
                      width: '100%',
                      backgroundColor: isCurrentMonth ? '#3b82f6' : '#cbd5e1',
                      height: `${heightPercent}%`,
                      minHeight: '2px',
                      borderRadius: '4px 4px 0 0',
                      position: 'relative'
                    }}>
                      {stat.totalDays > 0 && (
                        <div style={{ 
                          position: 'absolute',
                          top: '-20px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '10px',
                          fontWeight: '600'
                        }}>
                          {stat.totalDays}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', marginTop: '4px', color: '#6b7280' }}>
                      {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][index]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Top Vacation Users */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Vacation Usage</h3>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {employeeStats.slice(0, 10).map((emp, index) => {
              const usagePercent = (emp.totalDays / 25) * 100;
              const color = usagePercent > 80 ? '#ef4444' : usagePercent > 60 ? '#f59e0b' : '#10b981';
              
              return (
                <div key={index} style={{ 
                  marginBottom: '12px',
                  padding: '10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{emp.name}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {emp.totalDays} / 25 days
                    </span>
                  </div>
                  <div style={{ 
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${Math.min(usagePercent, 100)}%`,
                      height: '100%',
                      backgroundColor: color,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Peak Vacation Periods */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Peak Vacation Periods</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
            {monthlyStats
              .filter(stat => stat.peakDay.date !== null)
              .sort((a, b) => b.peakDay.count - a.peakDay.count)
              .slice(0, 4)
              .map((stat, index) => (
                <div key={index} style={{ 
                  padding: '15px',
                  backgroundColor: index === 0 ? '#fee2e2' : '#f8fafc',
                  borderRadius: '8px',
                  border: index === 0 ? '2px solid #ef4444' : 'none'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: index === 0 ? '#ef4444' : '#1f2937' }}>
                    {stat.peakDay.count} employees
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                    {stat.peakDay.date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    {Math.round((stat.peakDay.count / totalEmployees) * 100)}% of team away
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            Enhanced Vacation Planner
          </h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ 
              display: 'flex',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '4px'
            }}>
              <button
                onClick={() => setView('grid')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: view === 'grid' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: view === 'grid' ? '600' : '400',
                  boxShadow: view === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                📋 Grid
              </button>
              <button
                onClick={() => setView('calendar')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: view === 'calendar' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: view === 'calendar' ? '600' : '400',
                  boxShadow: view === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                📅 Calendar
              </button>
              <button
                onClick={() => setView('timeline')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: view === 'timeline' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: view === 'timeline' ? '600' : '400',
                  boxShadow: view === 'timeline' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                📊 Timeline
              </button>
              <button
                onClick={() => setView('analytics')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: view === 'analytics' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: view === 'analytics' ? '600' : '400',
                  boxShadow: view === 'analytics' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                📈 Analytics
              </button>
            </div>
            
            <button
              onClick={saveChanges}
              disabled={editedCells.size === 0 || saving}
              style={{
                padding: '8px 16px',
                backgroundColor: editedCells.size > 0 ? '#3b82f6' : '#94a3b8',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: editedCells.size > 0 ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              {saving ? 'Saving...' : editedCells.size > 0 ? `Save (${editedCells.size})` : 'No Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'grid' && renderGridView()}
        {view === 'calendar' && renderCalendarView()}
        {view === 'timeline' && renderTimelineView()}
        {view === 'analytics' && renderAnalyticsView()}
      </div>
    </div>
  );
}

export default EnhancedVacationPlanner;