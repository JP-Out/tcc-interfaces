const triggers = document.querySelectorAll(".nav-trigger");
const views = document.querySelectorAll(".content-view");
const screenTitle = document.querySelector("#screen-title");
const toastStack = document.querySelector("#toast-stack");
const appShell = document.querySelector(".app-shell");
const sidebar = document.querySelector(".sidebar");
const sidebarNav = document.querySelector("#sidebar-nav");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const loginSubmitButton = document.querySelector("#login-submit");
const loginResetButton = document.querySelector("#login-reset");
const loginUserInput = document.querySelector("#login-user-input");
const participantModifyButton = document.querySelector(".participant-link");
const participantName = document.querySelector("#participant-name");
const participantIdentifier = document.querySelector("#participant-identifier");
const participantStatus = document.querySelector("#participant-status");
const participantFirstAccess = document.querySelector("#participant-first-access");
const participantLastAccess = document.querySelector("#participant-last-access");
const participantRecordsPanel = document.querySelector(".participant-records");
const participantRecordsHeader = document.querySelector(".participant-records-header");
const participantRecordsBody = document.querySelector("#participant-records-body");
const officesTableBody = document.querySelector("#offices-table-body");
const officeModal = document.querySelector("#office-modal");
const officeModalClose = document.querySelector("#office-modal-close");
const officeModalTitle = document.querySelector("#office-modal-title");
const officeModalDescription = document.querySelector("#office-modal-description");
const officeModalCode = document.querySelector("#office-modal-code");
const officeModalHours = document.querySelector("#office-modal-hours");
const officeModalModality = document.querySelector("#office-modal-modality");
const officeModalStatus = document.querySelector("#office-modal-status");
const officeModalPeriod = document.querySelector("#office-modal-period");
const officeModalParticipate = document.querySelector("#office-modal-participate");
const officeModalCancelLink = document.querySelector("#office-modal-cancel-link");
const manageLinkedWorkshops = document.querySelector("#manage-linked-workshops");
const confirmModal = document.querySelector("#confirm-modal");
const confirmModalSubmit = document.querySelector("#confirm-modal-submit");
const confirmModalClose = document.querySelector("#confirm-modal-close");

const blockedViews = new Set(["participante", "gerenciar"]);
const SIDEBAR_FIRST_OPEN_KEY = "sgoa-sidebar-first-open";
let isLoggedIn = false;
let currentUserIdentifier = "";
let currentParticipantCode = "1145";
let currentFirstAccessDate = "21/03/2026";
let currentLastAccessDateTime = "21/03/2026 - 23:31";
const participantRecords = [];
let participantRecordCounter = 0;
const MAX_VISIBLE_RECORDS = 14;
let selectedWorkshopCode = "";
const linkedWorkshopCodes = [];

const mockWorkshops = [
  {
    cod: "ELT-1529",
    title: "Comandos Elétricos Industriais",
    period: "12/01 a 14/02",
    status: "Fechada",
    modality: "Presencial",
    hours: "20 Hrs",
    description: "Introdução a contatores, relés térmicos, temporizadores e chaves de partida de motores elétricos trifásicos.",
  },
  {
    cod: "ELT-1520",
    title: "Segurança em Instalações - NR10",
    period: "10/02 a 12/03",
    status: "Fechada",
    modality: "EaD",
    hours: "10 Hrs",
    description: "Princípios básicos de segurança, riscos elétricos, EPIs e procedimentos conforme a norma regulamentadora 10.",
  },
  {
    cod: "ELT-4522",
    title: "Instalações Elétricas Prediais",
    period: "20/03 a 22/04",
    status: "Aberta",
    modality: "Semipresencial",
    hours: "40 Hrs",
    description: "Aprenda sobre dimensionamento de condutores, disjuntores e montagem de quadros de distribuição para baixa tensão.",
  },
  {
    cod: "ELT-4462",
    title: "Automação com CLPs Básicos",
    period: "18/03 a 19/04",
    status: "Aberta",
    modality: "EaD",
    hours: "33 Hrs",
    description: "Fundamentos de lógica ladder, configuração de entradas/saídas digitais e programação de Controladores Lógicos Programáveis.",
  },
  {
    cod: "MTR-1002",
    title: "Sistemas de Aterramento e SPDA",
    period: "01/05 a 15/05",
    status: "Aberta",
    modality: "Presencial",
    hours: "15 Hrs",
    description: "Normas técnicas aplicadas, medição de resistência de terra e dimensionamento de proteção contra descargas atmosféricas.",
  },
];

