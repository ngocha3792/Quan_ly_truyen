import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AuthSessionLifecycleEvent,
  AuthSessionLifecycleService,
} from './auth-session-lifecycle.service';

type MessageListener = (event: MessageEvent<unknown>) => void;

class FakeBroadcastChannel {
  private static readonly rooms = new Map<string, Set<FakeBroadcastChannel>>();

  private readonly listeners = new Set<MessageListener>();

  constructor(readonly name: string) {
    let room = FakeBroadcastChannel.rooms.get(name);

    if (!room) {
      room = new Set();

      FakeBroadcastChannel.rooms.set(name, room);
    }

    room.add(this);
  }

  postMessage(data: unknown): void {
    const room = FakeBroadcastChannel.rooms.get(this.name);

    if (!room) {
      return;
    }

    for (const peer of room) {
      if (peer === this) {
        continue;
      }

      peer.dispatch(data);
    }
  }

  addEventListener(
    type: string,

    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type !== 'message' || typeof listener !== 'function') {
      return;
    }

    this.listeners.add(listener as MessageListener);
  }

  removeEventListener(
    type: string,

    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type !== 'message' || typeof listener !== 'function') {
      return;
    }

    this.listeners.delete(listener as MessageListener);
  }

  close(): void {
    const room = FakeBroadcastChannel.rooms.get(this.name);

    room?.delete(this);

    this.listeners.clear();

    if (room?.size === 0) {
      FakeBroadcastChannel.rooms.delete(this.name);
    }
  }

  static reset(): void {
    FakeBroadcastChannel.rooms.clear();
  }

  private dispatch(data: unknown): void {
    const event = { data } as MessageEvent<unknown>;

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe('AuthSessionLifecycleService', () => {
  let originalBroadcastChannel: unknown;

  beforeEach(() => {
    FakeBroadcastChannel.reset();

    (globalThis as Record<string, unknown>)['window'] = globalThis;

    originalBroadcastChannel = (globalThis as Record<string, unknown>)['BroadcastChannel'];

    (globalThis as Record<string, unknown>)['BroadcastChannel'] = FakeBroadcastChannel;
  });

  afterEach(() => {
    if (originalBroadcastChannel) {
      (globalThis as Record<string, unknown>)['BroadcastChannel'] = originalBroadcastChannel;
    } else {
      delete (globalThis as Record<string, unknown>)['BroadcastChannel'];
    }

    FakeBroadcastChannel.reset();
  });

  it('phát tín hiệu session-established khi khởi tạo session mới', () => {
    const service = new AuthSessionLifecycleService();

    const events: AuthSessionLifecycleEvent[] = [];

    service.changes$.subscribe((event) => {
      events.push(event);
    });

    service.establishSession('user-1', 'session-1');

    expect(service.scope()).toEqual({
      userId: 'user-1',

      sessionId: 'session-1',
    });

    expect(events).toHaveLength(1);

    expect(events[0].kind).toBe('session-established');

    expect(events[0].remote).toBe(false);
  });

  it('đồng bộ session-established từ tab khác qua BroadcastChannel', () => {
    const tabA = new AuthSessionLifecycleService();

    const tabB = new AuthSessionLifecycleService();

    const eventsB: AuthSessionLifecycleEvent[] = [];

    tabB.changes$.subscribe((event) => {
      eventsB.push(event);
    });

    tabA.establishSession('user-alice', 'session-alice-1');

    expect(tabB.scope()).toEqual({
      userId: 'user-alice',

      sessionId: 'session-alice-1',
    });

    expect(eventsB).toHaveLength(1);

    expect(eventsB[0].kind).toBe('session-established');

    expect(eventsB[0].remote).toBe(true);
  });

  it('đồng bộ session-cleared từ tab khác khi logout', () => {
    const tabA = new AuthSessionLifecycleService();

    const tabB = new AuthSessionLifecycleService();

    tabA.establishSession('user-1', 'session-1');

    const eventsB: AuthSessionLifecycleEvent[] = [];

    tabB.changes$.subscribe((event) => {
      eventsB.push(event);
    });

    tabA.clearSession('logout');

    expect(tabB.scope()).toBeNull();

    expect(eventsB).toHaveLength(1);

    expect(eventsB[0].kind).toBe('session-cleared');

    expect(eventsB[0].remote).toBe(true);
  });

  it('đồng bộ session-invalidated từ tab khác khi token bị từ chối', () => {
    const tabA = new AuthSessionLifecycleService();

    const tabB = new AuthSessionLifecycleService();

    tabA.establishSession('user-1', 'session-1');

    const eventsB: AuthSessionLifecycleEvent[] = [];

    tabB.changes$.subscribe((event) => {
      eventsB.push(event);
    });

    tabA.invalidateSession('refresh-session-rejected');

    expect(tabB.scope()).toBeNull();

    expect(eventsB).toHaveLength(1);

    expect(eventsB[0].kind).toBe('session-invalidated');

    expect(eventsB[0].remote).toBe(true);
  });

  it('loseAccess không broadcast sang tab khác', () => {
    const tabA = new AuthSessionLifecycleService();

    const tabB = new AuthSessionLifecycleService();

    tabA.establishSession('user-1', 'session-1');

    const eventsB: AuthSessionLifecycleEvent[] = [];

    tabB.changes$.subscribe((event) => {
      eventsB.push(event);
    });

    tabA.loseAccess('network-failure');

    expect(tabA.scope()).toBeNull();

    expect(eventsB).toHaveLength(0);
  });
});
