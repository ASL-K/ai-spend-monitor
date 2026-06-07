// src/providers/registry.ts
// Provider 注册表（v0.1: 2 个）

import { DeepSeekProvider } from './deepseek.js';
import { MiniMaxProvider } from './minimax.js';
import type { Provider } from '../types.js';

const providers = new Map<string, Provider>();

providers.set('deepseek', new DeepSeekProvider());
providers.set('minimax', new MiniMaxProvider());

export function getProvider(name: string): Provider | undefined {
  return providers.get(name.toLowerCase());
}

export function listProviders(): Provider[] {
  return Array.from(providers.values());
}

export function registerProvider(provider: Provider): void {
  providers.set(provider.name.toLowerCase(), provider);
}
