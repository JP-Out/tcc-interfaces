(function bootstrapv2App(global, documentRef) {
  const { RESEARCH_TASK_ID } = global.SGOAData;
  const { createAppController } = global.SGOALogic;
  const { createMetricsSession } = global.SGOAMetrics;
  const { downloadMetricsPayload, flushQueuedMetricExports, queueMetricsExport } = global.SGOAExporter;
  const { createv2Renderer } = global.SGOARenderers;

  const renderer = createv2Renderer(documentRef);
  const metrics = createMetricsSession({
    uiVersion: "v2",
    taskId: RESEARCH_TASK_ID,
  });

  const controller = createAppController({
    uiVersion: "v2",
    metrics,
    taskId: RESEARCH_TASK_ID,
    researchObjectiveProfileKey: "v2",
    onToast: (toast) => renderer.showToast(toast),
  });

  const { elements } = renderer;
  const researchStartButton = documentRef.querySelector("#research-start-button");
  const participantModifyButton = documentRef.querySelector(".participant-link");
  const officeModalClose = documentRef.querySelector("#office-modal-close");
  const officeModal = documentRef.querySelector("#office-modal");
  const officeModalParticipate = documentRef.querySelector("#office-modal-participate");
  const officeModalPin = documentRef.querySelector("#office-modal-pin");
  const officeModalCancelLink = documentRef.querySelector("#office-modal-cancel-link");
  const confirmModal = documentRef.querySelector("#confirm-modal");
  const confirmModalSubmit = documentRef.querySelector("#confirm-modal-submit");
  const confirmModalClose = documentRef.querySelector("#confirm-modal-close");
  const objectiveFailureModal = documentRef.querySelector("#objective-failure-modal");
  const objectiveFailureClose = documentRef.querySelector("#objective-failure-close");
  const objectiveFailureSubmit = documentRef.querySelector("#objective-failure-submit");
  const profileMenu = documentRef.querySelector(".profile-menu");
  const profileExitButton = documentRef.querySelector("#profile-exit-button");
  const carouselActions = Array.from(documentRef.querySelectorAll("[data-carousel-action]"));
  const carouselDots = Array.from(documentRef.querySelectorAll(".carousel-dot"));
  const officesTitleInput = documentRef.querySelector("#offices-title-input");
  const officesCodeInput = documentRef.querySelector("#offices-code-input");
  const officesSearchButton = documentRef.querySelector("#offices-search-button");
  const officesStatusInputs = Array.from(documentRef.querySelectorAll("[name='offices-status-filter']"));
  const officesModalityButtons = Array.from(documentRef.querySelectorAll("[data-offices-modality-filter]"));
  const manageModalityButtons = Array.from(documentRef.querySelectorAll("[data-manage-modality-filter]"));
  const officesFilterMenu = documentRef.querySelector(".offices-filter-menu");

  let carouselIntervalId = null;
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

      if (event.target.closest("#research-gate, #onboarding-tour")) {
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

  function restartCarousel() {
    if (carouselIntervalId) {
      global.clearInterval(carouselIntervalId);
    }

    carouselIntervalId = global.setInterval(() => {
      controller.nextCarousel();
    }, 4500);
  }

  function bindNavigation() {
    elements.triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const viewName = trigger.dataset.view;

        if (!viewName) {
          return;
        }

        const opened = controller.openView(viewName);

        if (opened && profileMenu) {
          profileMenu.open = false;
        }

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

    if (elements.profileButton) {
      if (profileMenu) {
        elements.profileButton.setAttribute("aria-expanded", String(profileMenu.open));
        profileMenu.addEventListener("toggle", () => {
          elements.profileButton.setAttribute("aria-expanded", String(profileMenu.open));
        });
      }

      elements.profileButton.addEventListener("click", (event) => {
        const activeView = controller.getState().activeView;

        if (activeView !== "oficinas" && activeView !== "gerenciar") {
          return;
        }

        event.preventDefault();

        if (profileMenu) {
          profileMenu.open = false;
        }

        controller.openView("home");
      });
    }
  }

  function bindResearchGate() {
    if (researchStartButton) {
      researchStartButton.addEventListener("click", () => {
        controller.startResearchSession();
      });
    }

    documentRef.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (!event.target.closest("[data-onboarding-tour-confirm]")) {
        return;
      }

      const acknowledged = controller.acknowledgeOnboardingTour();

      if (acknowledged) {
        metrics.trackViewport(getViewportSnapshot());
      }
    });
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

      const workshopButton = event.target.closest("[data-workshop-code]");

      if (workshopButton) {
        controller.openWorkshop(
          workshopButton.dataset.workshopCode || "",
          workshopButton.dataset.workshopSource || "catalog",
        );
        return;
      }

      const objectiveAbandonButton = event.target.closest("#objective-abandon-button");

      if (objectiveAbandonButton) {
        controller.openObjectiveFailureModal();
      }
    });

    documentRef.addEventListener("keydown", (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const workshopCard = event.target.closest(".offices-result-card");

      if (!workshopCard) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      controller.openWorkshop(
        workshopCard.dataset.workshopCode || "",
        workshopCard.dataset.workshopSource || "catalog",
      );
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
        const state = controller.getState();

        if (state.selectedWorkshopIsLinked) {
          if (state.selectedWorkshopSource === "manage") {
            return;
          }

          controller.closeWorkshopModal();
          controller.openView("gerenciar");
          return;
        }

        if (controller.participateInSelectedWorkshop()) {
          renderer.showToast({
            title: "Inscrição realizada",
            message: `Você se inscreveu em ${state.selectedWorkshop.title}.`,
            variant: "success",
          });
        }
      });
    }

    if (officeModalPin) {
      officeModalPin.addEventListener("click", () => {
        const state = controller.getState();
        const selectedWorkshop = state.selectedWorkshop;

        if (!selectedWorkshop) {
          return;
        }

        const wasPinned = state.pinnedWorkshopCodes.includes(selectedWorkshop.cod);

        if (controller.togglePinnedWorkshop(selectedWorkshop.cod) && !wasPinned) {
          renderer.showToast({
            title: "Oficina fixada",
            message: `${selectedWorkshop.title} foi adicionada ao Acesso Rápido.`,
            variant: "success",
          });
        }
      });
    }

    if (officeModalCancelLink) {
      officeModalCancelLink.addEventListener("click", () => {
        controller.confirmWorkshopCancellation();
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

    if (objectiveFailureModal) {
      objectiveFailureModal.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.objectiveFailureClose === "true") {
          controller.closeObjectiveFailureModal();
        }
      });
    }

    if (objectiveFailureClose) {
      objectiveFailureClose.addEventListener("click", () => {
        controller.closeObjectiveFailureModal();
      });
    }

    if (objectiveFailureSubmit) {
      objectiveFailureSubmit.addEventListener("click", () => {
        controller.confirmObjectiveFailure();
      });
    }

    if (profileExitButton) {
      profileExitButton.addEventListener("click", () => {
        if (profileMenu) {
          profileMenu.open = false;
        }

        if (!controller.requestResearchExit()) {
          renderer.showToast({
            title: "Objetivos pendentes:",
            message: "Finalize ou desista do objetivo atual antes de encerrar a atividade.",
          });
          return;
        }

        hasQueuedMetricsExport = true;
        downloadMetricsPayload(controller.finishMetrics());
        renderer.showToast({
          title: "Atividade encerrada:",
          message: "As métricas da sessão foram exportadas.",
        });
      });
    }

    documentRef.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement) || !profileMenu || !profileMenu.open) {
        return;
      }

      if (event.target.closest(".profile-menu")) {
        return;
      }

      profileMenu.open = false;
    });
  }

  function bindOfficesSearch() {
    function normalizeOfficeCodeInputValue(value) {
      return String(value || "").replace(/\D/g, "");
    }

    function syncOfficeCodeInputValue() {
      if (!officesCodeInput) {
        return;
      }

      const normalizedValue = normalizeOfficeCodeInputValue(officesCodeInput.value);

      if (officesCodeInput.value !== normalizedValue) {
        officesCodeInput.value = normalizedValue;
      }
    }

    function getSelectedStatusFilter() {
      const checkedStatusInput = officesStatusInputs.find((input) => input.checked);
      return checkedStatusInput ? checkedStatusInput.value : "open";
    }

    function submitOfficesSearch() {
      syncOfficeCodeInputValue();

      const searchResult = renderer.setOfficeSearch({
        hasSearched: true,
        title: officesTitleInput ? officesTitleInput.value : "",
        code: officesCodeInput ? officesCodeInput.value : "",
        status: getSelectedStatusFilter(),
      });

      if (searchResult && searchResult.isListingAllWorkshops) {
        renderer.showToast({
          title: "Listando oficinas filtradas",
          message: "A busca não encontrou uma oficina específica, então exibimos as oficinas conforme os filtros selecionados.",
        });
      }
    }

    if (officesSearchButton) {
      officesSearchButton.addEventListener("click", submitOfficesSearch);
    }

    [officesTitleInput, officesCodeInput].forEach((input) => {
      if (!input) {
        return;
      }

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitOfficesSearch();
        }
      });
    });

    if (officesTitleInput) {
      officesTitleInput.addEventListener("input", () => {
        if (officesCodeInput && officesCodeInput.value) {
          officesCodeInput.value = "";
        }
      });
    }

    if (officesCodeInput) {
      officesCodeInput.addEventListener("input", () => {
        if (officesTitleInput && officesTitleInput.value) {
          officesTitleInput.value = "";
        }

        syncOfficeCodeInputValue();
      });
    }

    officesModalityButtons.forEach((button) => {
      button.addEventListener("click", () => {
        renderer.setOfficeSearch({
          modality: button.dataset.officesModalityFilter || "all",
        });
      });
    });

    officesStatusInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) {
          return;
        }

        renderer.setOfficeSearch({
          status: input.value || "open",
        });
      });
    });

    documentRef.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement) || !officesFilterMenu || !officesFilterMenu.open) {
        return;
      }

      if (event.target.closest(".offices-filter-menu")) {
        return;
      }

      officesFilterMenu.removeAttribute("open");
    });
  }

  function bindManageModalityFilters() {
    manageModalityButtons.forEach((button) => {
      button.addEventListener("click", () => {
        renderer.setManageModalityFilter(button.dataset.manageModalityFilter || "all");
      });
    });
  }

  function bindCarousel() {
    carouselActions.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.carouselAction === "prev") {
          controller.previousCarousel();
        } else {
          controller.nextCarousel();
        }

        restartCarousel();
      });
    });

    carouselDots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        controller.goToCarousel(index);
        restartCarousel();
      });
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
  bindResearchGate();
  bindWorkshopInteractions();
  bindOfficesSearch();
  bindManageModalityFilters();
  bindCarousel();
  bindMetricsExport();
  controller.subscribe((state) => {
    currentViewName = state.activeView;
    renderer.render(state);
  });
  controller.init();
  restartCarousel();
}(window, document));
