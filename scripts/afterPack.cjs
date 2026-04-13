/**
 * afterPack hook — strips the ad-hoc code signature from the macOS app bundle
 * before electron-builder zips it for auto-updates.
 *
 * Without this, Squirrel.Mac (ShipIt) rejects the update because the app has
 * an invalid partial signature (no Developer ID cert) that fails validation.
 * Stripping it entirely lets ShipIt install unsigned apps without complaint.
 */
const { execSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.packager.platform.name !== "mac") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  try {
    execSync(`codesign --remove-signature "${appPath}"`, { stdio: "pipe" });
    console.log(`  • stripped code signature from ${appName}.app`);
  } catch {
    // No signature present — nothing to strip, that's fine
  }
};
