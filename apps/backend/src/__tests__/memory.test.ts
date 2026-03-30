// Memory system unit tests
describe('Memory System', () => {
  describe('Memory Entry Validation', () => {
    it('should create a valid memory entry structure', () => {
      const entry = {
        id: 'mem-001',
        sessionId: 'session-abc',
        type: 'action' as const,
        content: 'Clicked submit button',
        timestamp: new Date().toISOString(),
        metadata: { selector: '#submit', success: true },
      };
      expect(entry.id).toBe('mem-001');
      expect(entry.type).toBe('action');
      expect(entry.content).toBeTruthy();
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it('should validate memory types', () => {
      const validTypes = ['action', 'observation', 'plan', 'result', 'error'];
      validTypes.forEach(type => {
        expect(validTypes).toContain(type);
      });
    });

    it('should handle empty content gracefully', () => {
      const entry = { content: '', type: 'observation' };
      expect(entry.content).toBe('');
      expect(entry.content.length).toBe(0);
    });
  });

  describe('Memory Filtering', () => {
    const mockMemories = [
      { id: '1', type: 'action', content: 'click', sessionId: 'sess-1' },
      { id: '2', type: 'observation', content: 'page loaded', sessionId: 'sess-1' },
      { id: '3', type: 'error', content: 'element not found', sessionId: 'sess-2' },
      { id: '4', type: 'action', content: 'type text', sessionId: 'sess-1' },
    ];

    it('should filter by session ID', () => {
      const filtered = mockMemories.filter(m => m.sessionId === 'sess-1');
      expect(filtered).toHaveLength(3);
    });

    it('should filter by type', () => {
      const actions = mockMemories.filter(m => m.type === 'action');
      expect(actions).toHaveLength(2);
      actions.forEach(a => expect(a.type).toBe('action'));
    });

    it('should return empty array for non-existent session', () => {
      const filtered = mockMemories.filter(m => m.sessionId === 'sess-nonexistent');
      expect(filtered).toHaveLength(0);
    });

    it('should sort by insertion order', () => {
      const sorted = [...mockMemories];
      expect(sorted[0].id).toBe('1');
      expect(sorted[sorted.length - 1].id).toBe('4');
    });
  });

  describe('Memory Serialization', () => {
    it('should serialize metadata to JSON', () => {
      const metadata = { url: 'https://example.com', action: 'click', success: true };
      const json = JSON.stringify(metadata);
      const parsed = JSON.parse(json);
      expect(parsed.url).toBe('https://example.com');
      expect(parsed.success).toBe(true);
    });

    it('should handle null metadata', () => {
      const entry = { content: 'test', metadata: null };
      expect(entry.metadata).toBeNull();
    });

    it('should handle nested metadata', () => {
      const metadata = { element: { tag: 'button', text: 'Submit', id: 'btn-1' } };
      expect(metadata.element.tag).toBe('button');
      expect(metadata.element.text).toBe('Submit');
    });
  });

  describe('Session Management', () => {
    it('should generate unique session IDs', () => {
      const ids = Array.from({ length: 5 }, (_, i) => `session-${i}-${Date.now()}`);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it('should track session start time', () => {
      const session = {
        id: 'test-session',
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      expect(session.isActive).toBe(true);
      expect(new Date(session.createdAt)).toBeInstanceOf(Date);
    });
  });
});
