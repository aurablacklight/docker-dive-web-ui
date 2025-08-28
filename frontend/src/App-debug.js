import React from 'react';

function App() {
  return (
    <div style={{
      backgroundColor: 'white',
      color: 'black',
      padding: '20px',
      minHeight: '100vh',
      fontSize: '24px'
    }}>
      <h1>Dive Docker Image Inspector - DEBUG</h1>
      <p>If you can see this, React is working!</p>
      <button onClick={() => alert('Button clicked!')}>
        Test Button
      </button>
    </div>
  );
}

export default App;
