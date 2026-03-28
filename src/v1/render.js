(function attachv1Renderer(global) {
  function getTextContent(state) {
    return state.currentUserIdentifier
      ? `Olá, ${state.currentUserIdentifier}`
      : "Olá, Seja Bem Vindo";
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
      return '<div class="manage-panel-empty">Nenhuma oficina vinculada no momento.</div>';
    }

    return state.linkedWorkshopCodes
      .map((code) => state.workshops.find((item) => item.cod === code))
      .filter(Boolean)
      .map((workshop) => `
        <div class="manage-panel-row">
          <button class="manage-panel-link" type="button" data-workshop-code="${workshop.cod}">
            <span>${workshop.title}</span>
            <small>${workshop.period}</small>
          </button>
          <button
            class="manage-pin-button${state.pinnedWorkshopCodes.includes(workshop.cod) ? " is-active" : ""}"
            type="button"
            data-pin-workshop-action="toggle"
            data-pin-workshop-code="${workshop.cod}"
            aria-pressed="${state.pinnedWorkshopCodes.includes(workshop.cod) ? "true" : "false"}"
          >
            ${state.pinnedWorkshopCodes.includes(workshop.cod) ? "Desfixar" : "Fixar"}
          </button>
        </div>
      `)
      .join("");
  }

  function createQuickMenuMarkup(state) {
    if (!state.linkedWorkshopCodes.length) {
      return '<li><p class="quick-menu-empty">Nenhum componente vinculado</p></li>';
    }

    const pinnedWorkshops = state.pinnedWorkshopCodes
      .map((code) => state.workshops.find((item) => item.cod === code))
      .filter(Boolean);

    if (!pinnedWorkshops.length) {
      return '<li><p class="quick-menu-empty">Use o botao Fixar em oficinas vinculadas para destacar seus atalhos aqui.</p></li>';
    }

    return pinnedWorkshops.map((workshop) => `
      <li class="quick-menu-item">
        <button class="quick-menu-link" type="button" data-workshop-code="${workshop.cod}">
          <span class="quick-menu-title">${workshop.title}</span>
          <span class="quick-menu-meta">${workshop.cod} - ${workshop.period}</span>
        </button>
      </li>
    `).join("");
  }

  function createWorkshopsMarkup(workshops) {
    return workshops.map((workshop) => `
      <div class="offices-row" role="row">
        <span class="offices-cell">${workshop.cod}</span>
        <span class="offices-cell">${workshop.title}</span>
        <span class="offices-cell">${workshop.period}</span>
      </div>
    `).join("");
  }

  function createOfficesPaginationMarkup(state) {
    return Array.from({ length: state.officesTotalPages }, function buildPageButton(_, index) {
      return `
        <button
          class="offices-page-number${index === state.officesPage ? " is-active" : ""}"
          type="button"
          data-offices-page-index="${index}"
          aria-current="${index === state.officesPage ? "page" : "false"}"
        >
          ${index + 1}
        </button>
      `;
    }).join("");
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildSearchMetaLine(workshop, index, query) {
    const variants = [
      [workshop.cod, workshop.hours, workshop.modality],
      [workshop.hours, workshop.cod, workshop.modality],
      [workshop.modality, workshop.hours, workshop.cod],
      [workshop.cod, workshop.modality, workshop.hours],
    ];
    const queryOffset = Array.from(String(query || "")).reduce(
      (total, char) => total + char.charCodeAt(0),
      0,
    );
    const variant = variants[(queryOffset + index) % variants.length];

    return variant.map((item) => escapeHTML(item)).join(" | ");
  }

  function getSearchModeLabel(mode) {
    return mode === "broad"
      ? "Termos de Busca Amplos"
      : mode === "hours"
        ? "Num. da Carga de Horas"
        : mode === "code"
          ? "Codigo de Indetificação da Ofc."
          : "Nenhum escopo selecionado";
  }

  function getSearchFilterLabel(filters) {
    return filters.length === 2
      ? "Situação Ofc. Aberta + Formato OFc. Fisico"
      : filters.includes("physical")
        ? "Formato OFc. Fisico"
        : filters.includes("open")
          ? "Situação Ofc. Aberta"
          : "Sem filtro";
  }

  function createSearchSummaryMarkup(state, defaultMarkup) {
    if (!state.hasWorkshopSearch) {
      if (state.hasConsumedWorkshopSearch) {
        return `
          <h3 id="search-side-heading">Resumo de Consulta</h3>
          <p>
            O retorno anteriormente localizado foi deslocado para a visualização individual e não permanece replicado aqui.
          </p>

          <div class="search-result-empty search-result-empty-transferred">
            A listagem consultada não pode ser retomada nesta área. Para restabelecer outra ordem de registros, realize nova pesquisa.
          </div>
        `;
      }

      return defaultMarkup;
    }

    const modeLabel = getSearchModeLabel(state.workshopSearchMode);
    const filterLabel = getSearchFilterLabel(state.workshopSearchFilters);
    const matchedTermsMarkup = state.workshopSearchMatchedTerms.length
      ? state.workshopSearchMatchedTerms.map((term) => `
          <li class="search-term-chip">${escapeHTML(term)}</li>
        `).join("")
      : '<li class="search-term-chip search-term-chip-muted">Sem termo derivado</li>';
    const searchResultsMarkup = state.workshopSearchResults.length
      ? state.workshopSearchResults
        .map((result, index) => {
          const workshop = state.workshops.find((item) => item.cod === result.code);

          if (!workshop) {
            return "";
          }

          return `
            <button class="search-result-card" type="button" data-search-result-code="${escapeHTML(workshop.cod)}">
              <strong class="search-result-title" title="${escapeHTML(workshop.title)}">${escapeHTML(workshop.title)}</strong>
              <span class="search-result-meta">${buildSearchMetaLine(workshop, index, state.workshopSearchQuery)}</span>
            </button>
          `;
        })
        .join("")
      : `
          <div class="search-result-empty">
            Nenhuma oficina permaneceu compatível após cruzar o campo de busca com o filtro atualmente selecionado.
          </div>
        `;

    return `
      <h3 id="search-side-heading">Resumo de Consulta</h3>
      <p>
        Os elementos abaixo foram reorganizados segundo o modo de busca informado e o filtro mantido em operação.
      </p>

      <div class="search-summary-meta">
        <span><strong>Entrada:</strong> ${escapeHTML(state.workshopSearchQuery)}</span>
        <span><strong>Escopo:</strong> ${escapeHTML(modeLabel)}</span>
        <span><strong>Filtro:</strong> ${escapeHTML(filterLabel)}</span>
      </div>

      <div class="search-summary-block">
        <p class="search-summary-label">Termos mais relevantes</p>
        <ul class="search-term-list">
          ${matchedTermsMarkup}
        </ul>
      </div>

      <div class="search-results-list">
        ${searchResultsMarkup}
      </div>
    `;
  }

  function createSearchHistoryMarkup(state) {
    if (!state.workshopSearchHistory.length) {
      return `
        <div class="search-history-empty">
          Nenhuma busca registrada ainda.
        </div>
      `;
    }

    return state.workshopSearchHistory.map((entry, index) => {
      const modeLabel = entry.mode === "broad"
        ? "Termos de Busca Amplos"
        : entry.mode === "hours"
          ? "Num. da Carga de Horas"
          : "Codigo de Indetificação da Ofc.";
      const filterLabel = entry.filters.length === 2
        ? "Aberta + Presencial"
        : entry.filters.includes("physical")
          ? "Presencial"
          : entry.filters.includes("open")
            ? "Aberta"
            : "Sem filtro";

      return `
        <button
          class="search-history-item"
          type="button"
          data-search-history-index="${index}"
        >
          <strong>${escapeHTML(entry.query)}</strong>
          <span>${escapeHTML(modeLabel)}</span>
          <small>${escapeHTML(filterLabel)}</small>
        </button>
      `;
    }).join("");
  }

  function createSearchDetailMarkup(state) {
    if (!state.selectedWorkshop || !state.workshopSearchNavigationCodes.length || state.searchDetailPosition < 1) {
      return `
        <div class="search-card search-detail-side-card">
          <h3>Detalhamento indisponível</h3>
          <p>Não foi possível reconstruir o registro selecionado para consulta individual.</p>
        </div>
      `;
    }

    const statusLabel = state.selectedWorkshop.status === "Aberta"
      ? "Ativa"
      : state.selectedWorkshop.status;
    return `
      <div class="search-detail-layout">
        <section class="search-card search-detail-main-card" aria-label="Registro detalhado">
          <div class="search-card-header search-detail-header">
            <h3>Registro Individual Reorganizado</h3>
            <p>
              As informações abaixo foram deslocadas para leitura unitária e permanecem em formato acumulado, descritivo e sequencial.
            </p>
          </div>

          <div class="search-detail-record">
            <p><span>Código:</span> ${escapeHTML(state.selectedWorkshop.cod)}</p>
            <p><span>Título:</span> ${escapeHTML(state.selectedWorkshop.title)}</p>
            <p><span>Período:</span> ${escapeHTML(state.selectedWorkshop.period)}</p>
            <p><span>Situação:</span> ${escapeHTML(statusLabel)}</p>
            <p><span>Modalidade:</span> ${escapeHTML(state.selectedWorkshop.modality)}</p>
            <p><span>Carga Horária:</span> ${escapeHTML(state.selectedWorkshop.hours)}</p>
            <p class="search-detail-description-line"><span>Descrição:</span> ${escapeHTML(state.selectedWorkshop.description)}</p>
          </div>
        </section>

        <aside class="search-card search-detail-side-card" aria-label="Movimentação da consulta">
          <h3>Movimentação de Registro</h3>
          <p>
            Demais ocorrências compatíveis continuam disponíveis apenas por deslocamento sequencial dos controles abaixo.
          </p>

          <div class="search-summary-meta search-detail-summary-meta">
            <span><strong>Entrada:</strong> ${escapeHTML(state.workshopSearchQuery)}</span>
            <span><strong>Escopo:</strong> ${escapeHTML(getSearchModeLabel(state.workshopSearchMode))}</span>
            <span><strong>Filtro:</strong> ${escapeHTML(getSearchFilterLabel(state.workshopSearchFilters))}</span>
            <span><strong>Posição:</strong> ${escapeHTML(`${state.searchDetailPosition} de ${state.searchDetailTotal || 1}`)}</span>
          </div>

          <div class="search-summary-block search-detail-action-block">
            <p class="search-summary-label">Ação disponível</p>
            <div class="search-detail-action-buttons">
              <button
                class="header-link search-detail-link-action${state.selectedWorkshopIsLinked ? " is-linked" : ""}"
                type="button"
                data-search-detail-action="participate"
              >
                Vincular
              </button>
              <button class="header-link search-detail-cancel-link" type="button" data-search-detail-action="cancel">
                Cancelar
              </button>
            </div>
          </div>

          <div class="search-summary-block search-detail-navigation-block">
            <p class="search-summary-label">Deslocamento entre oficinas</p>

            <div class="search-detail-navigation-buttons">
              <button class="search-detail-nav-button" type="button" data-search-detail-nav="1">
                Continuar
              </button>
              <button class="search-detail-nav-button" type="button" data-search-detail-nav="-1">
                Voltar
              </button>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  function createv1Renderer(documentRef) {
    const elements = {
      appShell: documentRef.querySelector(".app-shell"),
      screenTitle: documentRef.querySelector("#screen-title"),
      triggers: Array.from(documentRef.querySelectorAll(".nav-trigger")),
      views: Array.from(documentRef.querySelectorAll(".content-view")),
      sidebar: documentRef.querySelector(".sidebar"),
      sidebarNav: documentRef.querySelector("#sidebar-nav"),
      sidebarToggle: documentRef.querySelector("#sidebar-toggle"),
      researchGate: documentRef.querySelector("#research-gate"),
      participantName: documentRef.querySelector("#participant-name"),
      participantIdentifier: documentRef.querySelector("#participant-identifier"),
      participantStatus: documentRef.querySelector("#participant-status"),
      participantFirstAccess: documentRef.querySelector("#participant-first-access"),
      participantLastAccess: documentRef.querySelector("#participant-last-access"),
      participantRecordsBody: documentRef.querySelector("#participant-records-body"),
      manageLinkedWorkshops: documentRef.querySelector("#manage-linked-workshops"),
      quickMenuList: documentRef.querySelector("#quick-menu-list"),
      officesTableBody: documentRef.querySelector("#offices-table-body"),
      officesPagination: documentRef.querySelector("#offices-pagination"),
      searchSideCard: documentRef.querySelector(".search-side-card"),
      searchDetailPanel: documentRef.querySelector("#search-detail-panel"),
      searchHistoryList: documentRef.querySelector("#search-history-list"),
      identificationTrigger: documentRef.querySelector(".header-link[data-view='identificacao']"),
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
    };
    const searchSideCardDefaultMarkup = elements.searchSideCard
      ? elements.searchSideCard.innerHTML
      : "";

    return {
      elements,

      render(state) {
        documentRef.body.classList.toggle("is-session-locked", !state.isResearchStarted);

        if (elements.appShell) {
          elements.appShell.classList.toggle("login-mode", state.activeView === "identificacao");
          elements.appShell.dataset.activeView = state.activeView;
        }

        if (elements.researchGate) {
          elements.researchGate.hidden = state.isResearchStarted;
        }

        if (elements.screenTitle) {
          elements.screenTitle.textContent = getTextContent(state);
        }

        if (elements.identificationTrigger) {
          elements.identificationTrigger.classList.toggle("is-logged-in", state.isLoggedIn);
        }

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

        if (elements.participantName) {
          elements.participantName.textContent = state.currentUserIdentifier || "2022667789";
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

        if (elements.quickMenuList) {
          elements.quickMenuList.innerHTML = createQuickMenuMarkup(state);
        }

        if (elements.officesTableBody) {
          elements.officesTableBody.innerHTML = createWorkshopsMarkup(state.visibleOffices || state.workshops);
        }

        if (elements.officesPagination) {
          elements.officesPagination.innerHTML = createOfficesPaginationMarkup(state);
        }

        if (elements.searchSideCard) {
          elements.searchSideCard.innerHTML = createSearchSummaryMarkup(state, searchSideCardDefaultMarkup);
        }

        if (elements.searchHistoryList) {
          elements.searchHistoryList.innerHTML = createSearchHistoryMarkup(state);
        }

        if (elements.searchDetailPanel) {
          elements.searchDetailPanel.innerHTML = createSearchDetailMarkup(state);
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
            if (elements.officeModalCancelLink) {
              elements.officeModalCancelLink.hidden = !state.selectedWorkshopIsLinked;
            }
          }
        }

        if (elements.confirmModal) {
          elements.confirmModal.hidden = !state.isConfirmModalOpen;
        }

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
  global.SGOARenderers.createv1Renderer = createv1Renderer;
}(window));
