(function attachCommonMetrics(global) {
  const DEFAULT_MOUSE_TRACKING_OPTIONS = {
    sampleIntervalMs: 120,
    minDistancePx: 10,
    maxSamples: 6000,
    maxClickEvents: 500,
    maxViewportEvents: 24,
  };

  function normalizeNumber(value) {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function normalizeDevicePixelRatio(value) {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : 1;
  }

  function readSearchParams() {
    try {
      return new URLSearchParams(global.location ? global.location.search : "");
    } catch {
      return new URLSearchParams();
    }
  }

  function readLocalStorageValue(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : "";
    } catch {
      return "";
    }
  }

  function writeLocalStorageValue(key, value) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage failures; device metadata is best-effort.
    }
  }

  function getConfiguredComputerName() {
    const searchParams = readSearchParams();
    const parameterNames = ["computerName", "deviceName", "machineName", "stationName"];

    for (const name of parameterNames) {
      const value = String(searchParams.get(name) || "").trim();

      if (value) {
        writeLocalStorageValue("sgoa-computer-name", value);
        return {
          value,
          source: `query:${name}`,
        };
      }
    }

    const storageKeys = ["sgoa-computer-name", "computerName", "deviceName", "machineName", "stationName"];

    for (const key of storageKeys) {
      const value = String(readLocalStorageValue(key) || "").trim();

      if (value) {
        return {
          value,
          source: `localStorage:${key}`,
        };
      }
    }

    return {
      value: null,
      source: "unavailable",
    };
  }

  function getNavigatorPlatform(navigatorRef) {
    if (!navigatorRef) {
      return null;
    }

    if (navigatorRef.userAgentData && navigatorRef.userAgentData.platform) {
      return navigatorRef.userAgentData.platform;
    }

    return navigatorRef.platform || null;
  }

  function createDeviceInfo() {
    const computerName = getConfiguredComputerName();
    const navigatorRef = global.navigator || null;
    const screenRef = global.screen || null;
    const timeZone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch {
        return null;
      }
    })();

    return {
      computerName: computerName.value,
      computerNameSource: computerName.source,
      platform: getNavigatorPlatform(navigatorRef),
      userAgent: navigatorRef ? navigatorRef.userAgent || null : null,
      language: navigatorRef ? navigatorRef.language || null : null,
      languages: navigatorRef && Array.isArray(navigatorRef.languages)
        ? navigatorRef.languages.slice()
        : [],
      timeZone,
      hardwareConcurrency: navigatorRef && Number.isFinite(navigatorRef.hardwareConcurrency)
        ? navigatorRef.hardwareConcurrency
        : null,
      deviceMemory: navigatorRef && Number.isFinite(navigatorRef.deviceMemory)
        ? navigatorRef.deviceMemory
        : null,
      maxTouchPoints: navigatorRef && Number.isFinite(navigatorRef.maxTouchPoints)
        ? navigatorRef.maxTouchPoints
        : null,
      screen: screenRef
        ? {
          width: normalizeNumber(screenRef.width),
          height: normalizeNumber(screenRef.height),
          availWidth: normalizeNumber(screenRef.availWidth),
          availHeight: normalizeNumber(screenRef.availHeight),
          colorDepth: normalizeNumber(screenRef.colorDepth),
          pixelDepth: normalizeNumber(screenRef.pixelDepth),
        }
        : null,
    };
  }

  function createMetricsSession({
    uiVersion,
    taskId = "main-flow",
    mouseTrackingOptions = {},
  }) {
    const mouseTrackingConfig = {
      ...DEFAULT_MOUSE_TRACKING_OPTIONS,
      ...mouseTrackingOptions,
    };

    const metrics = {
      sessionId: `${uiVersion}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uiVersion,
      taskId,
      deviceInfo: createDeviceInfo(),
      objectiveProfileId: null,
      objectiveSets: [],
      currentObjectiveId: null,
      allObjectivesTerminal: false,
      startedAt: null,
      finishedAt: null,
      clickCount: 0,
      errorCount: 0,
      navigationPath: [],
      errors: [],
      currentView: null,
      mouseTracking: {
        enabled: true,
        sampleIntervalMs: mouseTrackingConfig.sampleIntervalMs,
        minDistancePx: mouseTrackingConfig.minDistancePx,
        maxSamples: mouseTrackingConfig.maxSamples,
        maxClickEvents: mouseTrackingConfig.maxClickEvents,
        pointSchema: ["elapsedMs", "x", "y", "viewIndex"],
        clickSchema: ["elapsedMs", "x", "y", "viewIndex"],
        viewportSchema: ["elapsedMs", "width", "height", "devicePixelRatio"],
        views: [],
        points: [],
        clickEvents: [],
        viewportChanges: [],
        droppedSamples: 0,
        droppedClickEvents: 0,
        droppedViewportChanges: 0,
      },
    };
    let startedAtMs = null;
    let lastMouseSample = null;
    let lastViewportSnapshot = null;

    function ensureStart() {
      if (!metrics.startedAt) {
        startedAtMs = Date.now();
        metrics.startedAt = new Date().toISOString();
      }
    }

    function isActive() {
      return Boolean(metrics.startedAt) && !metrics.finishedAt;
    }

    function getElapsedMs(nowMs = Date.now()) {
      return startedAtMs ? Math.max(0, nowMs - startedAtMs) : 0;
    }

    function ensureViewIndex(viewName) {
      if (!viewName) {
        return -1;
      }

      const knownViews = metrics.mouseTracking.views;
      const existingIndex = knownViews.indexOf(viewName);

      if (existingIndex >= 0) {
        return existingIndex;
      }

      knownViews.push(viewName);
      return knownViews.length - 1;
    }

    return {
      hasStarted() {
        return Boolean(metrics.startedAt);
      },

      start() {
        ensureStart();
        return this;
      },

      setResearchObjectives(details = null) {
        if (!details) {
          metrics.objectiveProfileId = null;
          metrics.objectiveSets = [];
          metrics.currentObjectiveId = null;
          metrics.allObjectivesTerminal = false;
          return this;
        }

        metrics.objectiveProfileId = details.objectiveProfileId || null;
        metrics.objectiveSets = Array.isArray(details.objectiveSets)
          ? details.objectiveSets.map((set) => ({
            ...set,
            objectives: Array.isArray(set.objectives)
              ? set.objectives.map((objective) => ({ ...objective }))
              : [],
          }))
          : [];
        metrics.currentObjectiveId = details.currentObjectiveId || null;
        metrics.allObjectivesTerminal = Boolean(details.allObjectivesTerminal);
        return this;
      },

      trackClick() {
        let details = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

        if (!isActive()) {
          return;
        }

        ensureStart();
        metrics.clickCount += 1;

        if (!details || metrics.mouseTracking.clickEvents.length >= mouseTrackingConfig.maxClickEvents) {
          if (details && metrics.mouseTracking.clickEvents.length >= mouseTrackingConfig.maxClickEvents) {
            metrics.mouseTracking.droppedClickEvents += 1;
          }
          return;
        }

        const x = normalizeNumber(details.x);
        const y = normalizeNumber(details.y);

        if (x === null || y === null) {
          return;
        }

        const nowMs = Date.now();
        const viewIndex = ensureViewIndex(details.viewName || metrics.currentView);
        metrics.mouseTracking.clickEvents.push([getElapsedMs(nowMs), x, y, viewIndex]);
      },

      trackError(type = "generic") {
        if (!isActive()) {
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
        if (!isActive()) {
          return;
        }

        ensureStart();

        if (!viewName) {
          return;
        }

        metrics.currentView = viewName;
        ensureViewIndex(viewName);

        const lastView = metrics.navigationPath[metrics.navigationPath.length - 1];

        if (lastView !== viewName) {
          metrics.navigationPath.push(viewName);
        }
      },

      trackMousePosition(details = null) {
        if (!isActive() || !details) {
          return;
        }

        const x = normalizeNumber(details.x);
        const y = normalizeNumber(details.y);

        if (x === null || y === null) {
          return;
        }

        ensureStart();

        const nowMs = Date.now();
        const elapsedMs = getElapsedMs(nowMs);
        const viewIndex = ensureViewIndex(details.viewName || metrics.currentView);

        if (lastMouseSample) {
          const elapsedSinceLastSample = nowMs - lastMouseSample.recordedAtMs;
          const deltaX = x - lastMouseSample.x;
          const deltaY = y - lastMouseSample.y;
          const distance = Math.hypot(deltaX, deltaY);

          if (
            elapsedSinceLastSample < mouseTrackingConfig.sampleIntervalMs
            || distance < mouseTrackingConfig.minDistancePx
          ) {
            return;
          }
        }

        if (metrics.mouseTracking.points.length >= mouseTrackingConfig.maxSamples) {
          metrics.mouseTracking.droppedSamples += 1;
          return;
        }

        metrics.mouseTracking.points.push([elapsedMs, x, y, viewIndex]);
        lastMouseSample = {
          recordedAtMs: nowMs,
          x,
          y,
        };
      },

      trackViewport(details = null) {
        if (!isActive() || !details) {
          return;
        }

        const width = normalizeNumber(details.width);
        const height = normalizeNumber(details.height);

        if (width === null || height === null) {
          return;
        }

        ensureStart();

        const snapshot = {
          width,
          height,
          devicePixelRatio: normalizeDevicePixelRatio(details.devicePixelRatio),
        };

        if (
          lastViewportSnapshot
          && lastViewportSnapshot.width === snapshot.width
          && lastViewportSnapshot.height === snapshot.height
          && lastViewportSnapshot.devicePixelRatio === snapshot.devicePixelRatio
        ) {
          return;
        }

        if (metrics.mouseTracking.viewportChanges.length >= mouseTrackingConfig.maxViewportEvents) {
          metrics.mouseTracking.droppedViewportChanges += 1;
          return;
        }

        metrics.mouseTracking.viewportChanges.push([
          getElapsedMs(),
          snapshot.width,
          snapshot.height,
          snapshot.devicePixelRatio,
        ]);
        lastViewportSnapshot = snapshot;
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
          computerName: metrics.deviceInfo.computerName,
          deviceInfo: { ...metrics.deviceInfo },
          objectiveProfileId: metrics.objectiveProfileId,
          objectiveSets: metrics.objectiveSets.map((set) => ({
            ...set,
            objectives: set.objectives.map((objective) => ({ ...objective })),
          })),
          currentObjectiveId: metrics.currentObjectiveId,
          allObjectivesTerminal: metrics.allObjectivesTerminal,
          startedAt: metrics.startedAt,
          finishedAt: metrics.finishedAt,
          durationMs: startedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : 0,
          clickCount: metrics.clickCount,
          errorCount: metrics.errorCount,
          navigationPath: metrics.navigationPath.slice(),
          errors: metrics.errors.map((error) => ({ ...error })),
          mouseTracking: {
            enabled: metrics.mouseTracking.enabled,
            sampleIntervalMs: metrics.mouseTracking.sampleIntervalMs,
            minDistancePx: metrics.mouseTracking.minDistancePx,
            maxSamples: metrics.mouseTracking.maxSamples,
            maxClickEvents: metrics.mouseTracking.maxClickEvents,
            pointSchema: metrics.mouseTracking.pointSchema.slice(),
            clickSchema: metrics.mouseTracking.clickSchema.slice(),
            viewportSchema: metrics.mouseTracking.viewportSchema.slice(),
            views: metrics.mouseTracking.views.slice(),
            points: metrics.mouseTracking.points.map((point) => point.slice()),
            clickEvents: metrics.mouseTracking.clickEvents.map((click) => click.slice()),
            viewportChanges: metrics.mouseTracking.viewportChanges.map((change) => change.slice()),
            droppedSamples: metrics.mouseTracking.droppedSamples,
            droppedClickEvents: metrics.mouseTracking.droppedClickEvents,
            droppedViewportChanges: metrics.mouseTracking.droppedViewportChanges,
          },
        };
      },
    };
  }

  global.SGOAMetrics = {
    createMetricsSession,
  };
}(window));
