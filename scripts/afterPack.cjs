/**
 * afterPack hook — intentionally a no-op.
 *
 * We previously stripped the ad-hoc signature here so Squirrel.Mac (ShipIt)
 * would not reject the update. However, completely removing the signature
 * causes macOS to refuse to open the app at all ("can't be opened").
 *
 * Since v1.1.6 we bypass Squirrel entirely with a custom shell-script
 * installer on macOS, so we no longer need to strip the signature.
 * The ad-hoc signature applied by electron-builder is sufficient for
 * the app to run (users right-click → Open on first launch to pass Gatekeeper).
 */
exports.default = async function afterPack(_context) {
  // no-op
};
