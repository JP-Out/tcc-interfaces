(function attachCommonMetrics(global) {
  function createMetricsSession({ uiVersion, taskId = "main-flow" }) {
    const metrics = {
      sessionId: `${uiVersion}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uiVersion,
      taskId,
      startedAt: null,
      finishedAt: null,
      clickCount: 0,
      errorCount: 0,
      navigationPath: [],
      errors: [],
    };

    function ensureStart() {
      if (!metrics.startedAt) {
        metrics.startedAt = new Date().toISOString();
      }
    }

    return {
      hasStarted() {
        return Boolean(metrics.startedAt);
      },

      start() {
        ensureStart();
        return this;
      },

      trackClick() {
        if (!metrics.startedAt || metrics.finishedAt) {
          return;
        }

        ensureStart();
        metrics.clickCount += 1;
      },

      trackError(type = "generic") {
        if (!metrics.startedAt || metrics.finishedAt) {
          return;
        }

        ensureStart();
        metrics.errorCount += 1;
        metrics.errors.push({
          type,
          at: new Date().toISOString(),
        });
      },

      trackView(viewName) {
        if (!metrics.startedAt || metrics.finishedAt) {
          return;
        }

        ensureStart();

        if (!viewName) {
          return;
        }

        const lastView = metrics.navigationPath[metrics.navigationPath.length - 1];

        if (lastView !== viewName) {
          metrics.navigationPath.push(viewName);
        }
      },

      finish() {
        ensureStart();

        if (!metrics.finishedAt) {
          metrics.finishedAt = new Date().toISOString();
        }

        return this.toJSON();
      },

      toJSON() {
        const startedAt = metrics.startedAt ? new Date(metrics.startedAt) : null;
        const finishedAt = metrics.finishedAt ? new Date(metrics.finishedAt) : new Date();

        return {
          sessionId: metrics.sessionId,
          uiVersion: metrics.uiVersion,
          taskId: metrics.taskId,
          startedAt: metrics.startedAt,
          finishedAt: metrics.finishedAt,
          durationMs: startedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : 0,
          clickCount: metrics.clickCount,
          errorCount: metrics.errorCount,
          navigationPath: metrics.navigationPath.slice(),
          errors: metrics.errors.map((error) => ({ ...error })),
        };
      },
    };
  }

  global.SGOAMetrics = {
    createMetricsSession,
  };
}(window));
