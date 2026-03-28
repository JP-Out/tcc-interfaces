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
  const searchHistoryButton = documentRef.querySelector("#search-history-button");
  const searchHistoryModal = documentRef.querySelector("#search-history-modal");
  const searchHistoryClose = documentRef.querySelector("#search-history-close");
  const searchHistoryList = documentRef.querySelector("#search-history-list");
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

    function makeRadioGroupToggleable(groupName) {
      const radios = Array.from(documentRef.querySelectorAll(`input[name='${groupName}']`));

      radios.forEach((radio) => {
        if (!(radio instanceof HTMLInputElement)) {
          return;
        }

        const syncWasChecked = () => {
          radio.dataset.wasChecked = radio.checked ? "true" : "false";
        };

        radio.addEventListener("pointerdown", syncWasChecked);
        radio.addEventListener("keydown", (event) => {
          if (event.key === " " || event.key === "Enter") {
            syncWasChecked();
          }
        });
        radio.addEventListener("click", () => {
          if (radio.dataset.wasChecked !== "true") {
            radio.dataset.wasChecked = "false";
            return;
          }

          radio.checked = false;
          radio.dataset.wasChecked = "false";
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
    }

    function setSearchMenuOpen(isOpen) {
      searchManageBlock.classList.toggle("is-open", isOpen);
      searchManageButton.setAttribute("aria-expanded", String(isOpen));
      searchManageMenu.hidden = !isOpen;
    }

    function setSearchHistoryOpen(isOpen) {
      if (!searchHistoryButton || !searchHistoryModal) {
        return;
      }

      searchHistoryButton.setAttribute("aria-expanded", String(isOpen));
      searchHistoryModal.hidden = !isOpen;
    }

    function applySearchHistoryEntry(entry) {
      if (!(generalSearchInput instanceof HTMLInputElement) || !entry) {
        return;
      }

      generalSearchInput.value = entry.query || "";

      Array.from(documentRef.querySelectorAll("input[name='search-mode']")).forEach((input) => {
        if (!(input instanceof HTMLInputElement)) {
          return;
        }

        input.checked = input.value === entry.mode;
      });

      Array.from(documentRef.querySelectorAll("input[name='search-filter']")).forEach((input) => {
        if (!(input instanceof HTMLInputElement)) {
          return;
        }

        input.checked = Array.isArray(entry.filters) && entry.filters.includes(input.value);
      });

      syncSearchMenuLabel();
      setSearchHistoryOpen(false);
      generalSearchInput.focus();
      generalSearchInput.setSelectionRange(generalSearchInput.value.length, generalSearchInput.value.length);
    }

    function syncSearchMenuLabel() {
      if (!searchManageCurrent) {
        return;
      }

      const selectedOption = searchManageMenu.querySelector("input[name='search-mode']:checked");

      if (selectedOption instanceof HTMLInputElement) {
        searchManageCurrent.textContent = selectedOption.dataset.searchLabel
          || selectedOption.nextElementSibling?.textContent
          || "Selecione um escopo";
        return;
      }

      searchManageCurrent.textContent = "Selecione um escopo";
    }

    makeRadioGroupToggleable("search-mode");
    syncSearchMenuLabel();

    searchManageButton.addEventListener("click", () => {
      const isExpanded = searchManageButton.getAttribute("aria-expanded") === "true";
      setSearchMenuOpen(!isExpanded);
      setSearchHistoryOpen(false);
    });

    if (searchHistoryButton) {
      searchHistoryButton.addEventListener("click", () => {
        const isExpanded = searchHistoryButton.getAttribute("aria-expanded") === "true";
        setSearchHistoryOpen(!isExpanded);
        setSearchMenuOpen(false);
      });
    }

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
        const selectedFilters = Array.from(
          documentRef.querySelectorAll("input[name='search-filter']:checked"),
        );
        const searchText = generalSearchInput instanceof HTMLInputElement
          ? generalSearchInput.value.trim()
          : "";
        const modeValue = selectedMode instanceof HTMLInputElement && selectedMode.checked && selectedMode.value
          ? selectedMode.value
          : "";
        const filterValue = selectedFilters
          .filter((input) => input instanceof HTMLInputElement && input.checked && input.value)
          .map((input) => input.value);

        if (!modeValue) {
          renderer.showToast({
            title: "Pesquisa não executada:",
            message: "Selecione uma opção em Gerenciar Busca antes de realizar a pesquisa.",
          });
          setSearchMenuOpen(false);
          setSearchHistoryOpen(false);
          searchManageButton.focus();
          return;
        }

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
        setSearchHistoryOpen(false);
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

      if (searchHistoryList) {
        const historyItem = event.target.closest("[data-search-history-index]");

        if (historyItem instanceof HTMLElement) {
          const historyIndex = Number.parseInt(historyItem.dataset.searchHistoryIndex || "", 10);
          const historyEntry = controller.getState().workshopSearchHistory[historyIndex];

          if (historyEntry) {
            applySearchHistoryEntry(historyEntry);
          }

          return;
        }
      }

      if (!event.target.closest(".search-menu-block")) {
        setSearchMenuOpen(false);
      }

    });

    documentRef.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSearchMenuOpen(false);
        setSearchHistoryOpen(false);
      }
    });

    if (searchHistoryModal) {
      searchHistoryModal.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.historyClose === "true") {
          setSearchHistoryOpen(false);
        }
      });
    }

    if (searchHistoryClose) {
      searchHistoryClose.addEventListener("click", () => {
        setSearchHistoryOpen(false);
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
