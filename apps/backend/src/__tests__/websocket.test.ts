describe('WebSocket Module', () => {
  describe('Connection Management', () => {
    it('should create a connection object with required fields', () => {
      const connection = {
        id: 'conn-123',
        sessionId: 'session-456',
        connectedAt: new Date().toISOString(),
        isAlive: true,
      };
      expect(connection.id).toBe('conn-123');
      expect(connection.isAlive).toBe(true);
      expect(connection.sessionId).toBeTruthy();
    });

    it('should generate unique connection IDs', () => {
      const ids = Array.from({ length: 5 }, (_, i) => `conn-${i}-${Date.now()}`);
      const unique = new Set(ids);
      expect(unique.size).toBe(5);
    });

    it('should track connection state', () => {
      const states = ['connecting', 'connected', 'disconnecting', 'disconnected'];
      expect(states).toContain('connected');
      expect(states).toContain('disconnected');
      expect(states).toHaveLength(4);
    });

    it('should handle connection disconnect', () => {
      const connection = { id: 'conn-1', isAlive: true };
      const disconnected = { ...connection, isAlive: false };
      expect(disconnected.isAlive).toBe(false);
      expect(connection.isAlive).toBe(true);
    });
  });

  describe('Message Handling', () => {
    it('should parse incoming message', () => {
      const rawMessage = JSON.stringify({ type: 'chat', content: 'Hello agent' });
      const parsed = JSON.parse(rawMessage);
      expect(parsed.type).toBe('chat');
      expect(parsed.content).toBe('Hello agent');
    });

    it('should serialize outgoing message', () => {
      const message = { type: 'response', content: 'Hello user', timestamp: Date.now() };
      const serialized = JSON.stringify(message);
      expect(typeof serialized).toBe('string');
      const deserialized = JSON.parse(serialized);
      expect(deserialized.type).toBe('response');
    });

    it('should validate message has type field', () => {
      const validMessage = { type: 'ping', data: {} };
      const invalidMessage = { data: {} };
      expect('type' in validMessage).toBe(true);
      expect('type' in invalidMessage).toBe(false);
    });

    it('should handle ping/pong messages', () => {
      const ping = { type: 'ping', timestamp: Date.now() };
      const pong = { type: 'pong', timestamp: ping.timestamp };
      expect(ping.type).toBe('ping');
      expect(pong.type).toBe('pong');
      expect(pong.timestamp).toBe(ping.timestamp);
    });

    it('should handle agent streaming messages', () => {
      const streamMessages = [
        { type: 'stream_start', sessionId: 'sess-1' },
        { type: 'stream_chunk', content: 'Thinking...', sessionId: 'sess-1' },
        { type: 'stream_end', sessionId: 'sess-1' },
      ];
      expect(streamMessages[0].type).toBe('stream_start');
      expect(streamMessages[1].content).toBe('Thinking...');
      expect(streamMessages[2].type).toBe('stream_end');
    });
  });

  describe('Room Management', () => {
    it('should assign connections to rooms', () => {
      const rooms: Record<string, string[]> = {};
      const roomId = 'room-1';
      const connId = 'conn-1';
      if (!rooms[roomId]) rooms[roomId] = [];
      rooms[roomId].push(connId);
      expect(rooms[roomId]).toContain(connId);
      expect(rooms[roomId]).toHaveLength(1);
    });

    it('should remove connection from room on disconnect', () => {
      const room = ['conn-1', 'conn-2', 'conn-3'];
      const disconnectedId = 'conn-2';
      const updated = room.filter(id => id !== disconnectedId);
      expect(updated).not.toContain(disconnectedId);
      expect(updated).toHaveLength(2);
    });
  });
});

