function shouldUseManualSignerFlow(body) {
  return !!body?.tx_hash;
}

module.exports = {
  shouldUseManualSignerFlow,
};
