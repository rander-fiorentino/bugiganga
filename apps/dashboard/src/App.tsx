import React, { useState } from 'react';
import Chat from './components/Chat';
import Memory from './components/Memory';
import Tools from './components/Tools';

type Tab = 'chat' | 'memory' | 'tools';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif', background: '#0f1117', color: '#e0e0e0' }}>
      <header style={{ padding: '12px 24px', background: '#1a1d2e', borderBottom: '1px solid #2a2d3e', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 20, color: '#7c6af7' }}>VIDE IA</span>
        <span style={{ color: '#888', fontSize: 13 }}>Dashboard</span>
      </header>
      <nav style={{ display: 'flex', gap: 4, padding: '8px 24px', background: '#1a1d2e', borderBottom: '1px solid #2a2d3e' }}>
        {(['chat', 'memory', 'tools'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 18px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab ? '#7c6af7' : 'transparent',
              color: activeTab === tab ? '#fff' : '#aaa',
              fontWeight: activeTab === tab ? 700 : 400,
              fontSize: 14,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'memory' && <Memory />}
        {activeTab === 'tools' && <Tools />}
      </main>
    </div>
  );
};

export default App;
