(function attachCommonLogic(global) {
  const {
    BLOCKED_VIEWS,
    DEFAULT_LOGIN_IDENTIFIER,
    DEFAULT_PARTICIPANT,
    MAX_VISIBLE_RECORDS,
    MOCK_WORKSHOPS,
    SIDEBAR_FIRST_OPEN_PREFIX,
    TOAST_MESSAGES,
    VIEW_LABELS,
  } = global.SGOAData;
  const { createInitialState } = global.SGOAState;

  function formatDate(date) {
    return date.toLocaleDateString("pt-BR");
  }

  function formatDateTime(date) {
    return `${formatDate(date)} - ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function generateParticipantCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function getWorkshopByCode(code) {
    return MOCK_WORKSHOPS.find((item) => item.cod === code) || null;
  }

  function createAppController({
    uiVersion,
    metrics,
    storage = typeof window !== "undefined" ? window.localStorage : null,
    taskId = "main-flow",
    onToast = () => {},
  }) {
    const state = createInitialState();
    const listeners = new Set();

    function getSnapshot() {
      const selectedWorkshop = getWorkshopByCode(state.selectedWorkshopCode);

      return {
        ...state,
        uiVersion,
        taskId,
        workshops: MOCK_WORKSHOPS.map((workshop) => ({ ...workshop })),
        participantRecords: state.participantRecords.map((record) => ({ ...record })),
        linkedWorkshopCodes: state.linkedWorkshopCodes.slice(),
        pinnedWorkshopCodes: state.pinnedWorkshopCodes.slice(),
        selectedWorkshop,
        selectedWorkshopIsLinked: selectedWorkshop
          ? state.linkedWorkshopCodes.includes(selectedWorkshop.cod)
          : false,
      };
    }

    function notify() {
      const snapshot = getSnapshot();
      listeners.forEach((listener) => {
        listener(snapshot);
      });
    }

    function touchLastAccess() {
      state.currentLastAccessDateTime = formatDateTime(new Date());
    }

    function addParticipantRecord(message) {
      touchLastAccess();
      state.participantRecordCounter += 1;
      state.participantRecords.unshift({
        order: state.participantRecordCounter,
        message,
      });

      if (state.participantRecords.length > MAX_VISIBLE_RECORDS) {
        state.participantRecords.pop();
      }
    }

    function getSidebarPreferenceKey() {
      return `${SIDEBAR_FIRST_OPEN_PREFIX}:${uiVersion}`;
    }

    function shouldStartWithSidebarOpen() {
      try {
        if (!storage) {
          return true;
        }

        const key = getSidebarPreferenceKey();
        const hasOpenedBefore = storage.getItem(key) === "true";

        if (hasOpenedBefore) {
          return false;
        }

        storage.setItem(key, "true");
        return true;
      } catch {
        return true;
      }
    }

    function setActiveView(viewName) {
      if (state.activeView === viewName) {
        return false;
      }

      state.activeView = viewName;
      metrics.trackView(viewName);
      return true;
    }

    return {
      subscribe(listener) {
        listeners.add(listener);
        listener(getSnapshot());

        return () => {
          listeners.delete(listener);
        };
      },

      init() {
        state.isSidebarCollapsed = !shouldStartWithSidebarOpen();
        notify();
      },

      getState() {
        return getSnapshot();
      },

      startResearchSession() {
        if (state.isResearchStarted) {
          return false;
        }

        state.isResearchStarted = true;
        metrics.start();
        metrics.trackView(state.activeView);
        notify();
        return true;
      },

      setSidebarCollapsed(isCollapsed) {
        state.isSidebarCollapsed = isCollapsed;
        notify();
      },

      toggleSidebar() {
        state.isSidebarCollapsed = !state.isSidebarCollapsed;
        notify();
      },

      openView(viewName) {
        let hasNewRecord = false;

        if (BLOCKED_VIEWS.has(viewName) && !state.isLoggedIn) {
          metrics.trackError("blocked_view");
          onToast(TOAST_MESSAGES.blockedAccess);
          return false;
        }

        const label = VIEW_LABELS[viewName];

        if (state.isLoggedIn && label && viewName !== "home" && viewName !== "identificacao") {
          addParticipantRecord(`Acessou submenu “${label}”`);
          hasNewRecord = true;
        }

        const changed = setActiveView(viewName);

        if (changed || hasNewRecord) {
          notify();
        }

        return true;
      },

      login(identifier) {
        state.isLoggedIn = true;
        state.currentUserIdentifier = identifier && identifier.trim()
          ? identifier.trim()
          : DEFAULT_LOGIN_IDENTIFIER;
        state.currentParticipantCode = generateParticipantCode();
        state.currentFirstAccessDate = formatDate(new Date());
        state.currentLastAccessDateTime = formatDateTime(new Date());
        state.participantRecords = [];
        state.participantRecordCounter = 0;
        state.linkedWorkshopCodes = [];
        state.pinnedWorkshopCodes = [];
        state.selectedWorkshopCode = "";
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        addParticipantRecord("Realizou identificação");
        state.activeView = "home";
        metrics.trackView("home");
        notify();
      },

      resetApp() {
        state.isLoggedIn = false;
        state.currentUserIdentifier = "";
        state.currentParticipantCode = DEFAULT_PARTICIPANT.identifier;
        state.currentFirstAccessDate = DEFAULT_PARTICIPANT.firstAccessDate;
        state.currentLastAccessDateTime = DEFAULT_PARTICIPANT.lastAccessDateTime;
        state.participantRecords = [];
        state.participantRecordCounter = 0;
        state.linkedWorkshopCodes = [];
        state.pinnedWorkshopCodes = [];
        state.selectedWorkshopCode = "";
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        state.activeView = "home";
        metrics.trackView("home");
        notify();
      },

      showParticipantOperationFailure() {
        metrics.trackError("participant_operation_failed");
        onToast(TOAST_MESSAGES.participantOperation);
      },

      openWorkshop(workshopCode) {
        const workshop = getWorkshopByCode(workshopCode);

        if (!workshop) {
          metrics.trackError("invalid_workshop_access");
          return false;
        }

        state.selectedWorkshopCode = workshop.cod;
        state.isOfficeModalOpen = true;
        state.isConfirmModalOpen = false;

        if (state.isLoggedIn) {
          addParticipantRecord(`Acessou oficina “${workshop.title}”`);
        }

        notify();
        return true;
      },

      closeWorkshopModal() {
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        state.selectedWorkshopCode = "";
        notify();
      },

      openConfirmModal() {
        if (!state.selectedWorkshopCode) {
          return;
        }

        state.isConfirmModalOpen = true;
        notify();
      },

      closeConfirmModal() {
        state.isConfirmModalOpen = false;
        notify();
      },

      participateInSelectedWorkshop() {
        const workshop = getWorkshopByCode(state.selectedWorkshopCode);

        if (!workshop) {
          metrics.trackError("participation_without_selection");
          return false;
        }

        if (!state.isLoggedIn) {
          metrics.trackError("participation_requires_login");
          onToast(TOAST_MESSAGES.blockedAccess);
          return false;
        }

        if (workshop.status === "Fechada") {
          metrics.trackError("workshop_closed");
          return false;
        }

        if (!state.linkedWorkshopCodes.includes(workshop.cod)) {
          state.linkedWorkshopCodes.unshift(workshop.cod);
        }

        addParticipantRecord(`Realizou inscrição em oficina “${workshop.title}”`);
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        state.selectedWorkshopCode = "";
        notify();
        return true;
      },

      confirmWorkshopCancellation() {
        const workshop = getWorkshopByCode(state.selectedWorkshopCode);

        if (!workshop) {
          state.isConfirmModalOpen = false;
          notify();
          return false;
        }

        const linkedIndex = state.linkedWorkshopCodes.indexOf(workshop.cod);

        if (linkedIndex >= 0) {
          state.linkedWorkshopCodes.splice(linkedIndex, 1);
          state.pinnedWorkshopCodes = state.pinnedWorkshopCodes.filter((code) => code !== workshop.cod);
          addParticipantRecord(`Cancelou inscrição em oficina “${workshop.title}”`);
        }

        state.isConfirmModalOpen = false;
        state.isOfficeModalOpen = false;
        state.selectedWorkshopCode = "";
        notify();
        return true;
      },

      togglePinnedWorkshop(workshopCode) {
        if (!state.linkedWorkshopCodes.includes(workshopCode)) {
          return false;
        }

        const workshop = getWorkshopByCode(workshopCode);

        if (!workshop) {
          return false;
        }

        const pinnedIndex = state.pinnedWorkshopCodes.indexOf(workshopCode);

        if (pinnedIndex >= 0) {
          state.pinnedWorkshopCodes.splice(pinnedIndex, 1);
          addParticipantRecord(`Desfixou oficina "${workshop.title}" do Menu Rapido`);
        } else {
          state.pinnedWorkshopCodes.unshift(workshopCode);
          addParticipantRecord(`Fixou oficina "${workshop.title}" no Menu Rapido`);
        }

        notify();
        return true;
      },

      finishMetrics() {
        return metrics.finish();
      },

      getMetricsJSON() {
        return metrics.toJSON();
      },

      hasResearchStarted() {
        return state.isResearchStarted;
      },
    };
  }

  global.SGOALogic = {
    createAppController,
  };
}(window));
