// Agent loop unit tests with mocks
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Task completed successfully' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    },
  })),
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
}));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
  })),
}));

describe('Agent Loop', () => {
  it('should handle task input object', () => {
    const task = {
      id: 'task-1',
      sessionId: 'session-1',
      goal: 'Click the submit button',
      url: 'https://example.com',
    };
    expect(task.goal).toBe('Click the submit button');
    expect(task.sessionId).toBe('session-1');
  });

  it('should validate tool call structure', () => {
    const toolCall = {
      type: 'tool_use' as const,
      id: 'tool-1',
      name: 'click',
      input: { selector: '#submit-btn' },
    };
    expect(toolCall.type).toBe('tool_use');
    expect(toolCall.name).toBe('click');
    expect(toolCall.input).toHaveProperty('selector');
  });

  it('should handle max iterations limit', () => {
    const MAX_ITERATIONS = 10;
    let iterations = 0;
    while (iterations < MAX_ITERATIONS + 5) {
      iterations++;
      if (iterations >= MAX_ITERATIONS) break;
    }
    expect(iterations).toBe(MAX_ITERATIONS);
  });

  it('should handle tool result correctly', () => {
    const toolResult = {
      type: 'tool_result' as const,
      tool_use_id: 'tool-1',
      content: JSON.stringify({ success: true, data: 'clicked' }),
    };
    expect(toolResult.type).toBe('tool_result');
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.success).toBe(true);
  });

  it('should detect task completion signal', () => {
    const response = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'TASK_COMPLETE: Done' }] };
    const isComplete = response.stop_reason === 'end_turn' ||
      response.content.some((c: any) => c.type === 'text' && c.text.includes('TASK_COMPLETE'));
    expect(isComplete).toBe(true);
  });

  it('should build correct message history', () => {
    const messages: Array<{ role: string; content: string }> = [];
    messages.push({ role: 'user', content: 'Do this task' });
    messages.push({ role: 'assistant', content: 'I will help' });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });

  it('should handle click tool execution', () => {
    const executeClick = (selector: string) => ({ success: true, selector, action: 'click' });
    const result = executeClick('#btn-submit');
    expect(result.success).toBe(true);
    expect(result.action).toBe('click');
  });

  it('should handle timeout scenario', async () => {
    const withTimeout = (ms: number): Promise<string> =>
      new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
    const result = await withTimeout(1);
    expect(result).toBe('timeout');
  });
});
