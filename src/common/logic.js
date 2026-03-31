(function attachCommonLogic(global) {
  const {
    BLOCKED_VIEWS,
    DEFAULT_LOGIN_IDENTIFIER,
    DEFAULT_PARTICIPANT,
    MAX_VISIBLE_RECORDS,
    MOCK_WORKSHOPS,
    RESEARCH_OBJECTIVE_PROFILES,
    RESEARCH_TASK_ID,
    SIDEBAR_FIRST_OPEN_PREFIX,
    SYSTEM_VERSION,
    TOAST_MESSAGES,
    VIEW_LABELS,
  } = global.SGOAData;
  const { createInitialState } = global.SGOAState;
  const MAX_SEARCH_HISTORY = 8;

  function cloneResearchObjectiveProfile(profile) {
    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      periodTarget: profile.periodTarget,
      exitViewName: profile.exitViewName,
      exitViewLabel: profile.exitViewLabel,
      sets: profile.sets.map((set) => ({
        id: set.id,
        title: set.title,
        objectives: set.objectives.map((objective) => ({
          id: objective.id,
          title: objective.title,
          dependsOn: Array.isArray(objective.dependsOn) ? objective.dependsOn.slice() : [],
          target: objective.target ? { ...objective.target } : {},
          status: "pendente",
          startedAt: null,
          completedAt: null,
          failedAt: null,
          resolutionType: null,
          resolutionReason: null,
        })),
      })),
    };
  }

  function deriveObjectiveSetStatus(objectives) {
    if (!objectives.length) {
      return "pendente";
    }

    const hasPending = objectives.some((objective) => objective.status === "pendente");

    if (hasPending) {
      return "pendente";
    }

    return objectives.some((objective) => objective.status === "falhou")
      ? "falhou"
      : "concluido";
  }

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

  function generateSessionReference() {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");
    const randomPart = String(Math.floor(100000 + Math.random() * 900000));

    return `SGOA-${datePart}-${randomPart}`;
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
    if (!mode) {
      return "Nenhum escopo selecionado";
    }

    if (mode === "broad") {
      return "Termos de Busca Amplos";
    }

    if (mode === "hours") {
      return "Num. da Carga de Horas";
    }

    return "Codigo de Indetificação da Ofc.";
  }

  function normalizeSearchFilters(filter) {
    if (Array.isArray(filter)) {
      return Array.from(new Set(filter.filter(Boolean)))
        .filter((value) => value === "open" || value === "physical")
        .sort((left, right) => {
          const order = { open: 0, physical: 1 };
          return order[left] - order[right];
        });
    }

    if (filter === "open" || filter === "physical") {
      return [filter];
    }

    return [];
  }

  function getSearchFilterLabel(filter) {
    const filters = normalizeSearchFilters(filter);

    if (!filters.length) {
      return "Sem filtro";
    }

    if (filters.length === 2) {
      return "Situação Ofc. Aberta + Formato OFc. Fisico";
    }

    if (filters[0] === "physical") {
      return "Formato OFc. Fisico";
    }

    return "Situação Ofc. Aberta";
  }

  function applyWorkshopSearchFilter(workshops, filter) {
    const filters = normalizeSearchFilters(filter);

    return workshops.filter((workshop) => {
      if (filters.includes("open") && workshop.status !== "Aberta") {
        return false;
      }

      if (filters.includes("physical") && workshop.modality !== "Presencial") {
        return false;
      }

      return true;
    });
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

    if (!normalizedQuery) {
      return [];
    }

    return workshops
      .map((workshop) => {
        const normalizedWorkshopCode = normalizeCode(workshop.cod);
        const containsQuery = normalizedWorkshopCode.includes(normalizedQuery);

        if (!containsQuery) {
          return null;
        }

        const sharedPrefixLength = getSharedPrefixLength(normalizedQuery, normalizedWorkshopCode);
        const containsIndex = normalizedWorkshopCode.indexOf(normalizedQuery);
        const score = 260 + (sharedPrefixLength * 18) - (containsIndex * 6);
        const reason = normalizedWorkshopCode === normalizedQuery
          ? "Código idêntico ao trecho informado."
          : "Código contém o trecho digitado.";

        return {
          code: workshop.cod,
          reason,
          score,
          matchedTerms: [normalizedQuery],
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score);
  }

  function searchWorkshopsByBroadTerms(workshops, query) {
    const normalizedQuery = normalizeText(query).trim();
    const queryTokens = tokenizeText(query).filter((token) => token.length >= 2);

    if (!normalizedQuery || !queryTokens.length) {
      return [];
    }

    return workshops
      .map((workshop) => {
        const normalizedTitle = normalizeText(workshop.title);
        const normalizedDescription = normalizeText(workshop.description);
        const matchedTokens = [];
        let score = 0;
        let hasExactPhraseMatch = false;

        if (normalizedTitle.includes(normalizedQuery) || normalizedDescription.includes(normalizedQuery)) {
          score += 140;
          hasExactPhraseMatch = true;
        }

        queryTokens.forEach((token) => {
          if (normalizedTitle.includes(token)) {
            matchedTokens.push(token);
            score += 88;
            return;
          }

          if (normalizedDescription.includes(token)) {
            matchedTokens.push(token);
            score += 52;
          }
        });

        const uniqueMatchedTokens = Array.from(new Set(matchedTokens));

        if (!score || (!hasExactPhraseMatch && !uniqueMatchedTokens.length)) {
          return null;
        }

        return {
          code: workshop.cod,
          reason: uniqueMatchedTokens.length
            ? `Encontrou no título ou na descrição: ${uniqueMatchedTokens.slice(0, 4).join(", ")}.`
            : "Encontrou relação textual indireta com a expressão completa.",
          score,
          matchedTerms: uniqueMatchedTokens,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score);
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
        if (workshopHours !== desiredHours) {
          return null;
        }

        return {
          code: workshop.cod,
          reason: `Carga horária exata de ${workshopHours} horas.`,
          score: 240,
          matchedTerms: [String(workshopHours)],
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score)
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

      if (Array.isArray(result.matchedTerms) && result.matchedTerms.length) {
        result.matchedTerms.forEach((term) => {
          if (String(term).length >= 2) {
            uniqueTerms.add(String(term));
          }
        });
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
    researchObjectiveProfileKey = null,
    onToast = () => {},
  }) {
    const state = createInitialState();
    const listeners = new Set();
    const researchProfileConfig = researchObjectiveProfileKey
      ? RESEARCH_OBJECTIVE_PROFILES[researchObjectiveProfileKey] || null
      : null;

    function resetWorkshopSearchDetailState() {
      state.workshopSearchNavigationCodes = [];
      state.workshopSearchDetailIndex = -1;
      state.hasConsumedWorkshopSearch = false;
    }

    function isResearchTrackingEnabled() {
      return Boolean(researchProfileConfig);
    }

    function getResearchTimestamp() {
      return new Date().toISOString();
    }

    function resetResearchObjectives() {
      state.researchTaskId = isResearchTrackingEnabled() ? RESEARCH_TASK_ID : taskId;
      state.objectiveProfileId = "";
      state.objectiveSets = [];
      state.currentObjectiveId = "";
      state.allObjectivesTerminal = false;
      state.objectiveFeedback = null;
      state.isObjectiveFailureModalOpen = false;
      state.objectiveFailureTargetId = "";
      state.objectiveFailureDependentIds = [];
      state.objectiveTrackedPinnedWorkshopCode = "";
      state.objectiveTrackedQuickAccessWorkshopCode = "";
      state.objectiveRemovedQuickAccessWorkshopCode = "";

      if (!isResearchTrackingEnabled()) {
        if (typeof metrics.setResearchObjectives === "function") {
          metrics.setResearchObjectives(null);
        }
        return;
      }

      const profile = cloneResearchObjectiveProfile(researchProfileConfig);
      state.objectiveProfileId = profile.id;
      state.objectiveSets = profile.sets;
      refreshResearchProgress();
      syncResearchMetrics();
    }

    function getObjectiveSets() {
      return Array.isArray(state.objectiveSets) ? state.objectiveSets : [];
    }

    function getAllObjectives() {
      return getObjectiveSets().flatMap((set) => set.objectives || []);
    }

    function findObjectiveById(objectiveId) {
      return getAllObjectives().find((objective) => objective.id === objectiveId) || null;
    }

    function collectDependentObjectiveIds(objectiveId, visited = new Set()) {
      const dependentIds = [];

      getAllObjectives().forEach((objective) => {
        if (!objective.dependsOn.includes(objectiveId) || visited.has(objective.id)) {
          return;
        }

        visited.add(objective.id);
        dependentIds.push(objective.id);
        dependentIds.push(...collectDependentObjectiveIds(objective.id, visited));
      });

      return dependentIds;
    }

    function refreshResearchProgress() {
      const allObjectives = getAllObjectives();

      getObjectiveSets().forEach((set) => {
        set.status = deriveObjectiveSetStatus(set.objectives || []);
      });

      state.allObjectivesTerminal = allObjectives.length > 0
        && allObjectives.every((objective) => objective.status !== "pendente");

      const nextPendingObjective = allObjectives.find((objective) => objective.status === "pendente") || null;
      state.currentObjectiveId = nextPendingObjective ? nextPendingObjective.id : "";

      if (state.isResearchStarted && nextPendingObjective && !nextPendingObjective.startedAt) {
        nextPendingObjective.startedAt = getResearchTimestamp();
      }
    }

    function createResearchMetricsSnapshot() {
      if (!isResearchTrackingEnabled()) {
        return null;
      }

      return {
        objectiveProfileId: state.objectiveProfileId,
        objectiveSets: getObjectiveSets().map((set) => ({
          id: set.id,
          title: set.title,
          status: set.status,
          objectives: (set.objectives || []).map((objective) => ({
            id: objective.id,
            title: objective.title,
            dependsOn: objective.dependsOn.slice(),
            target: objective.target ? { ...objective.target } : {},
            status: objective.status,
            startedAt: objective.startedAt,
            completedAt: objective.completedAt,
            failedAt: objective.failedAt,
            resolutionType: objective.resolutionType,
            resolutionReason: objective.resolutionReason,
          })),
        })),
        currentObjectiveId: state.currentObjectiveId || null,
        allObjectivesTerminal: state.allObjectivesTerminal,
      };
    }

    function syncResearchMetrics() {
      if (typeof metrics.setResearchObjectives === "function") {
        metrics.setResearchObjectives(createResearchMetricsSnapshot());
      }
    }

    function setObjectiveFeedback(objective, status) {
      if (!objective) {
        return;
      }

      state.objectiveFeedback = {
        objectiveId: objective.id,
        status,
        title: objective.title,
        message: status === "concluido"
          ? `Objetivo ${objective.id} concluido automaticamente.`
          : `Objetivo ${objective.id} marcado como falhou.`,
      };
    }

    function completeObjective(objectiveId, resolutionReason) {
      const objective = findObjectiveById(objectiveId);

      if (!objective || objective.status !== "pendente") {
        return false;
      }

      if (!objective.startedAt && state.isResearchStarted) {
        objective.startedAt = getResearchTimestamp();
      }

      objective.status = "concluido";
      objective.completedAt = getResearchTimestamp();
      objective.failedAt = null;
      objective.resolutionType = "automatico";
      objective.resolutionReason = resolutionReason;
      setObjectiveFeedback(objective, "concluido");
      refreshResearchProgress();
      syncResearchMetrics();
      return true;
    }

    function failObjective(objectiveId, resolutionReason, resolutionType = "manual", shouldSetFeedback = false) {
      const objective = findObjectiveById(objectiveId);

      if (!objective || objective.status !== "pendente") {
        return false;
      }

      if (!objective.startedAt && state.isResearchStarted) {
        objective.startedAt = getResearchTimestamp();
      }

      objective.status = "falhou";
      objective.failedAt = getResearchTimestamp();
      objective.completedAt = null;
      objective.resolutionType = resolutionType;
      objective.resolutionReason = resolutionReason;

      if (shouldSetFeedback) {
        setObjectiveFeedback(objective, "falhou");
      }

      refreshResearchProgress();
      syncResearchMetrics();
      return true;
    }

    function applyObjectiveFailure() {
      if (!state.objectiveFailureTargetId) {
        return false;
      }

      const targetObjectiveId = state.objectiveFailureTargetId;
      const dependentIds = collectDependentObjectiveIds(targetObjectiveId);

      failObjective(targetObjectiveId, "desistencia_manual", "manual", true);
      dependentIds.forEach((dependentId) => {
        failObjective(dependentId, "dependencia_bloqueada", "automatico", false);
      });

      state.isObjectiveFailureModalOpen = false;
      state.objectiveFailureTargetId = "";
      state.objectiveFailureDependentIds = [];
      return true;
    }

    function getTrackedPeriodTarget() {
      return researchProfileConfig ? researchProfileConfig.periodTarget : "";
    }

    function handleWorkshopLinked(workshop) {
      if (!isResearchTrackingEnabled() || !workshop) {
        return;
      }

      if (workshop.cod === "ELM-1806") {
        completeObjective("1.1", "inscricao_realizada");
      }

      if (workshop.title === "Montagem de Painéis de Controle") {
        completeObjective("1.2", "inscricao_realizada");
      }

      if (workshop.period === getTrackedPeriodTarget()) {
        completeObjective("1.3", "inscricao_realizada");
      }
    }

    function handleWorkshopOpened(workshop, source) {
      if (!isResearchTrackingEnabled() || !workshop) {
        return;
      }

      if (source === "manage" && workshop.cod === "ELM-1806" && state.linkedWorkshopCodes.includes(workshop.cod)) {
        completeObjective("2.1", "oficina_aberta_em_gerenciamento");
      }

      if (
        source === "quick_access"
        && state.objectiveTrackedPinnedWorkshopCode
        && workshop.cod === state.objectiveTrackedPinnedWorkshopCode
      ) {
        if (completeObjective("3.1", "oficina_aberta_no_acesso_rapido")) {
          state.objectiveTrackedQuickAccessWorkshopCode = workshop.cod;
        }
      }
    }

    function handlePinnedWorkshopChange(workshop, isPinned) {
      if (!isResearchTrackingEnabled() || !workshop) {
        return;
      }

      if (
        isPinned
        && state.selectedWorkshopSource === "manage"
        && state.linkedWorkshopCodes.includes(workshop.cod)
        && workshop.period === getTrackedPeriodTarget()
      ) {
        state.objectiveTrackedPinnedWorkshopCode = workshop.cod;
        completeObjective("2.3", "atalho_adicionado");
      }

      if (
        !isPinned
        && state.objectiveTrackedQuickAccessWorkshopCode
        && workshop.cod === state.objectiveTrackedQuickAccessWorkshopCode
      ) {
        state.objectiveRemovedQuickAccessWorkshopCode = workshop.cod;
      }
    }

    function handleWorkshopCancellation(workshop) {
      if (!isResearchTrackingEnabled() || !workshop) {
        return;
      }

      if (workshop.title === "Montagem de Painéis de Controle") {
        completeObjective("2.2", "inscricao_cancelada");
      }

      if (
        state.objectiveRemovedQuickAccessWorkshopCode
        && workshop.cod === state.objectiveRemovedQuickAccessWorkshopCode
      ) {
        completeObjective("3.2", "atalho_removido_e_inscricao_cancelada");
      }
    }

    function handleResearchExitRequest() {
      if (!isResearchTrackingEnabled()) {
        return true;
      }

      const exitObjective = findObjectiveById("3.3");

      if (!exitObjective) {
        return false;
      }

      if (exitObjective.status === "falhou") {
        return true;
      }

      if (state.currentObjectiveId !== "3.3") {
        return false;
      }

      completeObjective("3.3", "atividade_encerrada");
      return true;
    }

    function getSnapshot() {
      const selectedWorkshop = getWorkshopByCode(state.selectedWorkshopCode);
      const searchDetailTotal = state.workshopSearchNavigationCodes.length;
      const searchDetailIndex = state.workshopSearchDetailIndex;
      const linkedWorkshops = state.linkedWorkshopCodes
        .map((code) => getWorkshopByCode(code))
        .filter(Boolean);
      const completedWorkshopCount = state.completedWorkshopCodes.length;

      return {
        ...state,
        uiVersion,
        taskId: state.researchTaskId || taskId,
        systemVersion: SYSTEM_VERSION,
        workshops: MOCK_WORKSHOPS.map((workshop) => ({ ...workshop })),
        objectiveSets: getObjectiveSets().map((set) => ({
          ...set,
          objectives: (set.objectives || []).map((objective) => ({
            ...objective,
            dependsOn: objective.dependsOn.slice(),
            target: objective.target ? { ...objective.target } : {},
          })),
        })),
        currentObjective: state.currentObjectiveId ? findObjectiveById(state.currentObjectiveId) : null,
        objectiveFailureTarget: state.objectiveFailureTargetId
          ? findObjectiveById(state.objectiveFailureTargetId)
          : null,
        objectiveFailureDependents: state.objectiveFailureDependentIds
          .map((objectiveId) => findObjectiveById(objectiveId))
          .filter(Boolean),
        participantRecords: state.participantRecords.map((record) => ({ ...record })),
        linkedWorkshopCodes: state.linkedWorkshopCodes.slice(),
        completedWorkshopCodes: state.completedWorkshopCodes.slice(),
        pinnedWorkshopCodes: state.pinnedWorkshopCodes.slice(),
        linkedWorkshopCount: linkedWorkshops.length,
        completedWorkshopCount,
        workshopSearchFilters: state.workshopSearchFilters.slice(),
        workshopSearchHistory: state.workshopSearchHistory.map((entry) => ({
          ...entry,
          filters: entry.filters.slice(),
        })),
        workshopSearchMatchedTerms: state.workshopSearchMatchedTerms.slice(),
        workshopSearchResults: state.workshopSearchResults.map((result) => ({ ...result })),
        workshopSearchNavigationCodes: state.workshopSearchNavigationCodes.slice(),
        selectedWorkshop,
        selectedWorkshopIsLinked: selectedWorkshop
          ? state.linkedWorkshopCodes.includes(selectedWorkshop.cod)
          : false,
        canFinishResearch: !isResearchTrackingEnabled() || state.currentObjectiveId === "3.3" || (
          findObjectiveById("3.3") && findObjectiveById("3.3").status === "falhou"
        ),
        lastManageWorkshopAccessTitle: state.lastManageWorkshopAccessTitle
          || "Nenhuma oficina consultada nesta área.",
        searchDetailPosition: searchDetailIndex >= 0 ? searchDetailIndex + 1 : 0,
        searchDetailTotal,
        searchDetailHasPrevious: searchDetailIndex > 0,
        searchDetailHasNext: searchDetailIndex >= 0 && searchDetailIndex < searchDetailTotal - 1,
      };
    }

    function notify() {
      refreshResearchProgress();
      syncResearchMetrics();
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

    function addSearchHistoryEntry({ query, mode, filters }) {
      const normalizedQuery = String(query || "").trim();

      if (!normalizedQuery || !mode) {
        return;
      }

      const normalizedFilters = normalizeSearchFilters(filters);
      const duplicatedIndex = state.workshopSearchHistory.findIndex((entry) => (
        entry.query === normalizedQuery
        && entry.mode === mode
        && JSON.stringify(entry.filters) === JSON.stringify(normalizedFilters)
      ));

      if (duplicatedIndex >= 0) {
        state.workshopSearchHistory.splice(duplicatedIndex, 1);
      }

      state.workshopSearchHistory.unshift({
        query: normalizedQuery,
        mode,
        filters: normalizedFilters,
      });

      if (state.workshopSearchHistory.length > MAX_SEARCH_HISTORY) {
        state.workshopSearchHistory.length = MAX_SEARCH_HISTORY;
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
        state.currentSessionId = generateSessionReference();
        state.isSidebarCollapsed = !shouldStartWithSidebarOpen();
        resetResearchObjectives();
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
        refreshResearchProgress();
        syncResearchMetrics();
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
          metrics.trackError("acesso_bloqueado_sem_identificacao");
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
        state.currentParticipantCourse = DEFAULT_PARTICIPANT.course;
        state.currentFirstAccessDate = formatDate(new Date());
        state.currentLastAccessDateTime = formatDateTime(new Date());
        state.currentSessionId = generateSessionReference();
        state.lastManageWorkshopAccessTitle = "";
        state.participantRecords = [];
        state.participantRecordCounter = 0;
        state.linkedWorkshopCodes = [];
        state.completedWorkshopCodes = [];
        state.pinnedWorkshopCodes = [];
        state.hasWorkshopSearch = false;
        state.workshopSearchQuery = "";
        state.workshopSearchMode = "";
        state.workshopSearchFilters = [];
        state.workshopSearchHistory = [];
        state.workshopSearchMatchedTerms = [];
        state.workshopSearchResults = [];
        resetWorkshopSearchDetailState();
        state.selectedWorkshopCode = "";
        state.selectedWorkshopSource = "";
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
        state.currentParticipantCourse = DEFAULT_PARTICIPANT.course;
        state.currentFirstAccessDate = DEFAULT_PARTICIPANT.firstAccessDate;
        state.currentLastAccessDateTime = DEFAULT_PARTICIPANT.lastAccessDateTime;
        state.currentSessionId = generateSessionReference();
        state.lastManageWorkshopAccessTitle = "";
        state.participantRecords = [];
        state.participantRecordCounter = 0;
        state.linkedWorkshopCodes = [];
        state.completedWorkshopCodes = [];
        state.pinnedWorkshopCodes = [];
        state.hasWorkshopSearch = false;
        state.workshopSearchQuery = "";
        state.workshopSearchMode = "";
        state.workshopSearchFilters = [];
        state.workshopSearchHistory = [];
        state.workshopSearchMatchedTerms = [];
        state.workshopSearchResults = [];
        resetWorkshopSearchDetailState();
        state.selectedWorkshopCode = "";
        state.selectedWorkshopSource = "";
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        state.activeView = "home";
        resetResearchObjectives();
        metrics.trackView("home");
        notify();
      },

      showParticipantOperationFailure() {
        onToast(TOAST_MESSAGES.participantOperation);
      },

      openWorkshop(workshopCode, source = "catalog") {
        const workshop = getWorkshopByCode(workshopCode);

        if (!workshop) {
          return false;
        }

        state.selectedWorkshopCode = workshop.cod;
        state.selectedWorkshopSource = source;
        state.isOfficeModalOpen = true;
        state.isConfirmModalOpen = false;

        if (state.isLoggedIn) {
          addParticipantRecord(`Acessou oficina “${workshop.title}”`);
        }

        handleWorkshopOpened(workshop, source);
        notify();
        return true;
      },

      openManageWorkshopDetail(workshopCode, source = "manage") {
        const workshop = getWorkshopByCode(workshopCode);

        if (!workshop || !state.linkedWorkshopCodes.includes(workshopCode)) {
          return false;
        }

        state.selectedWorkshopCode = workshop.cod;
        state.selectedWorkshopSource = source;
        state.lastManageWorkshopAccessTitle = workshop.title;
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        setActiveView("gerenciar-detalhes");

        if (state.isLoggedIn) {
          addParticipantRecord(`Acessou oficina “${workshop.title}”`);
        }

        handleWorkshopOpened(workshop, source);
        notify();
        return true;
      },

      openSearchResultWorkshop(workshopCode) {
        const navigationCodes = state.workshopSearchResults
          .map((result) => result.code)
          .filter(Boolean);
        const targetIndex = navigationCodes.indexOf(workshopCode);
        const workshop = getWorkshopByCode(workshopCode);

        if (!workshop || targetIndex < 0 || !navigationCodes.length) {
          return false;
        }

        state.selectedWorkshopCode = workshop.cod;
        state.workshopSearchNavigationCodes = navigationCodes.slice();
        state.workshopSearchDetailIndex = targetIndex;
        state.hasConsumedWorkshopSearch = true;
        state.hasWorkshopSearch = false;
        state.workshopSearchMatchedTerms = [];
        state.workshopSearchResults = [];
        state.selectedWorkshopSource = "search_results";
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        setActiveView("pesquisa-detalhes");

        if (state.isLoggedIn) {
          addParticipantRecord(`Acessou oficina “${workshop.title}”`);
        }

        notify();
        return true;
      },

      navigateSearchResultWorkshop(direction) {
        const step = Number.parseInt(String(direction || 0), 10);
        const targetIndex = state.workshopSearchDetailIndex + step;

        if (
          !Number.isFinite(step)
          || !state.workshopSearchNavigationCodes.length
          || targetIndex < 0
          || targetIndex >= state.workshopSearchNavigationCodes.length
        ) {
          return false;
        }

        const workshop = getWorkshopByCode(state.workshopSearchNavigationCodes[targetIndex]);

        if (!workshop) {
          return false;
        }

        state.selectedWorkshopCode = workshop.cod;
        state.workshopSearchDetailIndex = targetIndex;
        state.selectedWorkshopSource = "search_results";
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        setActiveView("pesquisa-detalhes");

        if (state.isLoggedIn) {
          addParticipantRecord(`Acessou oficina “${workshop.title}”`);
        }

        notify();
        return true;
      },

      navigateManageWorkshopDetail(direction) {
        const step = Number.parseInt(String(direction || 0), 10);
        const currentIndex = state.linkedWorkshopCodes.indexOf(state.selectedWorkshopCode);
        const targetIndex = currentIndex + step;

        if (
          !Number.isFinite(step)
          || currentIndex < 0
          || targetIndex < 0
          || targetIndex >= state.linkedWorkshopCodes.length
        ) {
          return false;
        }

        const workshop = getWorkshopByCode(state.linkedWorkshopCodes[targetIndex]);

        if (!workshop) {
          return false;
        }

        state.selectedWorkshopCode = workshop.cod;
        state.selectedWorkshopSource = "manage";
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        setActiveView("gerenciar-detalhes");

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
        state.selectedWorkshopSource = "";
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
        const shouldKeepSearchDetailOpen = uiVersion === "v1" && state.activeView === "pesquisa-detalhes";

        if (!workshop) {
          return false;
        }

        if (!state.isLoggedIn) {
          metrics.trackError("inscricao_sem_identificacao");
          onToast(TOAST_MESSAGES.blockedAccess);
          return false;
        }

        if (workshop.status === "Fechada") {
          metrics.trackError("inscricao_em_oficina_fechada");
          return false;
        }

        if (!state.linkedWorkshopCodes.includes(workshop.cod)) {
          state.linkedWorkshopCodes.unshift(workshop.cod);
        }

        addParticipantRecord(`Realizou inscrição em oficina “${workshop.title}”`);
        handleWorkshopLinked(workshop);

        if (shouldKeepSearchDetailOpen) {
          state.isOfficeModalOpen = false;
          state.isConfirmModalOpen = false;
          notify();
          return true;
        }

        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;
        state.selectedWorkshopCode = "";
        notify();
        return true;
      },

      confirmWorkshopCancellation() {
        const workshop = getWorkshopByCode(state.selectedWorkshopCode);
        const shouldKeepSearchDetailOpen = uiVersion === "v1" && state.activeView === "pesquisa-detalhes";
        const shouldKeepManageDetailOpen = uiVersion === "v1" && state.activeView === "gerenciar-detalhes";

        if (!workshop) {
          state.isConfirmModalOpen = false;
          notify();
          return false;
        }

        const linkedIndex = state.linkedWorkshopCodes.indexOf(workshop.cod);

        if (linkedIndex >= 0) {
          state.linkedWorkshopCodes.splice(linkedIndex, 1);
          if (!state.completedWorkshopCodes.includes(workshop.cod)) {
            state.completedWorkshopCodes.unshift(workshop.cod);
          }
          state.pinnedWorkshopCodes = state.pinnedWorkshopCodes.filter((code) => code !== workshop.cod);
          addParticipantRecord(`Cancelou inscrição em oficina “${workshop.title}”`);
          handleWorkshopCancellation(workshop);
        }

        state.isConfirmModalOpen = false;

        if (shouldKeepSearchDetailOpen) {
          notify();
          return true;
        }

        if (shouldKeepManageDetailOpen) {
          if (!state.linkedWorkshopCodes.length) {
            state.selectedWorkshopCode = "";
            setActiveView("gerenciar");
            notify();
            return true;
          }

          if (!state.linkedWorkshopCodes.includes(state.selectedWorkshopCode)) {
            const nextIndex = Math.min(linkedIndex, state.linkedWorkshopCodes.length - 1);
            state.selectedWorkshopCode = state.linkedWorkshopCodes[nextIndex];
          }

          notify();
          return true;
        }

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
          handlePinnedWorkshopChange(workshop, false);
        } else {
          state.pinnedWorkshopCodes.unshift(workshopCode);
          addParticipantRecord(`Fixou oficina "${workshop.title}" no Menu Rapido`);
          handlePinnedWorkshopChange(workshop, true);
        }

        notify();
        return true;
      },

      performWorkshopSearch({ query, mode, filter }) {
        const trimmedQuery = String(query || "").trim();
        const normalizedFilters = normalizeSearchFilters(filter);

        resetWorkshopSearchDetailState();
        state.selectedWorkshopCode = "";
        state.isOfficeModalOpen = false;
        state.isConfirmModalOpen = false;

        if (!trimmedQuery) {
          state.hasWorkshopSearch = false;
          state.workshopSearchQuery = "";
          state.workshopSearchMode = mode || "";
          state.workshopSearchFilters = normalizedFilters.slice();
          state.workshopSearchMatchedTerms = [];
          state.workshopSearchResults = [];
          notify();
          return {
            matchedTerms: [],
            modeLabel: getSearchModeLabel(mode || ""),
            filterLabel: getSearchFilterLabel(normalizedFilters),
            results: [],
          };
        }

        const searchMode = mode || "";
        const searchFilter = normalizedFilters;

        if (!searchMode) {
          return {
            matchedTerms: [],
            modeLabel: getSearchModeLabel(""),
            filterLabel: getSearchFilterLabel(searchFilter),
            results: [],
          };
        }

        const searchResult = runWorkshopSearch({
          query: trimmedQuery,
          mode: searchMode,
          filter: searchFilter,
        });

        state.hasWorkshopSearch = true;
        state.workshopSearchQuery = trimmedQuery;
        state.workshopSearchMode = searchMode;
        state.workshopSearchFilters = searchFilter.slice();
        addSearchHistoryEntry({
          query: trimmedQuery,
          mode: searchMode,
          filters: searchFilter,
        });
        state.hasConsumedWorkshopSearch = false;
        state.workshopSearchMatchedTerms = searchResult.matchedTerms.slice();
        state.workshopSearchResults = searchResult.results.map((result) => ({ ...result }));

        if (state.isLoggedIn) {
          addParticipantRecord(`Executou pesquisa por ${searchResult.modeLabel}`);
        }

        notify();
        return searchResult;
      },

      openObjectiveFailureModal() {
        if (!isResearchTrackingEnabled() || !state.currentObjectiveId) {
          return false;
        }

        state.isObjectiveFailureModalOpen = true;
        state.objectiveFailureTargetId = state.currentObjectiveId;
        state.objectiveFailureDependentIds = collectDependentObjectiveIds(state.currentObjectiveId);
        notify();
        return true;
      },

      closeObjectiveFailureModal() {
        state.isObjectiveFailureModalOpen = false;
        state.objectiveFailureTargetId = "";
        state.objectiveFailureDependentIds = [];
        notify();
      },

      confirmObjectiveFailure() {
        const confirmed = applyObjectiveFailure();

        if (confirmed) {
          notify();
        }

        return confirmed;
      },

      canFinishResearch() {
        const exitObjective = findObjectiveById("3.3");
        return !isResearchTrackingEnabled() || state.currentObjectiveId === "3.3" || (
          exitObjective && exitObjective.status === "falhou"
        );
      },

      requestResearchExit() {
        return handleResearchExitRequest();
      },

      finishMetrics() {
        syncResearchMetrics();
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
