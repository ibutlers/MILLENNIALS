import '@testing-library/jest-dom/vitest';

// IntersectionObserver is not available in jsdom (used by useHashScroll for active section tracking)
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'IntersectionObserver', { value: MockIntersectionObserver, writable: true });
