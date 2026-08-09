import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRefreshCoordinationChannel } from './auth-refresh-coordination-channel';

describe('AuthRefreshCoordinationChannel', () => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach(() => {
    FakeBroadcastChannel.reset();
    vi.unstubAllGlobals();
  });

  it('wakes a waiter in another coordinator when a lease message is broadcast', async () => {
    const sender = new AuthRefreshCoordinationChannel();
    const receiver = new AuthRefreshCoordinationChannel();
    const waiting = receiver.waitForChange(1_000);

    sender.broadcast({
      type: 'lease-updated',
      ownerId: 'tab-a',
      leaseId: 'lease-a',
    });

    await expect(waiting).resolves.toBeUndefined();

    sender.destroy();
    receiver.destroy();
  });
});

class FakeBroadcastChannel extends EventTarget {
  private static readonly channels = new Set<FakeBroadcastChannel>();

  constructor(readonly name: string) {
    super();
    FakeBroadcastChannel.channels.add(this);
  }

  postMessage(message: unknown): void {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        channel.dispatchEvent(new MessageEvent('message', { data: message }));
      }
    }
  }

  close(): void {
    FakeBroadcastChannel.channels.delete(this);
  }

  static reset(): void {
    FakeBroadcastChannel.channels.clear();
  }
}
