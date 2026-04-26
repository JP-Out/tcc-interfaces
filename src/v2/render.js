(function attachv2Renderer(global) {
  function getTextContent(state) {
    if (state && state.activeView === "oficinas") {
      return "Explorar Oficinas";
    }

    if (state && state.activeView === "gerenciar") {
      return "Minhas Oficinas";
    }

    return "Sistema de Gestão de Oficinas Acadêmicas";
  }

  const ONBOARDING_TOUR_STEPS = [
    {
      id: "card",
      spotlightTarget: "card",
      arrowSrc: "../assets/icons/onboarding-tour/arrow-1.svg",
      descriptionMarkup: 'Este <span class="onboarding-tour-emphasis">cartão</span> acima mostra o título e a tarefa do desafio atual.',
      activeDots: 1,
    },
    {
      id: "progress",
      spotlightTarget: ".objective-guide-progress-pill",
      arrowSrc: "../assets/icons/onboarding-tour/arrow-2.svg",
      descriptionMarkup: 'O <span class="onboarding-tour-emphasis">progresso</span> indica quantos desafios foram concluídos.',
      activeDots: 2,
    },
    {
      id: "abandon",
      spotlightTarget: ".objective-guide-abandon-button",
      arrowSrc: "../assets/icons/onboarding-tour/arrow-3.svg",
      descriptionMarkup: 'Use <span class="onboarding-tour-emphasis">Desistir</span> apenas em último caso, quando não conseguir concluir um desafio.',
      activeDots: 3,
    },
  ];
  const ACTIVE_ONBOARDING_TOUR_STEP_COUNT = 3;
  const OFFICE_MODAL_LINKED_EXIT_ANIMATION_MS = 500;
  const WORKSHOP_TONE_NAMES = [
    "lime",
    "rose",
    "green",
    "orange",
    "yellow",
    "magenta",
    "blue",
    "cyan",
  ];

  function getWorkshopToneName(workshop, workshops) {
    const workshopTitle = workshop && workshop.title ? workshop.title : "";
    const workshopTitles = [];

    (workshops || []).forEach((item) => {
      if (item && item.title && !workshopTitles.includes(item.title)) {
        workshopTitles.push(item.title);
      }
    });

    const toneIndex = Math.max(workshopTitles.indexOf(workshopTitle), 0);

    return WORKSHOP_TONE_NAMES[toneIndex % WORKSHOP_TONE_NAMES.length];
  }

  function getWorkshopToneClass(workshop, workshops, prefix) {
    return `${prefix}-${getWorkshopToneName(workshop, workshops)}`;
  }

  function getActiveOnboardingTourStep(state) {
    const requestedIndex = Number.isInteger(state && state.onboardingTourStepIndex)
      ? state.onboardingTourStepIndex
      : 0;
    const maxIndex = Math.min(ACTIVE_ONBOARDING_TOUR_STEP_COUNT, ONBOARDING_TOUR_STEPS.length) - 1;
    const stepIndex = Math.min(Math.max(requestedIndex, 0), maxIndex);

    return ONBOARDING_TOUR_STEPS[stepIndex] || ONBOARDING_TOUR_STEPS[0];
  }

  function createParticipantRecordsMarkup(records) {
    if (!records.length) {
      return '<p class="participant-records-empty">Nenhum registro disponível.</p>';
    }

    return records.map((record) => `
      <div class="participant-record-row">
        <span>${record.order}</span>
        <span>${record.message}</span>
      </div>
    `).join("");
  }

  function getLinkedWorkshops(state, modalityFilter) {
    return (state.linkedWorkshopCodes || [])
      .map((code) => state.workshops.find((item) => item.cod === code))
      .filter(Boolean)
      .filter((workshop) => matchesExploreModalityFilter(workshop, modalityFilter));
  }

  function getPinnedWorkshops(state) {
    return (state.pinnedWorkshopCodes || [])
      .map((code) => state.workshops.find((item) => item.cod === code))
      .filter(Boolean);
  }

  function getWorkshopCollectionSignature(workshops) {
    return (workshops || []).map((workshop) => [
      workshop.cod,
      workshop.title,
      workshop.status,
      workshop.modality,
      workshop.hours,
    ].join(":")).join("|");
  }

  function createLinkedWorkshopsMarkup(state, modalityFilter) {
    if (!state.linkedWorkshopCodes.length) {
      return `
        <div class="offices-empty-state manage-empty-state">
          <img
            class="offices-empty-icon"
            src="../assets/icons/v2-template/oficinas_vazias_icone.svg"
            alt=""
            aria-hidden="true"
            draggable="false"
          >
          <p>Nenhuma oficina inscrita no momento.</p>
          <p>Explore oficinas disponíveis para realizar uma inscrição.</p>
        </div>
      `;
    }

    const linkedWorkshops = getLinkedWorkshops(state, modalityFilter);

    if (!linkedWorkshops.length) {
      return `
        <div class="offices-empty-state manage-empty-state">
          <img
            class="offices-empty-icon"
            src="../assets/icons/v2-template/oficinas_vazias_icone.svg"
            alt=""
            aria-hidden="true"
            draggable="false"
          >
          <p>Nenhuma oficina inscrita nesta modalidade.</p>
          <p>Escolha outra modalidade para visualizar suas oficinas.</p>
        </div>
      `;
    }

    return createWorkshopCardsMarkup(linkedWorkshops, state.workshops, "manage");
  }

  function formatWorkshopHours(value) {
    return String(value || "")
      .replace(/\bHrs?\b/i, "horas")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getWorkshopModalityLabel(modality) {
    return modality;
  }

  function createHomeQuickAccessMarkup(state) {
    const pinnedWorkshops = getPinnedWorkshops(state);

    if (!pinnedWorkshops.length) {
      return `
        <div class="home-quick-empty-state">
          <img
            class="home-quick-empty-icon"
            src="../assets/icons/v2-template/acesso_rapido_vazio_icone.svg"
            alt=""
            aria-hidden="true"
            draggable="false"
          >
          <p>Parece que você não possui nenhuma oficina fixada ao acesso rapido no momento.</p>
        </div>
      `;
    }

    const pinnedWorkshopsMarkup = pinnedWorkshops.map((workshop, index) => `
      <button
        class="home-quick-card ${getWorkshopToneClass(workshop, state.workshops, "home-quick-card")}"
        type="button"
        style="--home-quick-card-index: ${index};"
        data-workshop-code="${escapeHTML(workshop.cod)}"
        data-workshop-source="quick_access"
      >
        <span class="home-quick-title">
          <span class="home-quick-title-text">${escapeHTML(workshop.title)}</span>
        </span>
        <span class="home-quick-meta">Código: <strong>${escapeHTML(workshop.cod)}</strong></span>
        <span class="home-quick-details">
          <span>Carga: <strong>${escapeHTML(formatWorkshopHours(workshop.hours))}</strong></span>
          <span>Modalidade: <strong>${escapeHTML(getWorkshopModalityLabel(workshop.modality))}</strong></span>
        </span>
      </button>
    `).join("");
    const placeholderCount = pinnedWorkshops.length < 4
      ? 4 - pinnedWorkshops.length
      : pinnedWorkshops.length % 2;
    const placeholdersMarkup = Array.from({ length: placeholderCount }, (_, index) => `
      <div
        class="home-quick-placeholder"
        aria-hidden="true"
        data-placeholder-index="${index + 1}"
      ></div>
    `).join("");

    return `${pinnedWorkshopsMarkup}${placeholdersMarkup}`;
  }

  function normalizeExploreSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function extractExploreCodeDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizeExploreCode(value) {
    const digits = extractExploreCodeDigits(value);

    if (!digits) {
      return "";
    }

    return `ELM-${digits}`;
  }

  function matchesExploreStatusFilter(workshop, statusFilter) {
    if (statusFilter === "closed") {
      return workshop.status === "Fechada";
    }

    if (statusFilter === "all") {
      return true;
    }

    return workshop.status === "Aberta";
  }

  function matchesExploreModalityFilter(workshop, modalityFilter) {
    if (!modalityFilter || modalityFilter === "all") {
      return true;
    }

    return workshop.modality === modalityFilter;
  }

  function filterExploreWorkshops(workshops, searchState) {
    const titleQuery = normalizeExploreSearchText(searchState.title);
    const codeQuery = normalizeExploreCode(searchState.code);

    if (!titleQuery && !codeQuery) {
      return [];
    }

    return workshops.filter((workshop) => {
      if (!matchesExploreStatusFilter(workshop, searchState.status)) {
        return false;
      }

      if (!matchesExploreModalityFilter(workshop, searchState.modality)) {
        return false;
      }

      if (titleQuery && !normalizeExploreSearchText(workshop.title).includes(titleQuery)) {
        return false;
      }

      if (codeQuery && !normalizeExploreCode(workshop.cod).startsWith(codeQuery)) {
        return false;
      }

      return true;
    });
  }

  function filterExploreWorkshopsByActiveFilters(workshops, searchState) {
    return (workshops || []).filter((workshop) => (
      matchesExploreStatusFilter(workshop, searchState.status)
        && matchesExploreModalityFilter(workshop, searchState.modality)
    ));
  }

  function createExploreEmptyMarkup() {
    return `
      <div class="offices-empty-state">
        <img
          class="offices-empty-icon"
          src="../assets/icons/v2-template/oficinas_vazias_icone.svg"
          alt=""
          aria-hidden="true"
          draggable="false"
        >
        <p>Nenhuma oficina exibida no momento.</p>
        <p>Digite um código ou título acima para pesquisar oficinas disponíveis.</p>
      </div>
    `;
  }

  function createManageWorkshopPlaceholdersMarkup(workshopCount) {
    const rowCompletionCount = workshopCount > 0 ? (3 - (workshopCount % 3)) % 3 : 0;
    const extraPlaceholderRowCount = workshopCount > 0 && workshopCount <= 3 ? 3 : 0;
    const placeholderCount = rowCompletionCount + extraPlaceholderRowCount;

    return Array.from({ length: placeholderCount }, (_, index) => `
      <div
        class="offices-result-card manage-result-placeholder"
        aria-hidden="true"
        data-placeholder-index="${index + 1}"
      ></div>
    `).join("");
  }

  function createWorkshopCardsMarkup(workshops, allWorkshops, source) {
    const placeholdersMarkup = source === "manage"
      ? createManageWorkshopPlaceholdersMarkup(workshops.length)
      : "";
    const gridAnimationClass = source === "catalog" ? " offices-result-grid-animated" : "";

    return `
      <div class="offices-result-grid${gridAnimationClass}">
        ${workshops.map((workshop, index) => `
          <article
            class="offices-result-card ${getWorkshopToneClass(workshop, allWorkshops, "offices-result-card")}"
            role="button"
            tabindex="0"
            style="--office-card-index: ${index};"
            data-workshop-code="${escapeHTML(workshop.cod)}"
            data-workshop-source="${escapeHTML(source)}"
            aria-label="Abrir detalhes da oficina ${escapeHTML(workshop.title)}"
          >
            <span class="offices-result-card-title">
              <span class="offices-result-card-title-text">${escapeHTML(workshop.title)}</span>
            </span>
            <span class="offices-result-card-meta">Código: <strong>${escapeHTML(workshop.cod)}</strong></span>
            <span class="offices-result-card-details">
              <span>Modalidade: <strong>${escapeHTML(getWorkshopModalityLabel(workshop.modality))}</strong></span>
              <span>Carga Horária: <strong>${escapeHTML(formatWorkshopHours(workshop.hours))}</strong></span>
            </span>
            <span class="offices-result-card-action" aria-hidden="true">
              <img
                src="../assets/icons/v2-template/access_details_icone.svg"
                alt=""
                aria-hidden="true"
                draggable="false"
              >
              <span>Acessar Detalhes</span>
            </span>
          </article>
        `).join("")}
        ${placeholdersMarkup}
      </div>
    `;
  }

  function createExploreWorkshopCardsMarkup(workshops, allWorkshops) {
    return createWorkshopCardsMarkup(workshops, allWorkshops, "catalog");
  }

  function createExploreOfficesMarkup(state, searchState) {
    if (!searchState.hasSearched) {
      return createExploreEmptyMarkup();
    }

    const results = filterExploreWorkshops(state.workshops || [], searchState);

    if (!results.length) {
      return createExploreEmptyMarkup();
    }

    return createExploreWorkshopCardsMarkup(results, state.workshops || []);
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getObjectiveStatusIconPath(variant) {
    const iconPaths = {
      failure: "../assets/icons/objective-card/objective-abandoned.svg",
      success: "../assets/icons/objective-card/objective-completed.svg",
      pending: "../assets/icons/objective-card/objective-pending.svg",
    };

    return iconPaths[variant] || iconPaths.pending;
  }

  function createObjectiveStatusMarkup(variant, options = {}) {
    const { animated = false } = options;
    const pendingClass = variant === "pending"
      ? " objective-guide-status-bullet-pending"
      : "";

    return `
      <span class="objective-guide-status-bullet objective-guide-status-bullet-icon${pendingClass}${animated ? " objective-guide-status-bullet-animated" : ""}" aria-hidden="true">
        <img
          class="objective-guide-status-icon${animated ? " objective-guide-status-icon-transition" : ""}"
          src="${getObjectiveStatusIconPath(variant)}"
          alt=""
        >
      </span>
    `;
  }

  function createObjectiveGuideSideMarkup(progressLabel, options = {}) {
    const {
      showAbandonButton = true,
      disableAbandonButton = false,
    } = options;

    const buttonMarkup = showAbandonButton
      ? `
          <button
            class="objective-guide-abandon-button"
            id="objective-abandon-button"
            type="button"
            ${disableAbandonButton ? "disabled tabindex='-1'" : ""}
          >
            Desistir
          </button>
        `
      : "";

    return `
      <div class="objective-guide-side">
        ${buttonMarkup}
        <span class="objective-guide-progress-pill">${escapeHTML(progressLabel)}</span>
      </div>
    `;
  }

  function findObjectiveByIdInSets(state, objectiveId) {
    return (state.objectiveSets || [])
      .flatMap((set) => set.objectives || [])
      .find((objective) => objective.id === objectiveId) || null;
  }

  function findIntroChallenge(state, objectiveId) {
    if (!state.introChallenge || state.introChallenge.id !== objectiveId) {
      return null;
    }

    return state.introChallenge;
  }

  function findObjectiveSetByObjectiveId(state, objectiveId) {
    return (state.objectiveSets || []).find((set) => (
      (set.objectives || []).some((objective) => objective.id === objectiveId)
    )) || null;
  }

  function createObjectiveGuideMarkup(state) {
    if (state.isOnboardingTourOpen) {
      return `
        <div class="objective-guide-shell objective-guide-shell-intro">
          <div class="objective-guide-copy-block">
            <p class="objective-guide-kicker">Tutorial</p>
            <div class="objective-guide-main-row">
              ${createObjectiveStatusMarkup("pending")}
              <div class="objective-guide-text-block">
                <h2 class="objective-guide-title">Cartão de desafios</h2>
                <p class="objective-guide-copy">Aqui aparece o titulo, descrição e progresso da tarefa.</p>
              </div>
            </div>
          </div>

          ${createObjectiveGuideSideMarkup("0/1", {
            showAbandonButton: true,
            disableAbandonButton: true,
          })}
        </div>
      `;
    }

    if (!state.objectiveSets || !state.objectiveSets.length) {
      return "";
    }

    const allObjectives = state.objectiveSets.flatMap((set) => set.objectives || []);
    const introChallenge = state.introChallenge && state.introChallenge.status === "pendente"
      ? state.introChallenge
      : null;
    const currentObjective = state.currentObjective;
    const currentSet = state.objectiveSets.find((set) => (
      currentObjective && (set.objectives || []).some((objective) => objective.id === currentObjective.id)
    )) || null;
    const resolvedCount = allObjectives.filter((objective) => objective.status !== "pendente").length;
    const totalCount = allObjectives.length;
    const transitionState = getObjectiveTransitionState(state);
    const feedbackObjective = state.objectiveFeedback
      ? findObjectiveByIdInSets(state, state.objectiveFeedback.objectiveId)
      : null;
    const shouldRenderFailureFeedback = state.objectiveFeedback
      && state.objectiveFeedback.status === "falhou"
      && (!transitionState || transitionState.variant !== "failure")
      && feedbackObjective
      && feedbackObjective.resolutionType !== "manual";
    const feedbackMarkup = shouldRenderFailureFeedback
      ? `
          <div class="objective-guide-feedback objective-guide-feedback-${escapeHTML(state.objectiveFeedback.status)}">
            <span class="objective-guide-feedback-icon" aria-hidden="true">X</span>
            <span>${escapeHTML(state.objectiveFeedback.message)}</span>
          </div>
        `
      : "";

    if (!currentObjective || !currentSet) {
      return `
        <div class="objective-guide-shell">
          <div class="objective-guide-copy-block">
            <p class="objective-guide-kicker">Objetivo Atual</p>
            <div class="objective-guide-main-row">
              ${createObjectiveStatusMarkup("success")}
              <div class="objective-guide-text-block">
                <h2 class="objective-guide-title">Sessão finalizada</h2>
                <p class="objective-guide-copy">Todos os objetivos desta sessão já receberam um desfecho.</p>
              </div>
            </div>
          </div>

          ${createObjectiveGuideSideMarkup("9/9", { showAbandonButton: false })}
        </div>

        ${feedbackMarkup}
      `;
    }

    if (introChallenge) {
      return `
        <div class="objective-guide-shell objective-guide-shell-intro">
          <div class="objective-guide-copy-block">
            <p class="objective-guide-kicker">Tutorial</p>
            <div class="objective-guide-main-row">
              ${createObjectiveStatusMarkup("pending")}
              <div class="objective-guide-text-block">
                <h2 class="objective-guide-title">${escapeHTML(introChallenge.title)}</h2>
                <p class="objective-guide-copy">${escapeHTML(introChallenge.description)}</p>
              </div>
            </div>
          </div>

          ${createObjectiveGuideSideMarkup("0/1", {
            showAbandonButton: true,
            disableAbandonButton: true,
          })}
        </div>

        ${feedbackMarkup}
      `;
    }

    const currentStatusVariant = currentObjective.status === "falhou"
      ? "failure"
      : "pending";
    const shouldShowAbandonButton = currentObjective.id !== "3.3";

    return `
      <div class="objective-guide-shell">
        <div class="objective-guide-copy-block">
          <p class="objective-guide-kicker">Objetivo Atual</p>
          <div class="objective-guide-main-row">
            ${createObjectiveStatusMarkup(currentStatusVariant)}
            <div class="objective-guide-text-block">
              <h2 class="objective-guide-title">${escapeHTML(`${currentObjective.id} - ${currentSet.title}`)}</h2>
              <p class="objective-guide-copy">${escapeHTML(currentObjective.title)}</p>
            </div>
          </div>
        </div>

        ${createObjectiveGuideSideMarkup(`${resolvedCount}/${totalCount}`, {
          showAbandonButton: shouldShowAbandonButton,
        })}
      </div>

      ${feedbackMarkup}
    `;
  }

  function createObjectiveTransitionGuideMarkup(transitionState) {
    if (!transitionState) {
      return "";
    }

    const shellVariantClass = transitionState.variant === "failure"
      ? "objective-guide-shell-failure"
      : "objective-guide-shell-completion";

    return `
      <div class="objective-guide-shell ${shellVariantClass}" aria-live="off">
        <div class="objective-guide-copy-block">
          <p class="objective-guide-kicker objective-guide-kicker-transition">${escapeHTML(transitionState.kicker)}</p>
          <div class="objective-guide-main-row">
            ${createObjectiveStatusMarkup(transitionState.variant, { animated: true })}
            <div class="objective-guide-text-block">
              <h2 class="objective-guide-title objective-guide-title-transition">
                <span class="objective-guide-strike-text objective-guide-strike-text-transition">${escapeHTML(transitionState.title)}</span>
              </h2>
              <p class="objective-guide-copy objective-guide-copy-transition">
                <span class="objective-guide-strike-text objective-guide-strike-text-transition">${escapeHTML(transitionState.copy)}</span>
              </p>
            </div>
          </div>
        </div>

        ${createObjectiveGuideSideMarkup(transitionState.progressLabel, {
          showAbandonButton: transitionState.objectiveId !== "3.3",
          disableAbandonButton: true,
        })}
      </div>
    `;
  }

  function createOnboardingTourIndicatorMarkup(step) {
    return ONBOARDING_TOUR_STEPS.map((item, index) => (
      `<span class="${index < step.activeDots ? "is-active" : ""}"></span>`
    )).join("");
  }

  function createOnboardingTourMarkup(step) {
    return `
      <div class="onboarding-tour-backdrop" aria-hidden="true"></div>
      <div class="onboarding-tour-spotlight" aria-hidden="true" data-onboarding-tour-spotlight></div>
      <section class="onboarding-tour-container onboarding-tour-container-${escapeHTML(step.id)}" role="dialog" aria-modal="true" aria-labelledby="onboarding-tour-title">
        <img class="onboarding-tour-arrow" src="${escapeHTML(step.arrowSrc)}" alt="" aria-hidden="true" draggable="false">
        <div class="onboarding-tour-card">
          <h2 id="onboarding-tour-title" class="onboarding-tour-description">
            <span class="onboarding-tour-description-text">${step.descriptionMarkup}</span>
          </h2>
          <div class="onboarding-tour-indicator" aria-hidden="true">
            ${createOnboardingTourIndicatorMarkup(step)}
          </div>
        </div>
        <button class="onboarding-tour-button" type="button" data-onboarding-tour-confirm>
          Entendi
        </button>
      </section>
    `;
  }

  function getObjectiveTransitionState(state) {
    if (!state.objectiveFeedback) {
      return null;
    }

    const allObjectives = (state.objectiveSets || []).flatMap((set) => set.objectives || []);
    const resolvedCount = allObjectives.filter((objective) => objective.status !== "pendente").length;
    const totalCount = allObjectives.length;
    const isIntroTransition = state.objectiveFeedback.resolutionType === "tutorial";
    const transitionObjective = isIntroTransition
      ? findIntroChallenge(state, state.objectiveFeedback.objectiveId)
      : findObjectiveByIdInSets(state, state.objectiveFeedback.objectiveId);
    const transitionSet = findObjectiveSetByObjectiveId(state, state.objectiveFeedback.objectiveId);

    if (!transitionObjective) {
      return null;
    }

    if (isIntroTransition) {
      return {
        key: `${transitionObjective.id}:${state.objectiveFeedback.status}:tutorial`,
        objectiveId: transitionObjective.id,
        variant: "success",
        kicker: "Tutorial concluido",
        title: transitionObjective.title || "",
        copy: transitionObjective.description || state.objectiveFeedback.title || "",
        progressLabel: "1/1",
      };
    }

    if (state.objectiveFeedback.status === "concluido") {
      return {
        key: `concluido:${state.objectiveFeedback.objectiveId}:${resolvedCount}/${totalCount}`,
        variant: "success",
        objectiveId: state.objectiveFeedback.objectiveId,
        kicker: "Objetivo Concluído",
        title: transitionSet
          ? `${state.objectiveFeedback.objectiveId} - ${transitionSet.title}`
          : state.objectiveFeedback.objectiveId,
        copy: state.objectiveFeedback.title || transitionObjective.title || "",
        progressLabel: `${resolvedCount}/${totalCount}`,
      };
    }

    if (state.objectiveFeedback.status === "falhou" && transitionObjective.resolutionType === "manual") {
      return {
        key: `falhou:${state.objectiveFeedback.objectiveId}:${resolvedCount}/${totalCount}`,
        variant: "failure",
        objectiveId: state.objectiveFeedback.objectiveId,
        kicker: "Objetivo Abandonado",
        title: transitionSet
          ? `${state.objectiveFeedback.objectiveId} - ${transitionSet.title}`
          : state.objectiveFeedback.objectiveId,
        copy: state.objectiveFeedback.title || transitionObjective.title || "",
        progressLabel: `${resolvedCount}/${totalCount}`,
      };
    }

    return null;
  }

  function createObjectiveFailureModalMarkup(state) {
    if (!state.objectiveFailureTarget) {
      return "";
    }

    const dependentMarkup = state.objectiveFailureDependents.length
      ? `
          <div class="objective-failure-list-block">
            <p>As tarefas pendentes abaixo não poderão mais ser concluídas nesta sessão:</p>
            <ul class="objective-failure-list">
              ${state.objectiveFailureDependents.map((objective) => `
                <li class="objective-failure-list-item${objective.status === "pendente" ? " is-pending" : ""}">
                  ${escapeHTML(objective.id)} - ${escapeHTML(objective.title)}
                </li>
              `).join("")}
            </ul>
          </div>
        `
      : `
          <p class="objective-failure-copy">
            Nenhuma outra tarefa depende diretamente deste objetivo.
          </p>
        `;

    return `
      <div class="objective-failure-message">
        <p>Tem certeza que deseja desistir do objetivo atual?</p>
        <strong>${escapeHTML(state.objectiveFailureTarget.id)} - ${escapeHTML(state.objectiveFailureTarget.title)}</strong>
      </div>
      ${dependentMarkup}
    `;
  }

  function createv2Renderer(documentRef) {
    const OBJECTIVE_TRANSITION_VISUAL_MS = 3600;
    const OBJECTIVE_STRIKE_REVEAL_START_MS = Math.round(OBJECTIVE_TRANSITION_VISUAL_MS * 0.22);
    const OBJECTIVE_STRIKE_REVEAL_END_MS = Math.round(OBJECTIVE_TRANSITION_VISUAL_MS * 0.64);
    const RESEARCH_GATE_EXIT_ANIMATION_MS = 120;
    const ONBOARDING_TOUR_EXIT_ANIMATION_MS = 220;
    const elements = {
      appShell: documentRef.querySelector(".app-shell"),
      screenTitle: documentRef.querySelector("#screen-title"),
      profileButton: documentRef.querySelector(".profile-button"),
      profileMenu: documentRef.querySelector(".profile-menu"),
      profileButtonIcon: documentRef.querySelector(".profile-button-icon"),
      profileButtonLabel: documentRef.querySelector(".profile-button-label"),
      profileButtonDivider: documentRef.querySelector(".profile-button-divider"),
      profileButtonCaret: documentRef.querySelector(".profile-button-caret"),
      objectiveGuide: documentRef.querySelector("#objective-guide"),
      objectiveFailureModal: documentRef.querySelector("#objective-failure-modal"),
      objectiveFailureContent: documentRef.querySelector("#objective-failure-content"),
      triggers: Array.from(documentRef.querySelectorAll(".nav-trigger")),
      views: Array.from(documentRef.querySelectorAll(".content-view")),
      sidebar: documentRef.querySelector(".sidebar"),
      sidebarNav: documentRef.querySelector("#sidebar-nav"),
      sidebarToggle: documentRef.querySelector("#sidebar-toggle"),
      researchGate: documentRef.querySelector("#research-gate"),
      participantIdentifier: documentRef.querySelector("#participant-identifier"),
      participantStatus: documentRef.querySelector("#participant-status"),
      participantFirstAccess: documentRef.querySelector("#participant-first-access"),
      participantLastAccess: documentRef.querySelector("#participant-last-access"),
      participantRecordsBody: documentRef.querySelector("#participant-records-body"),
      manageLinkedWorkshops: documentRef.querySelector("#manage-linked-workshops"),
      manageModalityButtons: Array.from(documentRef.querySelectorAll("[data-manage-modality-filter]")),
      homeQuickSeparator: documentRef.querySelector(".home-quick-separator"),
      homeQuickAccessGrid: documentRef.querySelector("#home-quick-access-grid"),
      officesTableBody: documentRef.querySelector("#offices-table-body"),
      officesModalityToolbar: documentRef.querySelector(".offices-modality-toolbar"),
      officesModalityButtons: Array.from(documentRef.querySelectorAll("[data-offices-modality-filter]")),
      toastStack: documentRef.querySelector("#toast-stack"),
      officeModal: documentRef.querySelector("#office-modal"),
      officeModalDialog: documentRef.querySelector(".office-modal-dialog"),
      officeModalTitle: documentRef.querySelector("#office-modal-title"),
      officeModalDescription: documentRef.querySelector("#office-modal-description"),
      officeModalCode: documentRef.querySelector("#office-modal-code"),
      officeModalHours: documentRef.querySelector("#office-modal-hours"),
      officeModalModality: documentRef.querySelector("#office-modal-modality"),
      officeModalStatus: documentRef.querySelector("#office-modal-status"),
      officeModalStatusCard: documentRef.querySelector("#office-modal-status-card"),
      officeModalStatusIcon: documentRef.querySelector("#office-modal-status-icon"),
      officeModalStatusNote: documentRef.querySelector("#office-modal-status-note"),
      officeModalPeriod: documentRef.querySelector("#office-modal-period"),
      officeModalParticipate: documentRef.querySelector("#office-modal-participate"),
      officeModalParticipateLabel: documentRef.querySelector("#office-modal-participate-label"),
      officeModalPin: documentRef.querySelector("#office-modal-pin"),
      officeModalPinLabel: documentRef.querySelector("#office-modal-pin-label"),
      officeModalCancelLink: documentRef.querySelector("#office-modal-cancel-link"),
      officeModalActionIcon: documentRef.querySelector("#office-modal-action-icon-img"),
      officeModalActionTitle: documentRef.querySelector("#office-modal-action-title"),
      officeModalActionNote: documentRef.querySelector("#office-modal-action-note"),
      confirmModal: documentRef.querySelector("#confirm-modal"),
      carouselSlides: Array.from(documentRef.querySelectorAll(".carousel-slide")),
      carouselDots: Array.from(documentRef.querySelectorAll(".carousel-dot")),
    };
    let latestState = null;
    let activeObjectiveTransitionState = null;
    let activeObjectiveTransitionTimeout = 0;
    let lastObjectiveTransitionKey = "";
    let lastObjectiveGuideMarkup = "";
    let lastObjectiveGuideHidden = true;
    let lastObjectiveGuideIsTransitioning = false;
    let onboardingTourElement = null;
    let onboardingTourExitTimeout = 0;
    let researchGateExitTimeout = 0;
    let lastExploreResultsSignature = "";
    let lastManageWorkshopsSignature = "";
    let lastQuickAccessSignature = "";
    let lastOfficeModalWorkshopCode = "";
    let lastOfficeModalAvailabilityState = "";
    let officeModalLinkedExitTimeout = 0;
    let officeModalHeightTimeout = 0;
    let officeSearchState = {
      hasSearched: false,
      title: "",
      code: "",
      status: "open",
      modality: "all",
    };
    let manageModalityFilter = "all";

    function clearObjectiveTransitionTimeout() {
      if (!activeObjectiveTransitionTimeout) {
        return;
      }

      global.clearTimeout(activeObjectiveTransitionTimeout);
      activeObjectiveTransitionTimeout = 0;
    }

    function resetObjectiveTransitionState() {
      clearObjectiveTransitionTimeout();
      activeObjectiveTransitionState = null;
      lastObjectiveTransitionKey = "";
    }

    function clearResearchGateExitTimeout() {
      if (!researchGateExitTimeout) {
        return;
      }

      global.clearTimeout(researchGateExitTimeout);
      researchGateExitTimeout = 0;
    }

    function setElementInteractionLocked(element, isLocked) {
      if (!element) {
        return;
      }

      element.inert = isLocked;

      if (isLocked) {
        element.setAttribute("inert", "");
        element.setAttribute("aria-hidden", "true");
        return;
      }

      element.removeAttribute("inert");
      element.removeAttribute("aria-hidden");
    }

    function setResearchGateFocusScope(isLocked) {
      setElementInteractionLocked(elements.appShell, isLocked);
      setElementInteractionLocked(elements.objectiveGuide, isLocked);
    }

    function focusResearchGateAction() {
      if (!elements.researchGate || elements.researchGate.hidden) {
        return;
      }

      const activeElement = documentRef.activeElement;

      if (activeElement && elements.researchGate.contains(activeElement)) {
        return;
      }

      const actionButton = elements.researchGate.querySelector("button");

      if (actionButton) {
        actionButton.focus({ preventScroll: true });
      }
    }

    function syncResearchGateVisibility(state) {
      if (!elements.researchGate) {
        return false;
      }

      const shouldShowGate = !(state.isResearchStarted || state.isResearchGateDismissed);

      if (shouldShowGate) {
        clearResearchGateExitTimeout();
        elements.researchGate.hidden = false;
        elements.researchGate.removeAttribute("aria-hidden");
        elements.researchGate.classList.remove("is-closing");
        focusResearchGateAction();
        setResearchGateFocusScope(true);
        return false;
      }

      if (elements.researchGate.hidden) {
        elements.researchGate.setAttribute("aria-hidden", "true");
        setResearchGateFocusScope(false);
        return false;
      }

      setResearchGateFocusScope(true);

      if (!elements.researchGate.classList.contains("is-closing")) {
        elements.researchGate.classList.add("is-closing");
        researchGateExitTimeout = global.setTimeout(() => {
          elements.researchGate.hidden = true;
          elements.researchGate.setAttribute("aria-hidden", "true");
          elements.researchGate.classList.remove("is-closing");
          researchGateExitTimeout = 0;
          setResearchGateFocusScope(false);
          renderOnboardingTour(latestState);
        }, RESEARCH_GATE_EXIT_ANIMATION_MS);
      }

      return true;
    }

    function prepareSequentialStrikeText() {
      if (!elements.objectiveGuide) {
        return;
      }

      const strikeElements = Array.from(
        elements.objectiveGuide.querySelectorAll(".objective-guide-strike-text-transition"),
      );

      if (!strikeElements.length) {
        return;
      }

      global.requestAnimationFrame(() => {
        strikeElements.forEach((element) => {
          if (!(element instanceof HTMLElement) || !element.isConnected) {
            return;
          }

          if (element.dataset.sequentialStrikeReady === "true") {
            return;
          }

          const fullText = String(element.textContent || "").trim();

          if (!fullText) {
            element.dataset.sequentialStrikeReady = "true";
            return;
          }

          const words = fullText.split(/\s+/).filter(Boolean);

          if (!words.length) {
            element.dataset.sequentialStrikeReady = "true";
            return;
          }

          element.textContent = "";

          const wordElements = words.map((word, index) => {
            const wordElement = documentRef.createElement("span");
            wordElement.className = "objective-guide-strike-word";
            wordElement.textContent = word;
            element.appendChild(wordElement);

            if (index < words.length - 1) {
              element.appendChild(documentRef.createTextNode(" "));
            }

            return wordElement;
          });

          const lineTexts = [];
          let currentLineWords = [];
          let currentLineTop = null;

          wordElements.forEach((wordElement) => {
            const wordTop = Math.round(wordElement.getBoundingClientRect().top);

            if (currentLineTop !== null && Math.abs(wordTop - currentLineTop) > 1) {
              lineTexts.push(currentLineWords.join(" "));
              currentLineWords = [wordElement.textContent || ""];
              currentLineTop = wordTop;
              return;
            }

            currentLineTop = currentLineTop === null ? wordTop : currentLineTop;
            currentLineWords.push(wordElement.textContent || "");
          });

          if (currentLineWords.length) {
            lineTexts.push(currentLineWords.join(" "));
          }

          const revealWindowMs = Math.max(
            OBJECTIVE_STRIKE_REVEAL_END_MS - OBJECTIVE_STRIKE_REVEAL_START_MS,
            1,
          );
          const lineRevealDurationMs = Math.max(revealWindowMs / Math.max(lineTexts.length, 1), 1);

          element.textContent = "";
          element.classList.add("objective-guide-strike-text-sequenced");

          lineTexts.forEach((lineText, index) => {
            const lineElement = documentRef.createElement("span");
            lineElement.className = "objective-guide-strike-line";
            lineElement.textContent = lineText;
            lineElement.style.animationDelay = `${OBJECTIVE_STRIKE_REVEAL_START_MS + (lineRevealDurationMs * index)}ms`;
            lineElement.style.animationDuration = `${lineRevealDurationMs}ms`;
            element.appendChild(lineElement);

            if (index < lineTexts.length - 1) {
              element.appendChild(documentRef.createElement("br"));
            }
          });

          element.dataset.sequentialStrikeReady = "true";
        });
      });
    }

    function renderObjectiveGuide(state) {
      if (!elements.objectiveGuide) {
        return;
      }

      const nextMarkup = activeObjectiveTransitionState
        ? createObjectiveTransitionGuideMarkup(activeObjectiveTransitionState)
        : createObjectiveGuideMarkup(state);
      const nextHidden = (!state.objectiveSets || !state.objectiveSets.length)
        && !state.isOnboardingTourOpen;
      const nextIsTransitioning = Boolean(activeObjectiveTransitionState);

      if (nextMarkup !== lastObjectiveGuideMarkup) {
        elements.objectiveGuide.innerHTML = nextMarkup;
        lastObjectiveGuideMarkup = nextMarkup;
        prepareSequentialStrikeText();
      }

      if (nextHidden !== lastObjectiveGuideHidden) {
        elements.objectiveGuide.hidden = nextHidden;
        lastObjectiveGuideHidden = nextHidden;
      }

      if (nextIsTransitioning !== lastObjectiveGuideIsTransitioning) {
        elements.objectiveGuide.classList.toggle(
          "is-objective-transitioning",
          nextIsTransitioning,
        );
        lastObjectiveGuideIsTransitioning = nextIsTransitioning;
      }
    }

    function syncObjectiveTransitionState(state) {
      if (!state.objectiveSets || !state.objectiveSets.length) {
        resetObjectiveTransitionState();
        return;
      }

      const nextTransitionState = getObjectiveTransitionState(state);

      if (!nextTransitionState || nextTransitionState.key === lastObjectiveTransitionKey) {
        return;
      }

      activeObjectiveTransitionState = nextTransitionState;
      lastObjectiveTransitionKey = nextTransitionState.key;
      clearObjectiveTransitionTimeout();
      activeObjectiveTransitionTimeout = global.setTimeout(() => {
        activeObjectiveTransitionState = null;
        activeObjectiveTransitionTimeout = 0;

        if (latestState) {
          renderObjectiveGuide(latestState);
        }
      }, OBJECTIVE_TRANSITION_VISUAL_MS);
    }

    function getOnboardingTourSpotlightTarget(step) {
      if (!elements.objectiveGuide) {
        return null;
      }

      if (step.spotlightTarget === "card") {
        return elements.objectiveGuide;
      }

      return elements.objectiveGuide.querySelector(step.spotlightTarget);
    }

    function syncOnboardingTourSpotlight(step) {
      if (!onboardingTourElement) {
        return;
      }

      const spotlightLayer = onboardingTourElement.querySelector("[data-onboarding-tour-spotlight]");

      if (!spotlightLayer) {
        return;
      }

      spotlightLayer.innerHTML = "";

      const target = getOnboardingTourSpotlightTarget(step);

      if (!target) {
        return;
      }

      const rect = target.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      const clone = target.cloneNode(true);
      clone.removeAttribute("id");
      clone.removeAttribute("hidden");
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      clone.setAttribute("aria-hidden", "true");
      clone.classList.remove("is-onboarding-focus");
      clone.classList.add(
        "onboarding-tour-spotlight-target",
        step.spotlightTarget === "card"
          ? "onboarding-tour-spotlight-card"
          : "onboarding-tour-spotlight-control",
      );
      clone.style.position = "fixed";
      clone.style.top = `${rect.top}px`;
      clone.style.left = `${rect.left}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      clone.style.margin = "0";
      clone.style.maxWidth = "none";
      clone.style.transform = "none";
      clone.style.pointerEvents = "none";

      spotlightLayer.appendChild(clone);
    }

    function clearOnboardingTourExitTimeout() {
      if (!onboardingTourExitTimeout) {
        return;
      }

      global.clearTimeout(onboardingTourExitTimeout);
      onboardingTourExitTimeout = 0;
    }

    function removeOnboardingTourElement() {
      clearOnboardingTourExitTimeout();

      if (onboardingTourElement) {
        onboardingTourElement.remove();
        onboardingTourElement = null;
      }

      delete documentRef.body.dataset.onboardingTourSpotlight;
    }

    function renderOnboardingTour(state) {
      const shouldShowTour = Boolean(state.isOnboardingTourOpen);
      const tourStep = getActiveOnboardingTourStep(state);

      documentRef.body.classList.toggle("is-onboarding-tour-open", shouldShowTour);

      if (elements.objectiveGuide) {
        elements.objectiveGuide.classList.remove("is-onboarding-focus");
      }

      if (!shouldShowTour) {
        if (!onboardingTourElement) {
          delete documentRef.body.dataset.onboardingTourSpotlight;
          return;
        }

        if (!onboardingTourElement.classList.contains("is-closing")) {
          onboardingTourElement.classList.add("is-closing");
          onboardingTourExitTimeout = global.setTimeout(
            removeOnboardingTourElement,
            ONBOARDING_TOUR_EXIT_ANIMATION_MS,
          );
        }

        return;
      }

      clearOnboardingTourExitTimeout();
      documentRef.body.dataset.onboardingTourSpotlight = tourStep.spotlightTarget;

      if (!onboardingTourElement) {
        onboardingTourElement = documentRef.createElement("div");
        onboardingTourElement.id = "onboarding-tour";
        documentRef.body.appendChild(onboardingTourElement);
      }

      onboardingTourElement.className = `onboarding-tour onboarding-tour-step-${tourStep.id}`;
      onboardingTourElement.dataset.tourStep = tourStep.id;
      onboardingTourElement.innerHTML = createOnboardingTourMarkup(tourStep);
      syncOnboardingTourSpotlight(tourStep);
    }

    function renderExploreOfficesResults(state) {
      const filteredResults = officeSearchState.hasSearched
        ? filterExploreWorkshops(state.workshops || [], officeSearchState)
        : [];
      const isListingAllWorkshops = officeSearchState.hasSearched && filteredResults.length === 0;
      const results = isListingAllWorkshops
        ? filterExploreWorkshopsByActiveFilters(state.workshops || [], officeSearchState)
        : filteredResults;
      const hasResults = results.length > 0;

      if (elements.officesModalityToolbar) {
        elements.officesModalityToolbar.hidden = !hasResults;
      }

      if (elements.officesModalityButtons && elements.officesModalityButtons.length) {
        elements.officesModalityButtons.forEach((button) => {
          const isActive = button.dataset.officesModalityFilter === officeSearchState.modality;
          const iconElement = button.querySelector("img");
          const nextIconSrc = isActive
            ? button.dataset.activeIcon
            : button.dataset.defaultIcon;

          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-pressed", String(isActive));

          if (iconElement && nextIconSrc) {
            iconElement.src = nextIconSrc;
          }
        });
      }

      if (!elements.officesTableBody) {
        return {
          hasResults,
          resultCount: results.length,
          matchedResultCount: filteredResults.length,
          isListingAllWorkshops,
        };
      }

      const searchSignature = [
        officeSearchState.hasSearched ? "searched" : "idle",
        isListingAllWorkshops ? "listing_all" : "filtered",
        officeSearchState.title,
        officeSearchState.code,
        officeSearchState.status,
        officeSearchState.modality,
        results.map((workshop) => [
          workshop.cod,
          workshop.title,
          workshop.status,
          workshop.modality,
          workshop.hours,
        ].join(":")).join("|"),
      ].join("::");

      if (!officeSearchState.hasSearched || !hasResults) {
        if (lastExploreResultsSignature !== searchSignature) {
          elements.officesTableBody.innerHTML = createExploreEmptyMarkup();
          lastExploreResultsSignature = searchSignature;
        }

        return {
          hasResults,
          resultCount: results.length,
          matchedResultCount: filteredResults.length,
          isListingAllWorkshops,
        };
      }

      if (lastExploreResultsSignature !== searchSignature) {
        elements.officesTableBody.innerHTML = createExploreWorkshopCardsMarkup(results, state.workshops || []);
        lastExploreResultsSignature = searchSignature;
      }

      return {
        hasResults,
        resultCount: results.length,
        matchedResultCount: filteredResults.length,
        isListingAllWorkshops,
      };
    }

    function syncManageModalityButtons() {
      if (!elements.manageModalityButtons || !elements.manageModalityButtons.length) {
        return;
      }

      elements.manageModalityButtons.forEach((button) => {
        const isActive = button.dataset.manageModalityFilter === manageModalityFilter;
        const iconElement = button.querySelector("img");
        const nextIconSrc = isActive
          ? button.dataset.activeIcon
          : button.dataset.defaultIcon;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));

        if (iconElement && nextIconSrc) {
          iconElement.src = nextIconSrc;
        }
      });
    }

    function renderManageWorkshops(state) {
      syncManageModalityButtons();

      if (elements.manageLinkedWorkshops) {
        const linkedWorkshops = getLinkedWorkshops(state, manageModalityFilter);
        const manageWorkshopsSignature = [
          manageModalityFilter,
          (state.linkedWorkshopCodes || []).join("|"),
          getWorkshopCollectionSignature(linkedWorkshops),
        ].join("::");

        if (lastManageWorkshopsSignature === manageWorkshopsSignature) {
          return;
        }

        elements.manageLinkedWorkshops.classList.toggle(
          "manage-results-body-animated",
          lastManageWorkshopsSignature !== "",
        );
        elements.manageLinkedWorkshops.innerHTML = createLinkedWorkshopsMarkup(state, manageModalityFilter);
        lastManageWorkshopsSignature = manageWorkshopsSignature;
      }
    }

    function renderHomeQuickAccess(state) {
      if (!elements.homeQuickAccessGrid) {
        return;
      }

      const pinnedWorkshops = getPinnedWorkshops(state);
      const quickAccessSignature = [
        "quick_access",
        (state.pinnedWorkshopCodes || []).join("|"),
        getWorkshopCollectionSignature(pinnedWorkshops),
      ].join("::");

      if (lastQuickAccessSignature === quickAccessSignature) {
        return;
      }

      if (elements.homeQuickSeparator) {
        elements.homeQuickSeparator.hidden = pinnedWorkshops.length === 0;
      }

      elements.homeQuickAccessGrid.classList.toggle(
        "home-quick-grid-animated",
        lastQuickAccessSignature !== "",
      );
      elements.homeQuickAccessGrid.innerHTML = createHomeQuickAccessMarkup(state);
      lastQuickAccessSignature = quickAccessSignature;
    }

    function syncOfficeModalLinkedEntryAnimation(shouldAnimate) {
      [
        elements.officeModalStatusCard,
        elements.officeModalParticipate,
        elements.officeModalPin,
        elements.officeModalCancelLink,
      ].forEach((element) => {
        if (element) {
          element.classList.toggle("is-linked-entry-animated", shouldAnimate);
        }
      });
    }

    function syncOfficeModalLinkedExitAnimation(shouldAnimate) {
      [
        elements.officeModalStatusCard,
        elements.officeModalParticipate,
        elements.officeModalPin,
        elements.officeModalCancelLink,
      ].forEach((element) => {
        if (element) {
          element.classList.toggle("is-linked-exit-animated", shouldAnimate);
        }
      });
    }

    function clearOfficeModalLinkedExitTimeout() {
      if (!officeModalLinkedExitTimeout) {
        return;
      }

      global.clearTimeout(officeModalLinkedExitTimeout);
      officeModalLinkedExitTimeout = 0;
    }

    function clearOfficeModalHeightAnimation() {
      if (officeModalHeightTimeout) {
        global.clearTimeout(officeModalHeightTimeout);
        officeModalHeightTimeout = 0;
      }

      if (elements.officeModalDialog) {
        elements.officeModalDialog.classList.remove("is-height-animating");
        elements.officeModalDialog.style.height = "";
        elements.officeModalDialog.style.overflow = "";
      }
    }

    function prepareOfficeModalHeightAnimation(shouldAnimate) {
      if (!shouldAnimate || !elements.officeModalDialog || elements.officeModal.hidden) {
        return 0;
      }

      const previousHeight = elements.officeModalDialog.getBoundingClientRect().height;

      if (!previousHeight) {
        return 0;
      }

      if (officeModalHeightTimeout) {
        global.clearTimeout(officeModalHeightTimeout);
        officeModalHeightTimeout = 0;
      }

      elements.officeModalDialog.classList.remove("is-height-animating");
      elements.officeModalDialog.style.height = "";
      elements.officeModalDialog.style.overflow = "";

      return previousHeight;
    }

    function finishOfficeModalHeightAnimation(previousHeight) {
      if (!previousHeight || !elements.officeModalDialog || elements.officeModal.hidden) {
        return;
      }

      const nextHeight = elements.officeModalDialog.getBoundingClientRect().height;

      if (!nextHeight || Math.abs(nextHeight - previousHeight) < 2) {
        clearOfficeModalHeightAnimation();
        return;
      }

      elements.officeModalDialog.classList.add("is-height-animating");
      elements.officeModalDialog.style.height = `${previousHeight}px`;
      elements.officeModalDialog.style.overflow = "hidden";
      elements.officeModalDialog.offsetHeight;
      elements.officeModalDialog.style.height = `${nextHeight}px`;

      officeModalHeightTimeout = global.setTimeout(() => {
        clearOfficeModalHeightAnimation();
      }, 300);
    }

    function renderOfficeModal(state, options) {
      const forceFinalState = Boolean(options && options.forceFinalState);

      if (!elements.officeModal) {
        syncOfficeModalLinkedEntryAnimation(false);
        syncOfficeModalLinkedExitAnimation(false);
        clearOfficeModalLinkedExitTimeout();
        clearOfficeModalHeightAnimation();
        lastOfficeModalWorkshopCode = "";
        lastOfficeModalAvailabilityState = "";
        return;
      }

      elements.officeModal.hidden = !state.isOfficeModalOpen;

      if (!state.isOfficeModalOpen || !state.selectedWorkshop) {
        syncOfficeModalLinkedEntryAnimation(false);
        syncOfficeModalLinkedExitAnimation(false);
        clearOfficeModalLinkedExitTimeout();
        clearOfficeModalHeightAnimation();
        lastOfficeModalWorkshopCode = "";
        lastOfficeModalAvailabilityState = "";
        return;
      }

      const isWorkshopClosed = state.selectedWorkshop.status === "Fechada";
      const isWorkshopLinked = Boolean(state.selectedWorkshopIsLinked);
      const isManageWorkshopSource = state.selectedWorkshopSource === "manage";
      const availabilityState = isWorkshopClosed
        ? "closed"
        : isWorkshopLinked
          ? "linked"
          : "open";
      const shouldAnimateLinkedExit = !forceFinalState
        && availabilityState === "open"
        && lastOfficeModalWorkshopCode === state.selectedWorkshop.cod
        && lastOfficeModalAvailabilityState === "linked";

      if (
        !forceFinalState
        && availabilityState === "open"
        && lastOfficeModalWorkshopCode === state.selectedWorkshop.cod
        && lastOfficeModalAvailabilityState === "linked-exiting"
      ) {
        return;
      }

      if (shouldAnimateLinkedExit) {
        syncOfficeModalLinkedEntryAnimation(false);
        syncOfficeModalLinkedExitAnimation(true);
        clearOfficeModalLinkedExitTimeout();
        lastOfficeModalAvailabilityState = "linked-exiting";
        officeModalLinkedExitTimeout = global.setTimeout(() => {
          officeModalLinkedExitTimeout = 0;
          syncOfficeModalLinkedExitAnimation(false);

          if (latestState) {
            renderOfficeModal(latestState, { forceFinalState: true });
          }
        }, OFFICE_MODAL_LINKED_EXIT_ANIMATION_MS);
        return;
      }

      clearOfficeModalLinkedExitTimeout();
      syncOfficeModalLinkedExitAnimation(false);

      const statusLabel = isWorkshopClosed
        ? "Fechada"
        : isWorkshopLinked
          ? "Inscrito"
          : "Disponível";
      const statusNote = isWorkshopClosed
        ? "Esta oficina não aceita novas inscrições."
        : isWorkshopLinked
          ? "Você já está inscrito nesta oficina."
          : "Disponível para inscrição.";
      const actionTitle = isWorkshopClosed
        ? "Inscrição indisponível"
        : isWorkshopLinked
          ? "Você já está inscrito"
          : "Inscrever-se nesta oficina";
      const actionNote = isWorkshopClosed
        ? "Confira outra turma ou período disponível para continuar."
        : isWorkshopLinked
          ? ""
          : "A oficina está disponível para você se inscrever agora.";
      const participateLabel = isWorkshopClosed
        ? "Indisponível"
        : isWorkshopLinked
          ? "Minhas Oficinas"
          : "Inscrever-se";
      const statusIconPath = isWorkshopClosed
        ? "../assets/icons/office-modal/error_outline.svg"
        : isWorkshopLinked
          ? "../assets/icons/office-modal/bookmark_added.svg"
          : "../assets/icons/office-modal/check_circle.svg";
      const participateIconPath = isWorkshopClosed
        ? "../assets/icons/office-modal/person_add_disabled.svg"
        : isWorkshopLinked
          ? "../assets/icons/office-modal/open_in_new.svg"
          : "../assets/icons/office-modal/person_add.svg";
      const actionIconPath = isWorkshopClosed
        ? "../assets/icons/office-modal/paste_disable.svg"
        : isWorkshopLinked
          ? "../assets/icons/office-modal/paste_done.svg"
          : "../assets/icons/office-modal/paste.svg";
      const shouldAnimateLinkedEntry = availabilityState === "linked"
        && lastOfficeModalWorkshopCode === state.selectedWorkshop.cod
        && lastOfficeModalAvailabilityState !== ""
        && lastOfficeModalAvailabilityState !== "linked";
      const shouldAnimateModalHeight = lastOfficeModalWorkshopCode === state.selectedWorkshop.cod
        && (
          (
            lastOfficeModalAvailabilityState !== ""
            && lastOfficeModalAvailabilityState !== "linked-exiting"
            && lastOfficeModalAvailabilityState !== availabilityState
          )
          || (forceFinalState && lastOfficeModalAvailabilityState === "linked-exiting")
        );
      const previousModalHeight = prepareOfficeModalHeightAnimation(shouldAnimateModalHeight);

      elements.officeModalTitle.textContent = state.selectedWorkshop.title;
      elements.officeModalDescription.textContent = state.selectedWorkshop.description;
      elements.officeModalCode.textContent = state.selectedWorkshop.cod;
      elements.officeModalHours.textContent = state.selectedWorkshop.hours;
      elements.officeModalModality.textContent = state.selectedWorkshop.modality;
      elements.officeModalStatus.textContent = statusLabel;
      elements.officeModalPeriod.textContent = state.selectedWorkshop.period;
      elements.officeModalParticipate.disabled = isWorkshopClosed;
      elements.officeModalParticipate.hidden = isWorkshopLinked && isManageWorkshopSource;

      if (elements.officeModalParticipate) {
        const participateIcon = elements.officeModalParticipate.querySelector("img");

        if (participateIcon) {
          participateIcon.src = participateIconPath;
        }
      }

      if (elements.officeModalStatusCard) {
        elements.officeModalStatusCard.dataset.availability = availabilityState;
      }

      if (elements.officeModalStatusIcon) {
        elements.officeModalStatusIcon.src = statusIconPath;
      }

      if (elements.officeModalActionIcon) {
        elements.officeModalActionIcon.src = actionIconPath;
      }

      if (elements.officeModalStatusNote) {
        elements.officeModalStatusNote.textContent = statusNote;
      }

      if (elements.officeModalActionTitle) {
        elements.officeModalActionTitle.textContent = actionTitle;
      }

      if (elements.officeModalActionNote) {
        elements.officeModalActionNote.textContent = actionNote;
        elements.officeModalActionNote.hidden = !actionNote;
      }

      if (elements.officeModalParticipateLabel) {
        elements.officeModalParticipateLabel.textContent = participateLabel;
      }

      if (elements.officeModalPin) {
        const isPinned = state.pinnedWorkshopCodes.includes(state.selectedWorkshop.cod);
        const pinLabel = isPinned
          ? "Remover do Acesso Rápido"
          : "Adicionar ao Acesso Rápido";
        const pinIcon = elements.officeModalPin.querySelector("img");

        elements.officeModalPin.hidden = !state.selectedWorkshopIsLinked;
        elements.officeModalPin.dataset.pinState = isPinned ? "remove" : "add";

        if (elements.officeModalPinLabel) {
          elements.officeModalPinLabel.textContent = pinLabel;
        } else {
          elements.officeModalPin.textContent = pinLabel;
        }

        if (pinIcon) {
          pinIcon.src = isPinned
            ? "../assets/icons/office-modal/bookmark_remove.svg"
            : "../assets/icons/office-modal/bookmark_add.svg";
        }
      }

      elements.officeModalCancelLink.hidden = !state.selectedWorkshopIsLinked;
      syncOfficeModalLinkedEntryAnimation(shouldAnimateLinkedEntry);
      lastOfficeModalWorkshopCode = state.selectedWorkshop.cod;
      lastOfficeModalAvailabilityState = availabilityState;
      finishOfficeModalHeightAnimation(previousModalHeight);
    }

    function syncHeaderNavigation(state) {
      if (!elements.profileButton) {
        return;
      }

      const isReturnHomeView = state.activeView === "oficinas" || state.activeView === "gerenciar";
      elements.profileButton.setAttribute(
        "aria-label",
        isReturnHomeView ? "Voltar ao Início" : "Abrir perfil",
      );

      if (elements.profileMenu && isReturnHomeView) {
        elements.profileMenu.open = false;
      }

      if (elements.profileButtonLabel) {
        elements.profileButtonLabel.textContent = isReturnHomeView ? "Voltar ao Início" : "Perfil";
      }

      if (elements.profileButtonIcon) {
        elements.profileButtonIcon.src = isReturnHomeView
          ? "../assets/icons/v2-template/home_icone.svg"
          : "../assets/icons/v2-template/perfil_icone.svg";
      }

      if (elements.profileButtonCaret) {
        elements.profileButtonCaret.hidden = isReturnHomeView;
      }

      if (elements.profileButtonDivider) {
        elements.profileButtonDivider.hidden = isReturnHomeView;
      }
    }

    return {
      elements,

      setOfficeSearch(criteria) {
        officeSearchState = {
          hasSearched: criteria && Object.prototype.hasOwnProperty.call(criteria, "hasSearched")
            ? Boolean(criteria.hasSearched)
            : officeSearchState.hasSearched,
          title: criteria && Object.prototype.hasOwnProperty.call(criteria, "title")
            ? (criteria.title || "")
            : officeSearchState.title,
          code: criteria && Object.prototype.hasOwnProperty.call(criteria, "code")
            ? (criteria.code || "")
            : officeSearchState.code,
          status: criteria && criteria.status ? criteria.status : officeSearchState.status,
          modality: criteria && criteria.modality ? criteria.modality : officeSearchState.modality,
        };

        if (latestState) {
          return renderExploreOfficesResults(latestState);
        }

        return {
          hasResults: false,
          resultCount: 0,
          matchedResultCount: 0,
          isListingAllWorkshops: false,
        };
      },

      setManageModalityFilter(modalityFilter) {
        manageModalityFilter = modalityFilter || "all";

        if (latestState) {
          renderManageWorkshops(latestState);
        }
      },

      render(state) {
        latestState = state;
        documentRef.body.classList.toggle("is-session-locked", !state.isResearchStarted);

        if (elements.appShell) {
          elements.appShell.dataset.activeView = state.activeView;
        }

        const isResearchGateClosing = syncResearchGateVisibility(state);
        syncHeaderNavigation(state);

        if (elements.screenTitle) {
          elements.screenTitle.textContent = getTextContent(state);
        }

        syncObjectiveTransitionState(state);
        renderObjectiveGuide(state);
        renderOnboardingTour(
          isResearchGateClosing
            ? { ...state, isOnboardingTourOpen: false }
            : state,
        );

        elements.views.forEach((view) => {
          const shouldShow = view.id === `view-${state.activeView}`;
          view.hidden = !shouldShow;
          view.classList.toggle("is-active", shouldShow);
        });

        elements.triggers.forEach((trigger) => {
          const isActive = trigger.dataset.view === state.activeView;
          trigger.classList.toggle("is-active", isActive);

          if (isActive) {
            trigger.setAttribute("aria-current", "page");
          } else {
            trigger.removeAttribute("aria-current");
          }
        });

        if (elements.sidebar && elements.sidebarToggle && elements.sidebarNav) {
          elements.sidebar.classList.toggle("is-collapsed", state.isSidebarCollapsed);
          elements.sidebarToggle.setAttribute("aria-expanded", String(!state.isSidebarCollapsed));
          elements.sidebarToggle.setAttribute(
            "aria-label",
            state.isSidebarCollapsed ? "Expandir menu principal" : "Recolher menu principal",
          );
          elements.sidebarNav.setAttribute("aria-hidden", String(state.isSidebarCollapsed));
          Array.from(elements.sidebarNav.querySelectorAll("button")).forEach((button) => {
            button.tabIndex = state.isSidebarCollapsed ? -1 : 0;
          });
        }

        if (elements.participantIdentifier) {
          elements.participantIdentifier.textContent = state.currentParticipantCode;
        }

        if (elements.participantStatus) {
          elements.participantStatus.textContent = "Ativo";
        }

        if (elements.participantFirstAccess) {
          elements.participantFirstAccess.textContent = state.currentFirstAccessDate;
        }

        if (elements.participantLastAccess) {
          elements.participantLastAccess.textContent = state.currentLastAccessDateTime;
        }

        if (elements.participantRecordsBody) {
          elements.participantRecordsBody.innerHTML = createParticipantRecordsMarkup(state.participantRecords);
        }

        renderManageWorkshops(state);

        renderHomeQuickAccess(state);

        renderExploreOfficesResults(state);

        renderOfficeModal(state);

        if (elements.confirmModal) {
          elements.confirmModal.hidden = !state.isConfirmModalOpen;
        }

        if (elements.objectiveFailureModal && elements.objectiveFailureContent) {
          elements.objectiveFailureModal.hidden = !state.isObjectiveFailureModalOpen;
          elements.objectiveFailureContent.innerHTML = createObjectiveFailureModalMarkup(state);
        }

        elements.carouselSlides.forEach((slide, index) => {
          slide.classList.toggle("is-active", index === state.carouselIndex);
        });

        elements.carouselDots.forEach((dot, index) => {
          const isActive = index === state.carouselIndex;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-pressed", String(isActive));
        });
      },

      showToast(toast) {
        if (!elements.toastStack) {
          return;
        }

        const toastVariant = toast && toast.variant === "success" ? "success" : "default";
        const toastIcon = toastVariant === "success"
          ? "../assets/icons/office-modal/check_circle.svg"
          : "../assets/icons/v2-template/toast_info_icone.svg";
        const toastElement = documentRef.createElement("section");
        toastElement.className = toastVariant === "success" ? "toast toast-success" : "toast";
        toastElement.setAttribute("role", "status");
        toastElement.style.setProperty("--toast-duration", "7600ms");
        toastElement.innerHTML = `
          <img class="toast-icon" src="${toastIcon}" alt="" aria-hidden="true" draggable="false">
          <div class="toast-copy">
            <p class="toast-title">${escapeHTML(toast.title)}</p>
            <p>${escapeHTML(toast.message)}</p>
          </div>
        `;

        elements.toastStack.prepend(toastElement);

        const visibleDurationMs = 7600;
        const exitDurationMs = 320;
        let remainingMs = visibleDurationMs;
        let startedAt = window.performance ? window.performance.now() : Date.now();
        let exitTimerId = null;
        let removeTimerId = null;

        function getCurrentTime() {
          return window.performance ? window.performance.now() : Date.now();
        }

        function removeToast() {
          toastElement.remove();
        }

        function beginToastExit() {
          toastElement.classList.add("is-leaving");
          removeTimerId = window.setTimeout(removeToast, exitDurationMs);
        }

        function scheduleToastExit() {
          startedAt = getCurrentTime();
          exitTimerId = window.setTimeout(beginToastExit, remainingMs);
        }

        toastElement.addEventListener("mouseenter", () => {
          if (toastElement.classList.contains("is-leaving")) {
            return;
          }

          window.clearTimeout(exitTimerId);
          window.clearTimeout(removeTimerId);
          remainingMs = Math.max(0, remainingMs - (getCurrentTime() - startedAt));
          toastElement.classList.add("is-paused");
        });

        toastElement.addEventListener("mouseleave", () => {
          if (toastElement.classList.contains("is-leaving")) {
            return;
          }

          toastElement.classList.remove("is-paused");
          scheduleToastExit();
        });

        scheduleToastExit();
      },
    };
  }

  global.SGOARenderers = global.SGOARenderers || {};
  global.SGOARenderers.createv2Renderer = createv2Renderer;
}(window));
