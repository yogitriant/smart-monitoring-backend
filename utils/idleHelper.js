// utils/idleHelper.js
function applyIdleThreshold(idleRaw = 0, threshold = 300) {
  if (idleRaw >= threshold) {
    return { status: "idle", idleTime: idleRaw - threshold };
  }
  return { status: "online", idleTime: 0 };
}

module.exports = { applyIdleThreshold };
