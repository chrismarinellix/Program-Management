import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ProjectLocation {
  id: string;
  projectId: string;
  projectName: string;
  address: string;
  lat: number;
  lng: number;
  details?: {
    client?: string;
    budget?: number;
    status?: string;
    description?: string;
  };
}

interface ProjectMapProps {
  data?: any;
}

// Create sonar pulse HTML for custom marker
const createSonarMarker = (color: string = '#3b82f6') => {
  return L.divIcon({
    className: 'sonar-marker',
    html: `
      <div class="sonar-container">
        <div class="sonar-wave"></div>
        <div class="sonar-wave"></div>
        <div class="sonar-wave"></div>
        <div class="sonar-center"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

const ProjectMap: React.FC<ProjectMapProps> = ({ data }) => {
  const [locations, setLocations] = useState<ProjectLocation[]>([]);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    projectId: '',
    projectName: '',
    address: '',
    client: '',
    budget: '',
    status: '',
    description: ''
  });
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Australia bounds
  const australiaBounds: L.LatLngBoundsExpression = [
    [-44.0, 112.0], // Southwest
    [-10.0, 154.0]  // Northeast
  ];

  // Load saved locations from localStorage
  useEffect(() => {
    const savedLocations = localStorage.getItem('projectLocations');
    if (savedLocations) {
      setLocations(JSON.parse(savedLocations));
    }

    // Add some default Australian project locations
    const defaultLocations: ProjectLocation[] = [
      {
        id: '1',
        projectId: 'AEMO-BESS',
        projectName: 'AEMO-BESS Droop Analysis',
        address: 'Sydney, NSW',
        lat: -33.8688,
        lng: 151.2093,
        details: {
          client: 'AEMO',
          budget: 51632,
          status: 'Active',
          description: 'Battery Energy Storage System analysis for grid stability'
        }
      },
      {
        id: '2',
        projectId: 'ARG-SF',
        projectName: 'Argyle SF Connection Studies',
        address: 'Melbourne, VIC',
        lat: -37.8136,
        lng: 144.9631,
        details: {
          client: 'Argyle Energy',
          budget: 76108,
          status: 'In Progress',
          description: 'Solar farm grid connection feasibility study'
        }
      },
      {
        id: '3',
        projectId: 'ARM-BESS',
        projectName: 'Armidale BESS Connection',
        address: 'Armidale, NSW',
        lat: -30.5120,
        lng: 151.6643,
        details: {
          client: 'Regional Power Co',
          budget: 194819,
          status: 'Planning',
          description: 'Large scale battery storage integration project'
        }
      }
    ];

    const existingIds = locations.map(l => l.id);
    const newDefaults = defaultLocations.filter(d => !existingIds.includes(d.id));
    if (newDefaults.length > 0) {
      setLocations(prev => [...prev, ...newDefaults]);
    }
  }, []);

  // Save locations to localStorage when they change
  useEffect(() => {
    if (locations.length > 0) {
      localStorage.setItem('projectLocations', JSON.stringify(locations));
    }
  }, [locations]);

  // Geocode address to coordinates using Nominatim (free service)
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Australia')}&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  const handleAddLocation = async () => {
    if (!newLocation.address || !newLocation.projectName) {
      alert('Please enter at least a project name and address');
      return;
    }

    setIsGeocoding(true);
    const coords = await geocodeAddress(newLocation.address);
    
    if (coords) {
      const location: ProjectLocation = {
        id: Date.now().toString(),
        projectId: newLocation.projectId || `PROJ-${Date.now()}`,
        projectName: newLocation.projectName,
        address: newLocation.address,
        lat: coords.lat,
        lng: coords.lng,
        details: {
          client: newLocation.client,
          budget: newLocation.budget ? parseFloat(newLocation.budget) : undefined,
          status: newLocation.status,
          description: newLocation.description
        }
      };

      setLocations(prev => [...prev, location]);
      setNewLocation({
        projectId: '',
        projectName: '',
        address: '',
        client: '',
        budget: '',
        status: '',
        description: ''
      });
      setShowAddLocation(false);
    } else {
      alert('Could not find location. Please try a more specific address.');
    }
    setIsGeocoding(false);
  };

  const removeLocation = (id: string) => {
    setLocations(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            color: '#1f2937',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            🗺️ Project Location Tracker
          </h1>
          <p style={{ 
            margin: '5px 0 0 0', 
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Active Projects: {locations.length} | Coverage: Australia
          </p>
        </div>
        
        <button
          onClick={() => setShowAddLocation(!showAddLocation)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
          }}
        >
          📍 Add Location
        </button>
      </div>

      {/* Add Location Form */}
      {showAddLocation && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            maxWidth: '1200px'
          }}>
            <input
              type="text"
              placeholder="Project Name *"
              value={newLocation.projectName}
              onChange={(e) => setNewLocation({ ...newLocation, projectName: e.target.value })}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="Address (e.g., Sydney, NSW) *"
              value={newLocation.address}
              onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="Project ID"
              value={newLocation.projectId}
              onChange={(e) => setNewLocation({ ...newLocation, projectId: e.target.value })}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="Client"
              value={newLocation.client}
              onChange={(e) => setNewLocation({ ...newLocation, client: e.target.value })}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="number"
              placeholder="Budget ($)"
              value={newLocation.budget}
              onChange={(e) => setNewLocation({ ...newLocation, budget: e.target.value })}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <select
              value={newLocation.status}
              onChange={(e) => setNewLocation({ ...newLocation, status: e.target.value })}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Status</option>
              <option value="Active">Active</option>
              <option value="Planning">Planning</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
            <textarea
              placeholder="Project Description"
              value={newLocation.description}
              onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '60px'
              }}
            />
            <button
              onClick={handleAddLocation}
              disabled={isGeocoding}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '500',
                cursor: isGeocoding ? 'wait' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isGeocoding ? 'Locating...' : 'Add to Map'}
            </button>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[-25.0, 133.0]} // Center of Australia
          zoom={4}
          bounds={australiaBounds}
          style={{ height: '100%', width: '100%' }}
          maxBounds={australiaBounds}
          minZoom={4}
          maxZoom={18}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {locations.map((location) => (
            <Marker
              key={location.id}
              position={[location.lat, location.lng]}
              icon={createSonarMarker()}
            >
              <Popup>
                <div style={{
                  padding: '10px',
                  minWidth: '250px'
                }}>
                  <h3 style={{ 
                    margin: '0 0 10px 0',
                    color: '#1f2937',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '5px',
                    fontWeight: '600'
                  }}>
                    {location.projectName}
                  </h3>
                  <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                    <p><strong>ID:</strong> {location.projectId}</p>
                    <p><strong>Location:</strong> {location.address}</p>
                    {location.details?.client && (
                      <p><strong>Client:</strong> {location.details.client}</p>
                    )}
                    {location.details?.budget && (
                      <p><strong>Budget:</strong> ${location.details.budget.toLocaleString()}</p>
                    )}
                    {location.details?.status && (
                      <p><strong>Status:</strong> 
                        <span style={{
                          marginLeft: '5px',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          backgroundColor: location.details.status === 'Active' ? '#10b981' :
                                        location.details.status === 'Completed' ? '#3b82f6' :
                                        location.details.status === 'On Hold' ? '#f59e0b' : '#eab308',
                          color: 'white',
                          fontWeight: 'bold'
                        }}>
                          {location.details.status}
                        </span>
                      </p>
                    )}
                    {location.details?.description && (
                      <p style={{ marginTop: '10px', fontStyle: 'italic' }}>
                        {location.details.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeLocation(location.id)}
                    style={{
                      marginTop: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#ff0000',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Sonar Animation CSS */}
        <style>{`
          .sonar-container {
            position: relative;
            width: 40px;
            height: 40px;
          }
          
          .sonar-center {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 10px;
            height: 10px;
            background: #00ff00;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 10px #00ff00;
            z-index: 3;
          }
          
          .sonar-wave {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 10px;
            height: 10px;
            border: 2px solid #00ff00;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: sonar 2s infinite;
            opacity: 0;
          }
          
          .sonar-wave:nth-child(2) {
            animation-delay: 0.5s;
          }
          
          .sonar-wave:nth-child(3) {
            animation-delay: 1s;
          }
          
          @keyframes sonar {
            0% {
              width: 10px;
              height: 10px;
              opacity: 1;
            }
            100% {
              width: 40px;
              height: 40px;
              opacity: 0;
            }
          }
          
          .leaflet-popup-content-wrapper {
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            border: 1px solid #00ff00;
            box-shadow: 0 0 20px #00ff00;
          }
          
          .leaflet-popup-tip {
            background: rgba(0, 0, 0, 0.9);
            border-left: 1px solid #00ff00;
            border-bottom: 1px solid #00ff00;
          }
        `}</style>
      </div>
    </div>
  );
};

export default ProjectMap;