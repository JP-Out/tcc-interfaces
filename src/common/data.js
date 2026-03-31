(function attachCommonData(global) {
  function createResearchObjectiveProfile(profileId, periodTarget, exitViewLabel) {
    return {
      id: profileId,
      periodTarget,
      exitViewName: "participante",
      exitViewLabel,
      sets: [
        {
          id: "conjunto-1",
          title: "Busca e Inscricao",
          objectives: [
            {
              id: "1.1",
              title: "Inscreva-se na oficina com o codigo ELM-1806.",
              dependsOn: [],
              target: { workshopCode: "ELM-1806" },
            },
            {
              id: "1.2",
              title: "Encontre e inscreva-se na oficina Montagem de Paineis de Controle.",
              dependsOn: [],
              target: { workshopTitle: "Montagem de Painéis de Controle" },
            },
            {
              id: "1.3",
              title: `Localize oficinas no periodo ${periodTarget} e inscreva-se em pelo menos uma.`,
              dependsOn: [],
              target: { period: periodTarget },
            },
          ],
        },
        {
          id: "conjunto-2",
          title: "Acesso e Gerenciamento",
          objectives: [
            {
              id: "2.1",
              title: "Encontre suas inscricoes e acesse a oficina ELM-1806.",
              dependsOn: ["1.1"],
              target: { workshopCode: "ELM-1806", source: "manage" },
            },
            {
              id: "2.2",
              title: "Acesse Montagem de Paineis de Controle e cancele sua inscricao nela.",
              dependsOn: ["1.2"],
              target: { workshopTitle: "Montagem de Painéis de Controle", source: "manage" },
            },
            {
              id: "2.3",
              title: `Abra a oficina inscrita do periodo ${periodTarget} e adicione ao acesso rapido.`,
              dependsOn: ["1.3"],
              target: { period: periodTarget, source: "manage" },
            },
          ],
        },
        {
          id: "conjunto-3",
          title: "Acesso Rapido e Encerramento",
          objectives: [
            {
              id: "3.1",
              title: "Acesse a oficina salva no acesso rapido pela tela inicial.",
              dependsOn: ["2.3"],
              target: { source: "quick_access" },
            },
            {
              id: "3.2",
              title: "Remova a oficina do acesso rapido e cancele sua inscricao nela.",
              dependsOn: ["3.1"],
              target: { sourceObjectiveId: "3.1" },
            },
            {
              id: "3.3",
              title: `Acesse ${exitViewLabel} e encontre a opcao para sair e encerrar a atividade.`,
              dependsOn: ["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1", "3.2"],
              target: { viewName: "participante", viewLabel: exitViewLabel },
            },
          ],
        },
      ],
    };
  }

  const data = {
    MAX_VISIBLE_RECORDS: 20,
    DEFAULT_LOGIN_IDENTIFIER: "2022667789",
    SIDEBAR_FIRST_OPEN_PREFIX: "sgoa-sidebar-first-open",
    RESEARCH_TASK_ID: "research-objectives",
    RESEARCH_OBJECTIVE_PROFILES: {
      v1: createResearchObjectiveProfile("v1-default", "11/05 a 31/05", "Área do Participante"),
      v2: createResearchObjectiveProfile("v2-default", "05/04 a 25/04", "Área do Participante"),
    },
    BLOCKED_VIEWS: new Set(["participante", "gerenciar", "gerenciar-detalhes"]),
    VIEW_LABELS: {
      home: "Informações Gerais",
      "pesquisa-geral": "Pesquisa Geral",
      "pesquisa-detalhes": "Consulta Detalhada",
      participante: "Área do Participante",
      gerenciar: "Gerenciar Oficinas",
      "gerenciar-detalhes": "Gerenciar Oficinas",
      oficinas: "Oficinas Cadastradas",
      identificacao: "Identificação",
    },
    DEFAULT_PARTICIPANT: {
      identifier: "1145",
      course: "Eletro-mecânica",
      firstAccessDate: "21/03/2026",
      lastAccessDateTime: "21/03/2026 - 23:31",
    },
    SYSTEM_VERSION: "SGOA 1.7.4",
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
      // DUPLICADAS (8 pares)

      {
        cod: "ELM-1801",
        title: "Leitura de Diagramas Elétricos Industriais",
        period: "01/02 a 15/02",
        status: "Fechada",
        modality: "Presencial",
        hours: "12 Hrs",
        description: "Interpretação de esquemas elétricos e identificação de componentes em circuitos industriais.",
      },
      {
        cod: "ELM-1802",
        title: "Leitura de Diagramas Elétricos Industriais",
        period: "05/04 a 25/04",
        status: "Aberta",
        modality: "Presencial",
        hours: "12 Hrs",
        description: "Interpretação de esquemas elétricos e identificação de componentes em circuitos industriais.",
      },

      {
        cod: "ELM-1803",
        title: "Montagem de Painéis de Controle",
        period: "16/02 a 28/02",
        status: "Fechada",
        modality: "Presencial",
        hours: "24 Hrs",
        description: "Organização, fixação e ligação de dispositivos em painéis de comando eletromecânicos.",
      },
      {
        cod: "ELM-1804",
        title: "Montagem de Painéis de Controle",
        period: "05/04 a 25/04",
        status: "Aberta",
        modality: "Presencial",
        hours: "24 Hrs",
        description: "Organização, fixação e ligação de dispositivos em painéis de comando eletromecânicos.",
      },

      {
        cod: "ELM-1805",
        title: "Sensores e Atuadores Industriais",
        period: "01/03 a 15/03",
        status: "Fechada",
        modality: "EaD",
        hours: "10 Hrs",
        description: "Funcionamento e aplicação de sensores e atuadores em sistemas automatizados.",
      },
      {
        cod: "ELM-1806",
        title: "Sensores e Atuadores Industriais",
        period: "05/04 a 25/04",
        status: "Aberta",
        modality: "EaD",
        hours: "10 Hrs",
        description: "Funcionamento e aplicação de sensores e atuadores em sistemas automatizados.",
      },

      {
        cod: "ELM-1807",
        title: "Manutenção de Motores Elétricos",
        period: "16/03 a 31/03",
        status: "Fechada",
        modality: "Presencial",
        hours: "20 Hrs",
        description: "Procedimentos básicos de manutenção, testes e diagnóstico de falhas em motores.",
      },
      {
        cod: "ELM-1808",
        title: "Manutenção de Motores Elétricos",
        period: "05/04 a 25/04",
        status: "Aberta",
        modality: "Presencial",
        hours: "20 Hrs",
        description: "Procedimentos básicos de manutenção, testes e diagnóstico de falhas em motores.",
      },

      {
        cod: "ELM-1809",
        title: "Inversores de Frequência na Prática",
        period: "01/04 a 20/04",
        status: "Fechada",
        modality: "EaD",
        hours: "18 Hrs",
        description: "Configuração e operação de inversores para controle de velocidade de motores.",
      },
      {
        cod: "ELM-1810",
        title: "Inversores de Frequência na Prática",
        period: "26/04 a 10/05",
        status: "Aberta",
        modality: "EaD",
        hours: "18 Hrs",
        description: "Configuração e operação de inversores para controle de velocidade de motores.",
      },

      {
        cod: "ELM-1811",
        title: "Transmissões Mecânicas Industriais",
        period: "01/03 a 20/03",
        status: "Fechada",
        modality: "Presencial",
        hours: "20 Hrs",
        description: "Estudo de engrenagens, correias e sistemas de transmissão de movimento.",
      },
      {
        cod: "ELM-1812",
        title: "Transmissões Mecânicas Industriais",
        period: "26/04 a 10/05",
        status: "Aberta",
        modality: "Presencial",
        hours: "20 Hrs",
        description: "Estudo de engrenagens, correias e sistemas de transmissão de movimento.",
      },

      {
        cod: "ELM-1813",
        title: "Lubrificação Industrial",
        period: "21/03 a 31/03",
        status: "Fechada",
        modality: "EaD",
        hours: "8 Hrs",
        description: "Técnicas de lubrificação e prevenção de desgaste em equipamentos.",
      },
      {
        cod: "ELM-1814",
        title: "Lubrificação Industrial",
        period: "26/04 a 10/05",
        status: "Aberta",
        modality: "EaD",
        hours: "8 Hrs",
        description: "Técnicas de lubrificação e prevenção de desgaste em equipamentos.",
      },

      {
        cod: "ELM-1815",
        title: "Hidráulica Industrial",
        period: "15/03 a 05/04",
        status: "Fechada",
        modality: "EaD",
        hours: "32 Hrs",
        description: "Fundamentos de sistemas hidráulicos e seus componentes.",
      },
      {
        cod: "ELM-1816",
        title: "Hidráulica Industrial",
        period: "11/05 a 31/05",
        status: "Aberta",
        modality: "EaD",
        hours: "32 Hrs",
        description: "Fundamentos de sistemas hidráulicos e seus componentes.",
      },

      // RESTANTE (únicas)

      {
        cod: "ELM-1817",
        title: "CLP com Diagnóstico de Falhas",
        period: "11/05 a 31/05",
        status: "Fechada",
        modality: "EaD",
        hours: "36 Hrs",
        description: "Programação e análise de falhas em sistemas automatizados com CLP.",
      },
      {
        cod: "ELM-1818",
        title: "Chaves Fim de Curso e Sensoriamento",
        period: "05/04 a 25/04",
        status: "Aberta",
        modality: "Presencial",
        hours: "10 Hrs",
        description: "Aplicação de dispositivos de posição em automação industrial.",
      },
      {
        cod: "ELM-1819",
        title: "Diagnóstico de Sistemas Eletromecânicos",
        period: "11/05 a 31/05",
        status: "Fechada",
        modality: "EaD",
        hours: "28 Hrs",
        description: "Identificação de falhas em sistemas integrados elétricos e mecânicos.",
      },
      {
        cod: "ELM-1820",
        title: "Manutenção Preditiva Industrial",
        period: "26/04 a 10/05",
        status: "Aberta",
        modality: "EaD",
        hours: "16 Hrs",
        description: "Monitoramento de equipamentos para prevenção de falhas.",
      },
    ],
  };

  global.SGOAData = data;
}(window));
