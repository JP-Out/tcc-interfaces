(function attachV1Renderer(global) {
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

  function createV1Renderer(documentRef) {
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
  global.SGOARenderers.createV1Renderer = createV1Renderer;
}(window));
