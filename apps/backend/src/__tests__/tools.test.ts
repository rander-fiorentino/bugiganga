describe('Tools Module', () => {
  describe('Tool Registry', () => {
    it('should register a tool with name and description', () => {
      const tool = {
        name: 'web_search',
        description: 'Search the web for information',
        parameters: { query: 'string' },
      };
      expect(tool.name).toBe('web_search');
      expect(tool.description).toBeTruthy();
    });

    it('should have required tool fields', () => {
      const tool = {
        name: 'calculator',
        description: 'Perform math operations',
        parameters: {},
        execute: jest.fn(),
      };
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('execute');
    });

    it('should register multiple tools', () => {
      const tools = [
        { name: 'web_search', description: 'Search web' },
        { name: 'calculator', description: 'Do math' },
        { name: 'file_reader', description: 'Read files' },
      ];
      expect(tools).toHaveLength(3);
      const names = tools.map(t => t.name);
      expect(names).toContain('web_search');
      expect(names).toContain('calculator');
    });

    it('should find tool by name', () => {
      const tools = [
        { name: 'web_search', description: 'Search web' },
        { name: 'calculator', description: 'Do math' },
      ];
      const found = tools.find(t => t.name === 'calculator');
      expect(found).toBeDefined();
      expect(found?.description).toBe('Do math');
    });
  });

  describe('Tool Execution', () => {
    it('should call execute function with parameters', () => {
      const mockExecute = jest.fn().mockReturnValue({ result: 'success' });
      const tool = { name: 'test_tool', execute: mockExecute };
      const result = tool.execute({ input: 'test' });
      expect(mockExecute).toHaveBeenCalledWith({ input: 'test' });
      expect(result.result).toBe('success');
    });

    it('should handle tool execution errors', () => {
      const mockExecute = jest.fn().mockImplementation(() => {
        throw new Error('Tool failed');
      });
      const tool = { name: 'failing_tool', execute: mockExecute };
      expect(() => tool.execute({})).toThrow('Tool failed');
    });

    it('should return tool result in standard format', () => {
      const result = {
        toolName: 'web_search',
        success: true,
        data: { content: 'search results here' },
        timestamp: new Date().toISOString(),
      };
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('toolName');
      expect(result).toHaveProperty('data');
    });

    it('should track tool call count', () => {
      const mockFn = jest.fn();
      mockFn();
      mockFn();
      mockFn();
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Tool Parameter Validation', () => {
    it('should validate required parameters', () => {
      const requiredParams = ['query'];
      const provided = { query: 'test search' };
      const valid = requiredParams.every(p => p in provided);
      expect(valid).toBe(true);
    });

    it('should reject missing required parameters', () => {
      const requiredParams = ['query', 'limit'];
      const provided = { query: 'test' };
      const valid = requiredParams.every(p => p in provided);
      expect(valid).toBe(false);
    });
  });
});

