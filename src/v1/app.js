(function bootstrapv1App(global, documentRef) {
  const { createAppController } = global.SGOALogic;
  const { createMetricsSession } = global.SGOAMetrics;
  const { flushQueuedMetricExports, queueMetricsExport } = global.SGOAExporter;
  const { createv1Renderer } = global.SGOARenderers;

  const renderer = createv1Renderer(documentRef);
  const metrics = createMetricsSession({
    uiVersion: "v1",
    taskId: "main-flow",
  });

  const controller = createAppController({
    uiVersion: "v1",
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
  const officeModalCancelLink = documentRef.querySelector("#office-modal-cancel-link");
  const confirmModal = documentRef.querySelector("#confirm-modal");
  const confirmModalSubmit = documentRef.querySelector("#confirm-modal-submit");
  const confirmModalClose = documentRef.querySelector("#confirm-modal-close");
  const searchManageButton = documentRef.querySelector("#search-manage-button");
  const searchManageMenu = documentRef.querySelector("#search-manage-menu");
  const searchManageBlock = documentRef.querySelector(".search-menu-block");
  const searchManageCurrent = documentRef.querySelector("#search-manage-current");
  const searchSubmitButton = documentRef.querySelector("#search-submit-button");
  const generalSearchInput = documentRef.querySelector("#general-search-input");
  let hasQueuedMetricsExport = false;
  let currentViewName = "home";

  function getViewportSnapshot() {
    return {
      width: global.innerWidth || documentRef.documentElement.clientWidth || 0,
      height: global.innerHeight || documentRef.documentElement.clientHeight || 0,
      devicePixelRatio: global.devicePixelRatio || 1,
    };
  }

  function bindGlobalClickMetrics() {
    documentRef.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (event.target.closest("#research-gate")) {
        return;
      }

      if (event.target.closest("button, a, input, [role='button']")) {
        metrics.trackClick({
          x: event.clientX,
          y: event.clientY,
          viewName: currentViewName,
        });
      }
    });
  }

  function bindMouseTracking() {
    documentRef.addEventListener("mousemove", (event) => {
      metrics.trackMousePosition({
        x: event.clientX,
        y: event.clientY,
        viewName: currentViewName,
      });
    }, { passive: true });

    global.addEventListener("resize", () => {
      metrics.trackViewport(getViewportSnapshot());
    }, { passive: true });
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
        const started = controller.startResearchSession();

        if (started) {
          metrics.trackViewport(getViewportSnapshot());
        }
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

    if (officeModalCancelLink) {
      officeModalCancelLink.addEventListener("click", () => {
        controller.openConfirmModal();
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

  function bindSearchControls() {
    if (!searchManageButton || !searchManageMenu || !searchManageBlock) {
      return;
    }

    function setSearchMenuOpen(isOpen) {
      searchManageBlock.classList.toggle("is-open", isOpen);
      searchManageButton.setAttribute("aria-expanded", String(isOpen));
      searchManageMenu.hidden = !isOpen;
    }

    function syncSearchMenuLabel() {
      if (!searchManageCurrent) {
        return;
      }

      const selectedOption = searchManageMenu.querySelector("input[name='search-mode']:checked");

      if (selectedOption instanceof HTMLInputElement) {
        searchManageCurrent.textContent = selectedOption.dataset.searchLabel
          || selectedOption.nextElementSibling?.textContent
          || "Codigo de Indetificação da Ofc.";
      }
    }

    syncSearchMenuLabel();

    searchManageButton.addEventListener("click", () => {
      const isExpanded = searchManageButton.getAttribute("aria-expanded") === "true";
      setSearchMenuOpen(!isExpanded);
    });

    searchManageMenu.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.name !== "search-mode") {
        return;
      }

      syncSearchMenuLabel();
      setSearchMenuOpen(false);
    });

    if (searchSubmitButton) {
      searchSubmitButton.addEventListener("click", () => {
        const selectedMode = searchManageMenu.querySelector("input[name='search-mode']:checked");
        const selectedFilter = documentRef.querySelector("input[name='search-filter']:checked");
        const searchText = generalSearchInput instanceof HTMLInputElement
          ? generalSearchInput.value.trim()
          : "";
        const modeValue = selectedMode instanceof HTMLInputElement && selectedMode.value
          ? selectedMode.value
          : "code";
        const filterValue = selectedFilter instanceof HTMLInputElement && selectedFilter.value
          ? selectedFilter.value
          : "open";
        const searchResult = controller.performWorkshopSearch({
          query: searchText,
          mode: modeValue,
          filter: filterValue,
        });

        if (searchText && !searchResult.results.length) {
          renderer.showToast({
            title: "Pesquisa executada:",
            message: "Nenhuma oficina permaneceu compatível com a combinação de escopo e filtro.",
          });
        }

        setSearchMenuOpen(false);
      });
    }

    if (generalSearchInput) {
      generalSearchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
        }
      });
    }

    documentRef.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (!event.target.closest(".search-menu-block")) {
        setSearchMenuOpen(false);
      }
    });

    documentRef.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSearchMenuOpen(false);
      }
    });
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
  bindMouseTracking();
  bindNavigation();
  bindAuth();
  bindWorkshopInteractions();
  bindSearchControls();
  bindMetricsExport();
  controller.subscribe((state) => {
    currentViewName = state.activeView;
    renderer.render(state);
  });
  controller.init();
}(window, document));
