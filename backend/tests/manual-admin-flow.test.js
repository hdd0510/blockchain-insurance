const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldUseManualSignerFlow,
} = require('../src/services/manual-admin-flow-service');

test('manual signer flow is enabled when tx hash is provided by frontend wallet', () => {
  assert.equal(
    shouldUseManualSignerFlow({ tx_hash: '0x' + 'a'.repeat(64) }),
    true
  );
});

test('manual signer flow is disabled when no tx hash is provided', () => {
  assert.equal(shouldUseManualSignerFlow({}), false);
});
