(function bootstrapV2App(global, documentRef) {
  const { createAppController } = global.SGOALogic;
  const { createMetricsSession } = global.SGOAMetrics;
  const { flushQueuedMetricExports, queueMetricsExport } = global.SGOAExporter;
  const { createV2Renderer } = global.SGOARenderers;

  const renderer = createV2Renderer(documentRef);
  const metrics = createMetricsSession({
    uiVersion: "v2",
    taskId: "main-flow",
  });

  const controller = createAppController({
    uiVersion: "v2",
    metrics,
    onToast: (toast) => renderer.showToast(toast),
  });

  const { elements } = renderer;
  const loginUserInput = documentRef.querySelector("#login-user-input");
  const researchStartButton = documentRef.querySelector("#research-start-button");
  const loginSubmitButton = documentRef.querySelector("#login-submit");
  const loginResetButton = documentRef.querySelector("#login-reset");
  const participantModifyButton = documentRef.querySelector(".participant-link");
  const officeModalClose = documentRef.querySelector("#office-modal-close");
  const officeModal = documentRef.querySelector("#office-modal");
  const officeModalParticipate = documentRef.querySelector("#office-modal-participate");
  const confirmModal = documentRef.querySelector("#confirm-modal");
  const confirmModalSubmit = documentRef.querySelector("#confirm-modal-submit");
  const confirmModalClose = documentRef.querySelector("#confirm-modal-close");
  let hasQueuedMetricsExport = false;

  function bindGlobalClickMetrics() {
    documentRef.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    if (event.target.closest("#research-gate")) {
      return;
    }

    if (event.target.closest("button, a, input, [role='button']")) {
      metrics.trackClick();
    }
    });
  }

  function bindNavigation() {
    elements.triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const viewName = trigger.dataset.view;

        if (!viewName) {
          return;
        }

        const opened = controller.openView(viewName);

        if (opened && trigger.classList.contains("sidebar-link")) {
          controller.setSidebarCollapsed(true);

          if (elements.sidebarToggle) {
            elements.sidebarToggle.focus();
          }
        }
      });
    });

    if (elements.sidebarToggle) {
      elements.sidebarToggle.addEventListener("click", () => {
        controller.toggleSidebar();
      });
    }
  }

  function bindAuth() {
    if (researchStartButton) {
      researchStartButton.addEventListener("click", () => {
        controller.startResearchSession();
      });
    }

    if (loginSubmitButton) {
      loginSubmitButton.addEventListener("click", () => {
        controller.login(loginUserInput ? loginUserInput.value : "");
      });
    }

    if (loginResetButton) {
      loginResetButton.addEventListener("click", () => {
        controller.resetApp();

        if (loginUserInput) {
          loginUserInput.value = "";
        }
      });
    }
  }

  function bindWorkshopInteractions() {
    if (participantModifyButton) {
      participantModifyButton.addEventListener("click", () => {
        controller.showParticipantOperationFailure();
      });
    }

    documentRef.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const pinButton = event.target.closest("[data-pin-workshop-action]");

      if (pinButton) {
        controller.togglePinnedWorkshop(pinButton.dataset.pinWorkshopCode || "");
        return;
      }

      const workshopButton = event.target.closest("[data-workshop-code]");

      if (workshopButton) {
        controller.openWorkshop(workshopButton.dataset.workshopCode || "");
      }
    });

    if (officeModalClose) {
      officeModalClose.addEventListener("click", () => {
        controller.closeWorkshopModal();
      });
    }

    if (officeModal) {
      officeModal.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.modalClose === "true") {
          controller.closeWorkshopModal();
        }
      });
    }

    if (officeModalParticipate) {
      officeModalParticipate.addEventListener("click", () => {
        controller.participateInSelectedWorkshop();
      });
    }

    if (confirmModal) {
      confirmModal.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.confirmClose === "true") {
          controller.closeConfirmModal();
        }
      });
    }

    if (confirmModalClose) {
      confirmModalClose.addEventListener("click", () => {
        controller.closeConfirmModal();
      });
    }

    if (confirmModalSubmit) {
      confirmModalSubmit.addEventListener("click", () => {
        controller.confirmWorkshopCancellation();
      });
    }
  }

  function bindMetricsExport() {
    function queueMetricsOnExit() {
      if (hasQueuedMetricsExport || !controller.hasResearchStarted()) {
        return;
      }

      hasQueuedMetricsExport = true;
      queueMetricsExport(controller.finishMetrics());
    }

    flushQueuedMetricExports();
    global.addEventListener("beforeunload", queueMetricsOnExit);
    global.addEventListener("pagehide", queueMetricsOnExit);

    global.__SGOA_APP__ = controller;
    global.__SGOA_METRICS__ = metrics;
    global.exportSgoaMetrics = () => controller.finishMetrics();
  }

  bindGlobalClickMetrics();
  bindNavigation();
  bindAuth();
  bindWorkshopInteractions();
  bindMetricsExport();
  controller.subscribe((state) => renderer.render(state));
  controller.init();
}(window, document));
