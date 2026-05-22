/**
 * Tests for apps/resident-app/src/lib/socket.ts
 */

const mockSocketInstance = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocketInstance),
}));

jest.mock('../src/store/auth.store', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ token: 'test-token' })),
  },
}));

describe('socket', () => {
  let getSocket: any;
  let connectSocket: any;
  let disconnectSocket: any;
  let mockIo: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.mock('socket.io-client', () => ({
      io: jest.fn(() => mockSocketInstance),
    }));
    jest.mock('../src/store/auth.store', () => ({
      useAuthStore: {
        getState: jest.fn(() => ({ token: 'test-token' })),
      },
    }));
    ({ getSocket, connectSocket, disconnectSocket } = require('../src/lib/socket'));
    mockIo = require('socket.io-client').io;
  });

  describe('getSocket', () => {
    it('creates a socket on first call', () => {
      getSocket();
      expect(mockIo).toHaveBeenCalledTimes(1);
    });

    it('returns the same socket on repeated calls (singleton)', () => {
      const s1 = getSocket();
      const s2 = getSocket();
      expect(s1).toBe(s2);
      expect(mockIo).toHaveBeenCalledTimes(1);
    });

    it('passes auth token from useAuthStore', () => {
      getSocket();
      const [, opts] = mockIo.mock.calls[0];
      expect(opts.auth).toEqual({ token: 'test-token' });
    });

    it('sets autoConnect: false', () => {
      getSocket();
      const [, opts] = mockIo.mock.calls[0];
      expect(opts.autoConnect).toBe(false);
    });

    it('uses websocket transport', () => {
      getSocket();
      const [, opts] = mockIo.mock.calls[0];
      expect(opts.transports).toEqual(['websocket']);
    });

    it('strips /v1 suffix from API URL', () => {
      jest.resetModules();
      jest.mock('socket.io-client', () => ({ io: jest.fn(() => mockSocketInstance) }));
      jest.mock('../src/store/auth.store', () => ({
        useAuthStore: { getState: jest.fn(() => ({ token: null })) },
      }));
      // Set process.env before requiring the module
      (globalThis as any).process = { env: { EXPO_PUBLIC_API_URL: 'http://api.example.com/v1' } };
      const { getSocket: gs } = require('../src/lib/socket');
      gs();
      const mockIo2 = require('socket.io-client').io;
      const [url] = mockIo2.mock.calls[0];
      expect(url).toBe('http://api.example.com');
      delete (globalThis as any).process;
    });

    it('strips /api/v1 suffix from API URL', () => {
      jest.resetModules();
      jest.mock('socket.io-client', () => ({ io: jest.fn(() => mockSocketInstance) }));
      jest.mock('../src/store/auth.store', () => ({
        useAuthStore: { getState: jest.fn(() => ({ token: null })) },
      }));
      (globalThis as any).process = { env: { EXPO_PUBLIC_API_URL: 'http://api.example.com/api/v1' } };
      const { getSocket: gs } = require('../src/lib/socket');
      gs();
      const mockIo2 = require('socket.io-client').io;
      const [url] = mockIo2.mock.calls[0];
      expect(url).toBe('http://api.example.com');
      delete (globalThis as any).process;
    });

    it('uses localhost:3000 when EXPO_PUBLIC_API_URL is not set', () => {
      jest.resetModules();
      jest.mock('socket.io-client', () => ({ io: jest.fn(() => mockSocketInstance) }));
      jest.mock('../src/store/auth.store', () => ({
        useAuthStore: { getState: jest.fn(() => ({ token: null })) },
      }));
      const { getSocket: gs } = require('../src/lib/socket');
      gs();
      const mockIo2 = require('socket.io-client').io;
      const [url] = mockIo2.mock.calls[0];
      expect(url).toBe('http://localhost:3000');
    });
  });

  describe('connectSocket', () => {
    it('calls connect on the socket', () => {
      connectSocket();
      expect(mockSocketInstance.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnectSocket', () => {
    it('calls disconnect and nulls the socket', () => {
      getSocket(); // ensure socket is set
      disconnectSocket();
      expect(mockSocketInstance.disconnect).toHaveBeenCalledTimes(1);
    });

    it('creates a new socket after disconnect', () => {
      getSocket();
      disconnectSocket();
      getSocket(); // should call io again
      expect(mockIo).toHaveBeenCalledTimes(2);
    });

    it('is safe to call when socket is null (no-op)', () => {
      // disconnectSocket before any getSocket — socket is null
      expect(() => disconnectSocket()).not.toThrow();
    });
  });
});
