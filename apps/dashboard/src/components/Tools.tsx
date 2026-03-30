import React, { useState, useEffect } from 'react';

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ExecResult {
  tool: string;
  result: unknown;
  error?: string;
}

const API_BASE = 'http://localhost:3000';

const Tools: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState<Tool | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExecResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/tools`)
      .then(r => r.json())
      .then(d => setTools(d.tools ?? []))
      .catch(() => setTools([]));
  }, []);

  const selectTool = (tool: Tool) => {
    setSelected(tool);
    setParams({});
    setResult(null);
  };

  const execute = async () => {
    if (!selected) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: selected.name, params }),
      });
      const data = await res.json();
      setResult({ tool: selected.name, result: data.result ?? data });
    } catch (err) {
      setResult({ tool: selected?.name ?? '', result: null, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const paramKeys = selected ? Object.keys(selected.parameters?.properties ?? {}) : [];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: 240, overflowY: 'auto', borderRight: '1px solid #2a2d3e', padding: '16px 0' }}>
        <div style={{ fontSize: 12, color: '#888', padding: '0 16px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Tools ({tools.length})</div>
        {tools.map(tool => (
          <div
            key={tool.name}
            onClick={() => selectTool(tool)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              background: selected?.name === tool.name ? '#2a2d3e' : 'transparent',
              color: selected?.name === tool.name ? '#7c6af7' : '#ccc',
              fontSize: 13,
              borderLeft: selected?.name === tool.name ? '3px solid #7c6af7' : '3px solid transparent',
            }}
          >
            {tool.name}
          </div>
        ))}
        {tools.length === 0 && <div style={{ color: '#555', fontSize: 13, padding: '0 16px' }}>No tools registered</div>}
      </div>
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ color: '#555', textAlign: 'center', marginTop: 60, fontSize: 14 }}>Select a tool to execute</div>
        ) : (
          <>
            <h3 style={{ color: '#7c6af7', marginBottom: 8, fontSize: 16 }}>{selected.name}</h3>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>{selected.description}</p>
            {paramKeys.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Parameters</div>
                {paramKeys.map(key => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>{key}</label>
                    <input
                      value={params[key] ?? ''}
                      onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: '100%', background: '#1e2130', border: '1px solid #3a3d5e', borderRadius: 6, color: '#e0e0e0', fontSize: 13, padding: '6px 10px', outline: 'none' }}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={execute}
              disabled={loading}
              style={{ background: '#7c6af7', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: '8px 24px', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Executing...' : 'Execute'}
            </button>
            {result && (
              <div style={{ marginTop: 20, background: '#1e2130', borderRadius: 8, padding: 16, border: '1px solid #2a2d3e' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Result</div>
                {result.error ? (
                  <div style={{ color: '#f77', fontSize: 13 }}>Error: {result.error}</div>
                ) : (
                  <pre style={{ fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{JSON.stringify(result.result, null, 2)}</pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Tools;
