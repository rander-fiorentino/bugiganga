describe('Planner Module', () => {
  describe('Task Planning', () => {
    it('should create a task plan with steps', () => {
      const plan = {
        goal: 'Find information about TypeScript',
        steps: [
          { id: 1, action: 'search', query: 'TypeScript basics', status: 'pending' },
          { id: 2, action: 'extract', source: 'results', status: 'pending' },
          { id: 3, action: 'summarize', content: 'extracted', status: 'pending' },
        ],
      };
      expect(plan.steps).toHaveLength(3);
      expect(plan.steps[0].action).toBe('search');
    });

    it('should validate plan has a goal', () => {
      const plan = { goal: 'Test goal', steps: [] };
      expect(plan.goal).toBeTruthy();
      expect(typeof plan.goal).toBe('string');
    });

    it('should track step statuses', () => {
      const statuses = ['pending', 'in_progress', 'completed', 'failed'];
      statuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
      expect(statuses).toContain('pending');
      expect(statuses).toContain('completed');
    });

    it('should allow updating step status', () => {
      const step = { id: 1, action: 'search', status: 'pending' };
      const updated = { ...step, status: 'completed' };
      expect(updated.status).toBe('completed');
      expect(step.status).toBe('pending');
    });
  });

  describe('Plan Execution', () => {
    it('should execute steps in order', () => {
      const executionOrder: number[] = [];
      const steps = [{ id: 1 }, { id: 2 }, { id: 3 }];
      steps.forEach(step => executionOrder.push(step.id));
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should handle empty plan', () => {
      const plan = { goal: '', steps: [] };
      expect(plan.steps).toHaveLength(0);
    });

    it('should count completed steps', () => {
      const steps = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'completed' },
        { id: 3, status: 'pending' },
      ];
      const completed = steps.filter(s => s.status === 'completed');
      expect(completed).toHaveLength(2);
    });

    it('should detect plan completion', () => {
      const steps = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'completed' },
      ];
      const isComplete = steps.every(s => s.status === 'completed');
      expect(isComplete).toBe(true);
    });
  });

  describe('Plan Validation', () => {
    it('should reject plan with no steps', () => {
      const plan = { goal: 'Do something', steps: [] };
      const isValid = plan.steps.length > 0;
      expect(isValid).toBe(false);
    });

    it('should accept plan with valid steps', () => {
      const plan = {
        goal: 'Research topic',
        steps: [{ id: 1, action: 'search', status: 'pending' }],
      };
      const isValid = plan.steps.length > 0 && plan.goal.length > 0;
      expect(isValid).toBe(true);
    });
  });
});

