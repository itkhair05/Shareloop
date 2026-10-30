import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  ResizeObserverMock.instances = [];
});

class ResizeObserverMock {
  callback: ResizeObserverCallback;
  static instances: ResizeObserverMock[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(_target: Element) {}
  unobserve(_target: Element) {}
  disconnect() {
    const idx = ResizeObserverMock.instances.indexOf(this);
    if (idx !== -1) {
      ResizeObserverMock.instances.splice(idx, 1);
    }
  }

  trigger(entries: Partial<ResizeObserverEntry>[]) {
    this.callback(entries as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
}
