(function attachMetricsExporter(global) {
  const STORAGE_KEY = "sgoa-pending-metrics-downloads";

  function sanitizeTimestamp(value) {
    return String(value || "session")
      .replace(/[:.]/g, "-")
      .replace("T", "_");
  }

  function buildFilename(payload) {
    return `metrics-${payload.uiVersion}-${sanitizeTimestamp(payload.finishedAt || payload.startedAt)}.json`;
  }

  function readQueue() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeQueue(queue) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore storage failures and keep the session alive.
    }
  }

  function queueMetricsExport(payload) {
    const queue = readQueue();
    queue.push({
      filename: buildFilename(payload),
      payload,
    });
    writeQueue(queue);
  }

  function triggerDownload(item) {
    const blob = new Blob([JSON.stringify(item.payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = item.filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function flushQueuedMetricExports() {
    const queue = readQueue();

    if (!queue.length) {
      return;
    }

    writeQueue([]);
    global.setTimeout(() => {
      queue.forEach((item) => {
        triggerDownload(item);
      });
    }, 150);
  }

  global.SGOAExporter = {
    queueMetricsExport,
    flushQueuedMetricExports,
  };
}(window));
