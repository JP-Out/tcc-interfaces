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

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function normalizeCode(value) {
    return normalizeText(value).replace(/[^a-z0-9]/g, "").toUpperCase();
  }

  function tokenizeText(value) {
    return normalizeText(value)
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function extractHoursValue(value) {
    const parsed = Number.parseInt(String(value || "").replace(/\D+/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getSearchModeLabel(mode) {
    if (mode === "broad") {
      return "Termos de Busca Amplos";
    }

    if (mode === "hours") {
      return "Num. da Carga de Horas";
    }

    return "Codigo de Indetificação da Ofc.";
  }

  function getSearchFilterLabel(filter) {
    if (filter === "physical") {
      return "Formato OFc. Fisico";
    }

    return "Situação Ofc. Aberta";
  }

  function applyWorkshopSearchFilter(workshops, filter) {
    if (filter === "physical") {
      return workshops.filter((workshop) => workshop.modality === "Presencial");
    }

    return workshops.filter((workshop) => workshop.status === "Aberta");
  }

  function getSharedPrefixLength(left, right) {
    const maxLength = Math.min(left.length, right.length);
    let index = 0;

    while (index < maxLength && left[index] === right[index]) {
      index += 1;
    }

    return index;
  }

  function searchWorkshopsByCode(workshops, query) {
    const normalizedQuery = normalizeCode(query);
    const queryDigits = normalizedQuery.replace(/\D+/g, "");

    if (!normalizedQuery) {
      return [];
    }

    return workshops
      .map((workshop) => {
        const normalizedWorkshopCode = normalizeCode(workshop.cod);
        const workshopDigits = normalizedWorkshopCode.replace(/\D+/g, "");
        const sharedPrefixLength = getSharedPrefixLength(normalizedQuery, normalizedWorkshopCode);
        let score = 0;
        let reason = "Código apenas parcialmente relacionado.";

        if (normalizedWorkshopCode === normalizedQuery) {
          score += 320;
          reason = "Código idêntico ao trecho informado.";
        }

        if (normalizedWorkshopCode.includes(normalizedQuery)) {
          score += 180;
          reason = normalizedWorkshopCode === normalizedQuery
            ? reason
            : "Código contém a sequência principal informada.";
        }

        if (queryDigits && workshopDigits.includes(queryDigits)) {
          score += 140;
          reason = score >= 320
            ? reason
            : "Numeração compatível com o fragmento digitado.";
        }

        if (sharedPrefixLength >= 3) {
          score += sharedPrefixLength * 22;
        }

        if (!score && normalizedQuery.length >= 2 && normalizedWorkshopCode.startsWith(normalizedQuery.slice(0, 2))) {
          score += 46;
        }

        if (!score) {
          return null;
        }

        return {
          code: workshop.cod,
          reason,
          score,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2);
  }

  function searchWorkshopsByBroadTerms(workshops, query) {
    const normalizedQuery = normalizeText(query).trim();
    const queryTokens = tokenizeText(query);

    if (!normalizedQuery || !queryTokens.length) {
      return [];
    }

    return workshops
      .map((workshop) => {
        const normalizedTitle = normalizeText(workshop.title);
        const normalizedDescription = normalizeText(workshop.description);
        const matchedTokens = [];
        let score = 0;

        if (normalizedTitle.includes(normalizedQuery) || normalizedDescription.includes(normalizedQuery)) {
          score += 120;
        }

        queryTokens.forEach((token) => {
          if (normalizedTitle.includes(token)) {
            matchedTokens.push(token);
            score += 72;
          } else if (normalizedDescription.includes(token)) {
            matchedTokens.push(token);
            score += 38;
          }
        });

        if (!score) {
          return null;
        }

        return {
          code: workshop.cod,
          reason: matchedTokens.length
            ? `Encontrou incidência em: ${Array.from(new Set(matchedTokens)).slice(0, 3).join(", ")}.`
            : "Encontrou relação textual indireta com a expressão completa.",
          score,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
  }

  function searchWorkshopsByHours(workshops, query) {
    const numberMatch = String(query || "").match(/\d+/);

    if (!numberMatch) {
      return [];
    }

    const desiredHours = Number.parseInt(numberMatch[0], 10);

    return workshops
      .map((workshop) => {
        const workshopHours = extractHoursValue(workshop.hours);
        const diff = Math.abs(workshopHours - desiredHours);
        const score = diff === 0
          ? 240
          : Math.max(0, 120 - (diff * 14));

        if (!score) {
          return null;
        }

        return {
          code: workshop.cod,
          reason: diff === 0
            ? `Carga horária exata de ${workshopHours} horas.`
            : `Carga horária próxima ao valor informado (${workshopHours} horas).`,
          score,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
  }

  function buildRelevantTerms(mode, query, results) {
    const uniqueTerms = new Set();
    const normalizedQueryTokens = tokenizeText(query);

    normalizedQueryTokens.forEach((token) => {
      if (token.length >= 2) {
        uniqueTerms.add(token);
      }
    });

    results.forEach((result) => {
      const workshop = getWorkshopByCode(result.code);

      if (!workshop) {
        return;
      }

      if (mode === "code") {
        uniqueTerms.add(workshop.cod);
        uniqueTerms.add(workshop.cod.split("-")[0]);
        return;
      }

      if (mode === "hours") {
        uniqueTerms.add(String(extractHoursValue(workshop.hours)));
        uniqueTerms.add(workshop.hours);
        return;
      }

      tokenizeText(`${workshop.title} ${workshop.description}`)
        .filter((token) => token.length >= 4)
        .slice(0, 6)
        .forEach((token) => {
          uniqueTerms.add(token);
        });
    });

    return Array.from(uniqueTerms).slice(0, 6);
  }

  function runWorkshopSearch({ query, mode, filter }) {
    const filteredWorkshops = applyWorkshopSearchFilter(MOCK_WORKSHOPS, filter);
    let results = [];

    if (mode === "broad") {
      results = searchWorkshopsByBroadTerms(filteredWorkshops, query);
    } else if (mode === "hours") {
      results = searchWorkshopsByHours(filteredWorkshops, query);
    } else {
      results = searchWorkshopsByCode(filteredWorkshops, query);
    }

    return {
      matchedTerms: buildRelevantTerms(mode, query, results),
      modeLabel: getSearchModeLabel(mode),
      filterLabel: getSearchFilterLabel(filter),
      results,
    };
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
        workshopSearchMatchedTerms: state.workshopSearchMatchedTerms.slice(),
        workshopSearchResults: state.workshopSearchResults.map((result) => ({ ...result })),
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
        state.hasWorkshopSearch = false;
        state.workshopSearchQuery = "";
        state.workshopSearchMode = "code";
        state.workshopSearchFilter = "open";
        state.workshopSearchMatchedTerms = [];
        state.workshopSearchResults = [];
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
        state.hasWorkshopSearch = false;
        state.workshopSearchQuery = "";
        state.workshopSearchMode = "code";
        state.workshopSearchFilter = "open";
        state.workshopSearchMatchedTerms = [];
        state.workshopSearchResults = [];
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

      performWorkshopSearch({ query, mode, filter }) {
        const trimmedQuery = String(query || "").trim();

        if (!trimmedQuery) {
          state.hasWorkshopSearch = false;
          state.workshopSearchQuery = "";
          state.workshopSearchMode = mode || "code";
          state.workshopSearchFilter = filter || "open";
          state.workshopSearchMatchedTerms = [];
          state.workshopSearchResults = [];
          notify();
          return {
            matchedTerms: [],
            modeLabel: getSearchModeLabel(mode || "code"),
            filterLabel: getSearchFilterLabel(filter || "open"),
            results: [],
          };
        }

        const searchMode = mode || "code";
        const searchFilter = filter || "open";
        const searchResult = runWorkshopSearch({
          query: trimmedQuery,
          mode: searchMode,
          filter: searchFilter,
        });

        state.hasWorkshopSearch = true;
        state.workshopSearchQuery = trimmedQuery;
        state.workshopSearchMode = searchMode;
        state.workshopSearchFilter = searchFilter;
        state.workshopSearchMatchedTerms = searchResult.matchedTerms.slice();
        state.workshopSearchResults = searchResult.results.map((result) => ({ ...result }));

        if (state.isLoggedIn) {
          addParticipantRecord(`Executou pesquisa por ${searchResult.modeLabel}`);
        }

        notify();
        return searchResult;
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