function updateScreenTitle() {
  if (!screenTitle) {
    return;
  }

  screenTitle.textContent = currentUserIdentifier
    ? `Olá, ${currentUserIdentifier}`
    : "Olá, Seja Bem Vindo";
}

function formatDate(date) {
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(date) {
  const formattedDate = formatDate(date);
  const formattedTime = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formattedDate} - ${formattedTime}`;
}

function generateParticipantCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function updateParticipantInfo() {
  if (participantName) {
    participantName.textContent = currentUserIdentifier || "2022667789";
  }

  if (participantIdentifier) {
    participantIdentifier.textContent = currentParticipantCode;
  }

  if (participantStatus) {
    participantStatus.textContent = "Ativo";
  }

  if (participantFirstAccess) {
    participantFirstAccess.textContent = currentFirstAccessDate;
  }

  if (participantLastAccess) {
    participantLastAccess.textContent = currentLastAccessDateTime;
  }
}

function touchLastAccess() {
  currentLastAccessDateTime = formatDateTime(new Date());
  updateParticipantInfo();
}

function renderParticipantRecords() {
  if (!participantRecordsBody) {
    return;
  }

  if (!participantRecords.length) {
    participantRecordsBody.innerHTML = '<p class="participant-records-empty">Nenhum registro disponível.</p>';
    return;
  }

  const createRowsMarkup = (records) => records
    .map((record) => `
      <div class="participant-record-row">
        <span>${record.order}</span>
        <span>${record.message}</span>
      </div>
    `)
    .join("");

  participantRecordsBody.innerHTML = createRowsMarkup(participantRecords);
}

function addParticipantRecord(message) {
  touchLastAccess();
  participantRecordCounter += 1;
  participantRecords.unshift({
    order: participantRecordCounter,
    message,
  });

  if (participantRecords.length > MAX_VISIBLE_RECORDS) {
    participantRecords.pop();
  }

  renderParticipantRecords();
}

function renderLinkedWorkshops() {
  if (!manageLinkedWorkshops) {
    return;
  }

  if (!linkedWorkshopCodes.length) {
    manageLinkedWorkshops.innerHTML = '<div class="manage-panel-empty"></div>';
    return;
  }

  manageLinkedWorkshops.innerHTML = linkedWorkshopCodes
    .map((code) => {
      const workshop = mockWorkshops.find((item) => item.cod === code);

      if (!workshop) {
        return "";
      }

      return `
        <button class="manage-panel-row" type="button" data-workshop-code="${workshop.cod}">
          ${workshop.title}
        </button>
      `;
    })
    .join("");
}

function renderWorkshopsTable() {
  if (!officesTableBody) {
    return;
  }

  officesTableBody.innerHTML = mockWorkshops
    .map((workshop) => `
      <button class="offices-row offices-row-button" type="button" data-workshop-code="${workshop.cod}">
        <span class="offices-cell">${workshop.cod}</span>
        <span class="offices-cell">${workshop.title}</span>
        <span class="offices-cell">${workshop.period}</span>
      </button>
    `)
    .join("");
}

function openWorkshopModal(workshopCode) {
  const workshop = mockWorkshops.find((item) => item.cod === workshopCode);

  if (!workshop || !officeModal) {
    return;
  }

  selectedWorkshopCode = workshop.cod;
  const isLinkedWorkshop = linkedWorkshopCodes.includes(workshop.cod);
  officeModalTitle.textContent = workshop.title;
  officeModalDescription.textContent = workshop.description;
  officeModalCode.textContent = workshop.cod;
  officeModalHours.textContent = workshop.hours;
  officeModalModality.textContent = workshop.modality;
  officeModalStatus.textContent = workshop.status === "Aberta" ? "Ativa" : workshop.status;
  officeModalPeriod.textContent = workshop.period;
  officeModalParticipate.disabled = workshop.status === "Fechada" || isLinkedWorkshop;
  officeModalCancelLink.hidden = !isLinkedWorkshop;
  officeModal.hidden = false;

  if (isLoggedIn) {
    addParticipantRecord(`Acessou oficina “${workshop.title}”`);
  }
}

function closeWorkshopModal() {
  if (!officeModal) {
    return;
  }

  officeModal.hidden = true;
  selectedWorkshopCode = "";
  closeConfirmModal();
}

function openConfirmModal() {
  if (!confirmModal) {
    return;
  }

  confirmModal.hidden = false;
}

function closeConfirmModal() {
  if (!confirmModal) {
    return;
  }

  confirmModal.hidden = true;
}

function setActiveView(viewName) {
  views.forEach((view) => {
    const shouldShow = view.id === `view-${viewName}`;
    view.hidden = !shouldShow;
    view.classList.toggle("is-active", shouldShow);
  });

  if (appShell) {
    appShell.classList.toggle("login-mode", viewName === "identificacao");
    appShell.dataset.activeView = viewName;
  }

  triggers.forEach((trigger) => {
    const isActive = trigger.dataset.view === viewName;
    trigger.classList.toggle("is-active", isActive);

    if (trigger.classList.contains("sidebar-link")) {
      if (isActive) {
        trigger.setAttribute("aria-current", "page");
      } else {
        trigger.removeAttribute("aria-current");
      }
    }
  });
  updateScreenTitle();
  renderParticipantRecords();
}

function setSidebarCollapsed(isCollapsed, options = {}) {
  if (!sidebar || !sidebarToggle) {
    return;
  }

  const { moveFocus = false } = options;
  sidebar.classList.toggle("is-collapsed", isCollapsed);
  sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
  sidebarToggle.setAttribute(
    "aria-label",
    isCollapsed ? "Expandir menu principal" : "Recolher menu principal",
  );

  if (sidebarNav) {
    sidebarNav.setAttribute("aria-hidden", String(isCollapsed));
    sidebarNav.querySelectorAll("button").forEach((button) => {
      button.tabIndex = isCollapsed ? -1 : 0;
    });
  }

  if (moveFocus && isCollapsed) {
    sidebarToggle.focus();
  }
}

function shouldStartWithSidebarOpen() {
  try {
    const hasOpenedBefore = window.localStorage.getItem(SIDEBAR_FIRST_OPEN_KEY) === "true";

    if (hasOpenedBefore) {
      return false;
    }

    window.localStorage.setItem(SIDEBAR_FIRST_OPEN_KEY, "true");
    return true;
  } catch {
    return true;
  }
}

setSidebarCollapsed(!shouldStartWithSidebarOpen());

function showToast(title, message) {
  if (!toastStack) {
    return;
  }

  const toast = document.createElement("section");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <p class="toast-title">${title}</p>
    <p>${message}</p>
  `;

  toastStack.prepend(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4000);
}

