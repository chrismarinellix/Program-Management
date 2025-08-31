import React, { useState } from 'react';

function TestApp() {
  const [clickCount, setClickCount] = useState(0);
  
  const handleClick = () => {
    console.log('Button clicked!');
    const newCount = clickCount + 1;
    setClickCount(newCount);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', height: '100vh' }}>
      <h1 style={{ color: 'blue' }}>Test App is Working!</h1>
      <p>If you can see this, React is loading correctly.</p>
      <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
        Click count: {clickCount}
      </p>
      <button 
        onClick={handleClick}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Click Me (Count: {clickCount})
      </button>
    </div>
  );
}

export default TestApp;