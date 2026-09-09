export const PAYMENT_ROLLOUT_PORT = Symbol('PAYMENT_ROLLOUT_PORT');
export interface PaymentRolloutPort {
  get(storyId: string): Promise<{
    storyId: string;
    isEnabled: boolean;
    enabledProviders: string[];
  }>;
  update(
    actorId: string,
    storyId: string,
    input: { isEnabled: boolean; enabledProviders: string[] },
  ): Promise<{
    storyId: string;
    isEnabled: boolean;
    enabledProviders: string[];
  }>;
  allowed(storyId: string | undefined): Promise<boolean>;
}
