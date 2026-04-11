(function attachv2Renderer(global) {
  function getTextContent(state) {
    return "Olá, Seja Bem Vindo";
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

  function createLinkedWorkshopsMarkup(state) {
    if (!state.linkedWorkshopCodes.length) {
      return '<div class="manage-panel-empty"></div>';
    }

    return state.linkedWorkshopCodes
      .map((code) => state.workshops.find((item) => item.cod === code))
      .filter(Boolean)
      .map((workshop) => `
        <button class="manage-panel-row" type="button" data-workshop-code="${workshop.cod}">
          ${workshop.title}
        </button>
      `)
      .join("");
  }

  function createWorkshopsMarkup(workshops) {
    return workshops.map((workshop) => `
      <button class="offices-row offices-row-button" type="button" data-workshop-code="${workshop.cod}">
        <span class="offices-cell">${workshop.cod}</span>
        <span class="offices-cell">${workshop.title}</span>
        <span class="offices-cell">${workshop.period}</span>
      </button>
    `).join("");
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

  function findObjectiveSetByObjectiveId(state, objectiveId) {
    return (state.objectiveSets || []).find((set) => (
      (set.objectives || []).some((objective) => objective.id === objectiveId)
    )) || null;
  }

  function createObjectiveGuideMarkup(state) {
    if (!state.objectiveSets || !state.objectiveSets.length) {
      return "";
    }

    const allObjectives = state.objectiveSets.flatMap((set) => set.objectives || []);
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

  function getObjectiveTransitionState(state) {
    if (!state.objectiveFeedback) {
      return null;
    }

    const allObjectives = (state.objectiveSets || []).flatMap((set) => set.objectives || []);
    const resolvedCount = allObjectives.filter((objective) => objective.status !== "pendente").length;
    const totalCount = allObjectives.length;
    const transitionObjective = findObjectiveByIdInSets(state, state.objectiveFeedback.objectiveId);
    const transitionSet = findObjectiveSetByObjectiveId(state, state.objectiveFeedback.objectiveId);

    if (!transitionObjective) {
      return null;
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
            <p>As tarefas abaixo nao poderao mais ser concluídas nesta sessao:</p>
            <ul class="objective-failure-list">
              ${state.objectiveFailureDependents.map((objective) => `
                <li>${escapeHTML(objective.id)} - ${escapeHTML(objective.title)}</li>
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
    const elements = {
      appShell: documentRef.querySelector(".app-shell"),
      screenTitle: documentRef.querySelector("#screen-title"),
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
      officesTableBody: documentRef.querySelector("#offices-table-body"),
      toastStack: documentRef.querySelector("#toast-stack"),
      officeModal: documentRef.querySelector("#office-modal"),
      officeModalTitle: documentRef.querySelector("#office-modal-title"),
      officeModalDescription: documentRef.querySelector("#office-modal-description"),
      officeModalCode: documentRef.querySelector("#office-modal-code"),
      officeModalHours: documentRef.querySelector("#office-modal-hours"),
      officeModalModality: documentRef.querySelector("#office-modal-modality"),
      officeModalStatus: documentRef.querySelector("#office-modal-status"),
      officeModalPeriod: documentRef.querySelector("#office-modal-period"),
      officeModalParticipate: documentRef.querySelector("#office-modal-participate"),
      officeModalCancelLink: documentRef.querySelector("#office-modal-cancel-link"),
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
      const nextHidden = !state.objectiveSets || !state.objectiveSets.length;
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

    return {
      elements,

      render(state) {
        latestState = state;
        documentRef.body.classList.toggle("is-session-locked", !state.isResearchStarted);

        if (elements.appShell) {
          elements.appShell.dataset.activeView = state.activeView;
        }

        if (elements.researchGate) {
          elements.researchGate.hidden = state.isResearchStarted;
        }

        if (elements.screenTitle) {
          elements.screenTitle.textContent = getTextContent(state);
        }

        syncObjectiveTransitionState(state);
        renderObjectiveGuide(state);

        elements.views.forEach((view) => {
          const shouldShow = view.id === `view-${state.activeView}`;
          view.hidden = !shouldShow;
          view.classList.toggle("is-active", shouldShow);
        });

        elements.triggers.forEach((trigger) => {
          const isActive = trigger.dataset.view === state.activeView;
          trigger.classList.toggle("is-active", isActive);

          if (trigger.classList.contains("sidebar-link")) {
            if (isActive) {
              trigger.setAttribute("aria-current", "page");
            } else {
              trigger.removeAttribute("aria-current");
            }
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

        if (elements.manageLinkedWorkshops) {
          elements.manageLinkedWorkshops.innerHTML = createLinkedWorkshopsMarkup(state);
        }

        if (elements.officesTableBody) {
          elements.officesTableBody.innerHTML = createWorkshopsMarkup(state.workshops);
        }

        if (elements.officeModal) {
          elements.officeModal.hidden = !state.isOfficeModalOpen;

          if (state.selectedWorkshop) {
            elements.officeModalTitle.textContent = state.selectedWorkshop.title;
            elements.officeModalDescription.textContent = state.selectedWorkshop.description;
            elements.officeModalCode.textContent = state.selectedWorkshop.cod;
            elements.officeModalHours.textContent = state.selectedWorkshop.hours;
            elements.officeModalModality.textContent = state.selectedWorkshop.modality;
            elements.officeModalStatus.textContent = state.selectedWorkshop.status === "Aberta"
              ? "Ativa"
              : state.selectedWorkshop.status;
            elements.officeModalPeriod.textContent = state.selectedWorkshop.period;
            elements.officeModalParticipate.disabled = state.selectedWorkshop.status === "Fechada"
              || state.selectedWorkshopIsLinked;
            elements.officeModalCancelLink.hidden = !state.selectedWorkshopIsLinked;
          }
        }

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

        const toastElement = documentRef.createElement("section");
        toastElement.className = "toast";
        toastElement.setAttribute("role", "status");
        toastElement.innerHTML = `
          <p class="toast-title">${toast.title}</p>
          <p>${toast.message}</p>
        `;

        elements.toastStack.prepend(toastElement);

        window.setTimeout(() => {
          toastElement.remove();
        }, 4000);
      },
    };
  }

  global.SGOARenderers = global.SGOARenderers || {};
  global.SGOARenderers.createv2Renderer = createv2Renderer;
}(window));