function showBlockedAccessToast() {
  showToast(
    "Ação interrompida:",
    "É necessário validar as suas credenciais de acesso principal antes de visualizar esta área.",
  );
}

function showParticipantOperationToast() {
  showToast(
    "Não Realizado:",
    "SYS-OP-004 - Falha na execução da operação solicitada.",
  );
}

function registerViewAccess(viewName) {
  const labels = {
    participante: "Área do Participante",
    gerenciar: "Gerenciar Oficinas",
    oficinas: "Oficinas Cadastradas",
  };

  const label = labels[viewName];

  if (isLoggedIn && label) {
    addParticipantRecord(`Acessou submenu “${label}”`);
  }
}

triggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const nextView = trigger.dataset.view;

    if (blockedViews.has(nextView) && !isLoggedIn) {
      showBlockedAccessToast();
      return;
    }

    registerViewAccess(nextView);
    setActiveView(nextView);

    if (trigger.classList.contains("sidebar-link")) {
      setSidebarCollapsed(true, { moveFocus: true });
    }
  });
});

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    const isCollapsed = sidebar.classList.contains("is-collapsed");
    setSidebarCollapsed(!isCollapsed);
  });
}

if (loginSubmitButton) {
  loginSubmitButton.addEventListener("click", () => {
    isLoggedIn = true;
    currentUserIdentifier = loginUserInput && loginUserInput.value.trim()
      ? loginUserInput.value.trim()
      : "2022667789";
    currentParticipantCode = generateParticipantCode();
    currentFirstAccessDate = formatDate(new Date());
    currentLastAccessDateTime = formatDateTime(new Date());
    participantRecords.length = 0;
    participantRecordCounter = 0;
    linkedWorkshopCodes.length = 0;
    addParticipantRecord("Realizou identificação");
    updateParticipantInfo();
    renderLinkedWorkshops();
    setActiveView("home");
  });
}

