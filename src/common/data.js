(function attachCommonData(global) {
  const data = {
    MAX_VISIBLE_RECORDS: 14,
    DEFAULT_LOGIN_IDENTIFIER: "2022667789",
    SIDEBAR_FIRST_OPEN_PREFIX: "sgoa-sidebar-first-open",
    BLOCKED_VIEWS: new Set(["participante", "gerenciar"]),
    VIEW_LABELS: {
      home: "Informações Gerais",
      "pesquisa-geral": "Pesquisa Geral",
      participante: "Área do Participante",
      gerenciar: "Gerenciar Oficinas",
      oficinas: "Oficinas Cadastradas",
      identificacao: "Identificação",
    },
    DEFAULT_PARTICIPANT: {
      identifier: "1145",
      firstAccessDate: "21/03/2026",
      lastAccessDateTime: "21/03/2026 - 23:31",
    },
    TOAST_MESSAGES: {
      blockedAccess: {
        title: "Ação interrompida:",
        message: "É necessário validar as suas credenciais de acesso principal antes de visualizar esta área.",
      },
      participantOperation: {
        title: "Não Realizado:",
        message: "SYS-OP-004 - Falha na execução da operação solicitada.",
      },
    },
    MOCK_WORKSHOPS: [
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
    ],
  };

  global.SGOAData = data;
}(window));
