import React, { useEffect, useState } from 'react';
import EnhancedVacationPlanner from './EnhancedVacationPlanner';
import { loadDataCache } from './services/database';

interface VacationPlannerCachedProps {
  data: any;
}

const VacationPlannerCached: React.FC<VacationPlannerCachedProps> = ({ data }) => {
  const [vacationData, setVacationData] = useState<any>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
    try {
      const cached = await loadDataCache('vacation_data');
      if (cached) {
        console.log('Loaded cached vacation data');
        setVacationData(cached);
        setIsFromCache(true);
        
        // Get last refresh time from cache metadata
        const cacheTime = cached.cached_at ? new Date(cached.cached_at) : new Date();
        setLastRefresh(cacheTime);
      }
    } catch (error) {
      console.error('Failed to load cached vacation data:', error);
    }
  };

  useEffect(() => {
    if (data) {
      console.log('Using fresh vacation data');
      setVacationData(data);
      setIsFromCache(false);
      setLastRefresh(new Date());
    }
  }, [data]);

  const formatLastRefresh = (date: Date | null) => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (!vacationData) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        color: '#6b7280'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div>Loading vacation data...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {lastRefresh && (
        <div style={{ 
          padding: '8px 16px',
          background: isFromCache ? '#fef3c7' : '#dcfce7',
          borderRadius: '8px',
          border: isFromCache ? '1px solid #fde68a' : '1px solid #86efac',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#64748b'
        }}>
          {isFromCache ? '📦 Using cached vacation data from ' : '✅ Fresh vacation data from '}
          {formatLastRefresh(lastRefresh)}
        </div>
      )}
      <EnhancedVacationPlanner data={vacationData} />
    </div>
  );
};

export default VacationPlannerCached;