if (loginResetButton) {
  loginResetButton.addEventListener("click", () => {
    isLoggedIn = false;
    currentUserIdentifier = "";
    currentParticipantCode = "1145";
    currentFirstAccessDate = "21/03/2026";
    currentLastAccessDateTime = "21/03/2026 - 23:31";
    participantRecords.length = 0;
    participantRecordCounter = 0;
    linkedWorkshopCodes.length = 0;

    if (loginUserInput) {
      loginUserInput.value = "";
    }

    updateParticipantInfo();
    renderParticipantRecords();
    renderLinkedWorkshops();
    setActiveView("home");
  });
}

if (participantModifyButton) {
  participantModifyButton.addEventListener("click", () => {
    showParticipantOperationToast();
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("[data-workshop-code]");

  if (!button) {
    return;
  }

  openWorkshopModal(button.dataset.workshopCode);
});

if (officeModalClose) {
  officeModalClose.addEventListener("click", () => {
    closeWorkshopModal();
  });
}

if (officeModal) {
  officeModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.modalClose === "true") {
      closeWorkshopModal();
    }
  });
}

if (officeModalParticipate) {
  officeModalParticipate.addEventListener("click", () => {
    const workshop = mockWorkshops.find((item) => item.cod === selectedWorkshopCode);

    if (!workshop) {
      return;
    }

    if (!isLoggedIn) {
      showBlockedAccessToast();
      return;
    }

    if (workshop.status === "Fechada") {
      return;
    }

    if (!linkedWorkshopCodes.includes(workshop.cod)) {
      linkedWorkshopCodes.unshift(workshop.cod);
      renderLinkedWorkshops();
    }

    addParticipantRecord(`Realizou inscrição em oficina “${workshop.title}”`);
    closeWorkshopModal();
  });
}

if (officeModalCancelLink) {
  officeModalCancelLink.addEventListener("click", () => {
    if (!selectedWorkshopCode) {
      return;
    }

    openConfirmModal();
  });
}

if (confirmModal) {
  confirmModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.confirmClose === "true") {
      closeConfirmModal();
    }
  });
}

if (confirmModalClose) {
  confirmModalClose.addEventListener("click", () => {
    closeConfirmModal();
  });
}

if (confirmModalSubmit) {
  confirmModalSubmit.addEventListener("click", () => {
    const workshop = mockWorkshops.find((item) => item.cod === selectedWorkshopCode);

    if (!workshop) {
      closeConfirmModal();
      return;
    }

    const linkedIndex = linkedWorkshopCodes.indexOf(workshop.cod);

    if (linkedIndex >= 0) {
      linkedWorkshopCodes.splice(linkedIndex, 1);
      renderLinkedWorkshops();
      addParticipantRecord(`Cancelou inscrição em oficina “${workshop.title}”`);
    }

    closeConfirmModal();
    closeWorkshopModal();
  });
}

const carouselSlides = document.querySelectorAll(".carousel-slide");
const carouselDots = document.querySelectorAll(".carousel-dot");
const carouselActions = document.querySelectorAll("[data-carousel-action]");

let activeSlideIndex = 0;
let carouselIntervalId = null;

function updateCarousel(nextIndex) {
  if (!carouselSlides.length) {
    return;
  }

  activeSlideIndex = (nextIndex + carouselSlides.length) % carouselSlides.length;

  carouselSlides.forEach((slide, index) => {
    slide.classList.toggle("is-active", index === activeSlideIndex);
  });

  carouselDots.forEach((dot, index) => {
    const isActive = index === activeSlideIndex;
    dot.classList.toggle("is-active", isActive);
    dot.setAttribute("aria-pressed", String(isActive));
  });
}

function restartCarousel() {
  if (carouselIntervalId) {
    window.clearInterval(carouselIntervalId);
  }

  carouselIntervalId = window.setInterval(() => {
    updateCarousel(activeSlideIndex + 1);
  }, 4500);
}

carouselActions.forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.carouselAction === "prev" ? -1 : 1;
    updateCarousel(activeSlideIndex + direction);
    restartCarousel();
  });
});

carouselDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    updateCarousel(Number(dot.dataset.carouselIndex));
    restartCarousel();
  });
});

updateCarousel(0);
restartCarousel();
updateParticipantInfo();
renderParticipantRecords();
renderWorkshopsTable();
renderLinkedWorkshops();
updateScreenTitle();
