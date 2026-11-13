import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub;

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
