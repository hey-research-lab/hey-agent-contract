import { describe, expect, it } from 'vitest';

import {
  assertChainId,
  CAIP2,
  CHAIN_ID,
  explorerAddressUrl,
  UnsupportedChainError,
} from '../src/index';

describe('Robinhood Chain only', () => {
  it('accepts the integer 4663 and nothing else', () => {
    expect(() => assertChainId(4663)).not.toThrow();
    for (const value of [1, 8453, '4663', 4663.5, '04663', null, undefined, 46630]) {
      expect(() => assertChainId(value), String(value)).toThrow(UnsupportedChainError);
    }
  });

  it('names the chain and refuses others with unsupported_chain', () => {
    expect(CHAIN_ID).toBe(4663);
    expect(CAIP2).toBe('eip155:4663');
    const error = new UnsupportedChainError(1);
    expect(error.code).toBe('unsupported_chain');
    expect(error.message).toBe(
      'HEY supports Robinhood Chain (4663) only; chain 1 is not supported.',
    );
    expect(explorerAddressUrl('0xABC')).toBe('https://robinhoodchain.blockscout.com/address/0xabc');
  });
});
