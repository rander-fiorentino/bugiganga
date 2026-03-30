import React, { useState, useEffect } from 'react';

interface MemoryEntry {
  id: string;
  content: string;
  score: number;
  timestamp: string;
}

const API_BASE = 'http://localhost:3000';

const Memory: React.FC = () => {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MemoryEntry[]>([]);

  const loadAll = async () => {
    try {
      const res = await fetch(`${API_BASE}/memory`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      setEntries([]);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    await fetch(`${API_BASE}/memory`, { method: 'DELETE' });
    setEntries([]);
    setSearchResults([]);
  };

  const displayEntries = query && searchResults.length > 0 ? searchResults : entries;

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search memories..."
          style={{
            flex: 1,
            background: '#1e2130',
            border: '1px solid #3a3d5e',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: 14,
            padding: '8px 12px',
            outline: 'none',
          }}
        />
        <button onClick={search} disabled={loading} style={{ background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '8px 16px', fontWeight: 600, fontSize: 14 }}>
          Search
        </button>
        <button onClick={loadAll} style={{ background: '#2a2d3e', border: 'none', borderRadius: 8, color: '#aaa', cursor: 'pointer', padding: '8px 16px', fontSize: 14 }}>
          Refresh
        </button>
        <button onClick={clear} style={{ background: '#3e1a1a', border: 'none', borderRadius: 8, color: '#f77', cursor: 'pointer', padding: '8px 16px', fontSize: 14 }}>
          Clear
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
        {query && searchResults.length > 0 ? `${searchResults.length} results for "${query}"` : `${entries.length} memory entries`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayEntries.map(entry => (
          <div key={entry.id} style={{ background: '#1e2130', borderRadius: 8, padding: '12px 16px', border: '1px solid #2a2d3e' }}>
            <div style={{ fontSize: 14, color: '#e0e0e0', lineHeight: 1.5 }}>{entry.content}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
              <span>Score: {entry.score?.toFixed(3) ?? 'N/A'}</span>
              <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</span>
            </div>
          </div>
        ))}
        {displayEntries.length === 0 && (
          <div style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>No memory entries found</div>
        )}
      </div>
    </div>
  );
};

export default Memory;
