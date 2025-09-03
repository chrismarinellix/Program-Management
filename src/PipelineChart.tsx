import React, { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { getCurrentColumnMappings } from './services/columnMappingService';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface PipelineChartProps {
  data?: any;
}

interface ProcessedProject {
  customer: string;
  projectName: string;
  estValueGBP: number;
  estValueAUD: number;
  weightedValue: number;
  probability: number;
  projectDate: Date | null;
  monthYear: string;
  stage: string;
  status: string;
}

const PipelineChart: React.FC<PipelineChartProps> = ({ data }) => {
  const [processedData, setProcessedData] = useState<ProcessedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState<'monthly' | 'stage' | 'probability'>('monthly');
  const [columnMappings, setColumnMappings] = useState(getCurrentColumnMappings());

  // Process Excel data similar to the provided function
  const processExcelData = (rawData: any[]): ProcessedProject[] => {
    if (!rawData || !Array.isArray(rawData)) return [];

    return rawData.filter(row => {
      // Using pipeline data structure - adapt column mapping as needed
      const hasCustomer = row[0]; // Assuming first column is customer/lead
      const hasProject = row[1]; // Project name
      const hasValue = row[8] || row[7]; // Value columns (adjust based on actual data)
      const hasDate = row[5] && row[5] !== '' && row[5] !== '0'; // Date column

      if (hasDate && !isNaN(parseFloat(row[5])) && parseFloat(row[5]) < 1) {
        return false;
      }

      return hasCustomer && hasProject && (hasValue || hasDate);
    }).map(row => {
      let projectDate: Date | null = null;
      
      // Handle date parsing
      if (row[5]) { // Assuming column F (index 5) has dates
        if (!isNaN(parseFloat(row[5]))) {
          if (parseFloat(row[5]) > 1) {
            // Excel serial date conversion
            projectDate = new Date((parseFloat(row[5]) - 25569) * 86400 * 1000);
            if (projectDate.getFullYear() < 1900) {
              projectDate = null;
            }
          }
        } else {
          projectDate = new Date(row[5]);
          if (isNaN(projectDate.getTime()) || projectDate.getFullYear() < 1900) {
            projectDate = null;
          }
        }
      }

      // Extract values (adapt column indices based on actual data structure)
      const estValueGBP = parseFloat(row[8]) || 0; // Column I
      const estValueAUD = parseFloat(row[7]) || 0; // Column H  
      const weightedValue = parseFloat(row[9]) || 0; // Column J
      const estTotal = estValueGBP || estValueAUD || 0;
      const probability = estTotal > 0 ? Math.min(weightedValue / estTotal, 1) : 0;

      return {
        customer: String(row[0] || ''),
        projectName: String(row[1] || ''),
        estValueGBP,
        estValueAUD,
        weightedValue,
        probability,
        projectDate,
        monthYear: projectDate ? projectDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
        stage: String(row[2] || ''), // Stage column
        status: String(row[3] || '') // Status column
      };
    }).filter(row => row.projectDate !== null || row.estValueGBP > 0 || row.estValueAUD > 0);
  };

  useEffect(() => {
    console.log('PipelineChart received data:', {
      hasData: !!data,
      sheetName: data?.sheet_name,
      headers: data?.headers?.slice(0, 5),
      rowCount: data?.rows?.length,
      dataKeys: data ? Object.keys(data) : []
    });

    if (data?.rows || data?.pipeline?.rows || data?.program?.rows) {
      setLoading(true);
      try {
        let rawData = [];
        
        // Handle different data structures
        if (data.rows) {
          // Direct sheet data
          rawData = data.rows;
          console.log('Using direct sheet rows:', rawData.length);
        } else if (data.pipeline?.rows) {
          // Nested pipeline data
          rawData = data.pipeline.rows;
          console.log('Using pipeline.rows:', rawData.length);
        } else if (data.program?.rows) {
          // Fallback to program data
          rawData = data.program.rows;
          console.log('Using program.rows as fallback:', rawData.length);
        }

        const processed = processExcelData(rawData);
        setProcessedData(processed);
        console.log('Processed pipeline data for charts:', {
          inputRows: rawData.length,
          processedProjects: processed.length,
          sampleProject: processed[0]
        });
      } catch (error) {
        console.error('Error processing pipeline data:', error);
      } finally {
        setLoading(false);
      }
    } else {
      console.log('No valid pipeline data found');
      setProcessedData([]);
      setLoading(false);
    }
  }, [data]);

  // Monthly chart data
  const monthlyChartData = useMemo(() => {
    const monthlyData: { [key: string]: { estValue: number; weightedValue: number; count: number } } = {};

    processedData.forEach(project => {
      const monthKey = project.projectDate ? 
        project.projectDate.toISOString().substring(0, 7) : 
        'Unknown';
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { estValue: 0, weightedValue: 0, count: 0 };
      }

      monthlyData[monthKey].estValue += project.estValueGBP || project.estValueAUD;
      monthlyData[monthKey].weightedValue += project.weightedValue;
      monthlyData[monthKey].count += 1;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => {
      if (month === 'Unknown') return 'Unknown';
      const date = new Date(month);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Estimated Value (£)',
          data: sortedMonths.map(month => monthlyData[month].estValue),
          backgroundColor: '#4169E1',
          borderColor: '#4169E1',
          borderWidth: 1
        },
        {
          label: 'Weighted Value (£)',
          data: sortedMonths.map(month => monthlyData[month].weightedValue),
          backgroundColor: '#40E0D0',
          borderColor: '#40E0D0',
          borderWidth: 1
        }
      ]
    };
  }, [processedData]);

  // Stage distribution chart data
  const stageChartData = useMemo(() => {
    const stageData: { [key: string]: number } = {};
    
    processedData.forEach(project => {
      const stage = project.stage || 'Unknown';
      stageData[stage] = (stageData[stage] || 0) + (project.estValueGBP || project.estValueAUD);
    });

    return {
      labels: Object.keys(stageData),
      datasets: [{
        label: 'Value by Stage (£)',
        data: Object.values(stageData),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };
  }, [processedData]);

  // Probability distribution chart
  const probabilityChartData = useMemo(() => {
    const probData = processedData.map(project => ({
      x: project.probability * 100,
      y: project.estValueGBP || project.estValueAUD,
      label: project.projectName
    }));

    return {
      datasets: [{
        label: 'Projects by Probability vs Value',
        data: probData,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    };
  }, [processedData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Pipeline Analysis',
        font: { size: 16 }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y || context.parsed;
            return context.dataset.label + ': £' + (value / 1000000).toFixed(2) + 'M';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Value (£)'
        },
        ticks: {
          callback: function(value: any) {
            return '£' + (value / 1000000).toFixed(1) + 'M';
          }
        }
      },
      x: {
        title: {
          display: true,
          text: selectedChart === 'monthly' ? 'Month' : selectedChart === 'probability' ? 'Probability (%)' : 'Stage'
        }
      }
    }
  };

  const scatterOptions = {
    ...chartOptions,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Probability (%)'
        },
        min: 0,
        max: 100
      },
      y: {
        ...chartOptions.scales.y
      }
    }
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>📊 Loading Pipeline Charts...</div>
          <div style={{ color: '#6b7280' }}>Processing project data</div>
        </div>
      </div>
    );
  }

  // Show no data message if no projects processed
  if (processedData.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '18px', marginBottom: '10px', color: '#dc2626' }}>📊 No Pipeline Data Available</div>
          <div style={{ color: '#6b7280', marginBottom: '20px' }}>
            No valid pipeline projects found for charting.
          </div>
          <div style={{ 
            backgroundColor: '#fef3c7', 
            padding: '15px', 
            borderRadius: '8px',
            maxWidth: '500px',
            margin: '0 auto',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#92400e' }}>Possible reasons:</div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#78350f' }}>
              <li>Pipeline sheet is empty or has no valid data</li>
              <li>Data doesn't match expected column format</li>
              <li>No projects have dates or values for charting</li>
              <li>Pipeline data hasn't been loaded yet - try Force Reload</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#1f2937', marginBottom: '10px' }}>📊 Pipeline Charts</h1>
        <p style={{ color: '#6b7280', marginBottom: '0' }}>
          Visual analysis of project pipeline data with estimated values, probabilities, and stage distribution
        </p>
      </div>

      {/* Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
            {processedData.length}
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Total Projects</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
            £{((processedData.reduce((sum, p) => sum + (p.estValueGBP || p.estValueAUD), 0)) / 1000000).toFixed(1)}M
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Total Pipeline Value</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
            £{((processedData.reduce((sum, p) => sum + p.weightedValue, 0)) / 1000000).toFixed(1)}M
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Weighted Value</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
            {processedData.length > 0 ? 
              Math.round((processedData.reduce((sum, p) => sum + p.probability, 0) / processedData.length) * 100) 
              : 0}%
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Avg Probability</div>
        </div>
      </div>

      {/* Chart Selection */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: '600', color: '#374151' }}>Chart View:</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'monthly', label: '📅 Monthly Distribution', description: 'Projects by month' },
            { key: 'stage', label: '🎯 Stage Distribution', description: 'Value by pipeline stage' },
            { key: 'probability', label: '🎲 Probability Analysis', description: 'Value vs probability scatter' }
          ].map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => setSelectedChart(key as any)}
              style={{
                padding: '10px 15px',
                backgroundColor: selectedChart === key ? '#3b82f6' : '#f3f4f6',
                color: selectedChart === key ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              title={description}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Display */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ height: '500px' }}>
          {selectedChart === 'monthly' && (
            <Bar data={monthlyChartData} options={chartOptions} />
          )}
          {selectedChart === 'stage' && (
            <Pie data={stageChartData} options={{ ...chartOptions, scales: undefined }} />
          )}
          {selectedChart === 'probability' && (
            <Line data={probabilityChartData} options={scatterOptions} />
          )}
        </div>
      </div>

      {/* Data Quality Information */}
      <div style={{
        backgroundColor: '#fef3c7',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h4 style={{ color: '#92400e', marginBottom: '10px' }}>📋 Data Processing Info</h4>
        <ul style={{ margin: '0', paddingLeft: '20px', color: '#78350f', lineHeight: '1.6' }}>
          <li>Filtered projects with customer, project name, and valid dates/values</li>
          <li>Date parsing handles both Excel serial dates and standard date formats</li>
          <li>Probability calculated as weighted value / estimated total value</li>
          <li>Values combined from GBP and AUD columns (adapt column mapping as needed)</li>
          <li>Projects without valid dates or values are excluded from time-based charts</li>
        </ul>
      </div>
    </div>
  );
};

export default PipelineChart;