# AGENTS.md

## Objetivo do Projeto
Este repositório contém um protótipo de pesquisa/TCC para comparar duas interfaces de um mesmo sistema de gestão de oficinas acadêmicas. O foco principal do projeto não é produto real, e sim experimento de usabilidade.

Os objetivos centrais são:
- comparar duas interfaces com a mesma lógica funcional
- observar navegação, esforço, erros e comportamento do usuário
- coletar métricas de interação e exportá-las em JSON para análise posterior

`v1` representa a interface intencionalmente pior ou mais confusa em vários pontos do experimento. `v2` representa a interface melhor, mais clara e mais usável. Mesmo assim, as duas devem continuar permitindo as mesmas tarefas principais.

## Arquitetura Atual
O projeto é estático, usa JavaScript clássico via `window`, e não depende de framework, bundler ou build tool.

Estrutura principal:
- `v1/index.html` e `v2/index.html`: entradas independentes das duas interfaces
- `src/common/data.js`: oficinas mockadas e constantes do sistema
- `src/common/state.js`: estado inicial e estrutura compartilhada
- `src/common/logic.js`: regras funcionais principais
- `src/common/metrics.js`: coleta de métricas e mouse tracking
- `src/common/exporter.js`: exportação das sessões em JSON
- `src/v1/`: `app.js`, `render.js` e `styles.css` da interface ruim
- `src/v2/`: `app.js`, `render.js` e `styles.css` da interface boa

Regra estrutural importante:
- tudo que for comportamento funcional compartilhado deve ficar em `src/common/`
- tudo que for renderização, binding de DOM ou aparência deve ficar em `src/v1/` ou `src/v2/`

## Regras de Produto e UX
`v1` pode conter fricção, ruído visual, busca menos clara, hierarquia pior, distrações, ordens menos previsíveis e outras decisões intencionais para dificultar a experiência. Isso faz parte do experimento e não deve ser “corrigido” sem intenção explícita.

`v2` deve perseguir melhor clareza visual, melhor compreensão de fluxo e melhor usabilidade geral.

Regras obrigatórias:
- não alterar o objetivo funcional das tarefas entre `v1` e `v2`
- não transformar a `v1` em uma interface “boa” por acidente
- não introduzir movimentos grandes de layout, expansão excessiva de painéis ou empurrões no DOM sem necessidade
- qualquer mudança de geometria ou comportamento visual deve considerar impacto em mouse tracking e na pesquisa

## Regras de Desenvolvimento
Preferir mudanças pequenas, modulares e claramente separadas por responsabilidade.

Princípios deste repositório:
- manter separação entre lógica comum, render por interface e estilos por interface
- não compartilhar CSS visual entre `v1` e `v2`
- só mover algo para `common` quando for realmente lógica funcional compartilhada
- ao alterar busca, navegação, login, modal, toast, estado ou métricas, revisar impacto nas duas interfaces
- não remover, simplificar ou quebrar instrumentação experimental sem motivo explícito
- quando possível, fazer commits separados por assunto, especialmente para dataset, lógica e UI

Ao editar:
- preservar o funcionamento atual antes de refinar a interface
- evitar refactors amplos sem necessidade experimental clara
- validar sintaxe dos JS alterados com `node --check`

## Métricas e Pesquisa
O sistema já coleta métricas relevantes do experimento:
- tempo de sessão
- número de cliques
- número de erros
- caminho de navegação
- mouse tracking

O JSON exportado faz parte do experimento e deve continuar compatível sempre que possível. Mudanças nesse fluxo precisam considerar especialmente:
- `sessionId`
- `taskId`
- `navigationPath`
- `mouseTracking`
- estrutura geral de exportação

Evite mudanças que:
- alterem a semântica das métricas sem necessidade
- reduzam a confiabilidade da coleta
- tornem o JSON inconsistente entre sessões

## Fluxo Esperado para Agentes
Antes de editar qualquer coisa, identificar se a mudança é:
- específica de `v1`
- específica de `v2`
- comum às duas interfaces

Ao mexer em UI:
- preservar o fluxo funcional existente
- revisar impacto nas tarefas do experimento
- evitar movimentos ou redimensionamentos desnecessários que prejudiquem a pesquisa

Ao mexer em lógica:
- manter equivalência funcional entre `v1` e `v2`
- checar impacto no estado compartilhado e no JSON exportado

Ao trabalhar no repositório, assumir explicitamente:
- `v1/index.html` e `v2/index.html` são entradas independentes
- `src/common/logic.js` concentra regras funcionais
- `src/common/metrics.js` concentra coleta de métricas
- `src/common/exporter.js` cuida da exportação das sessões
- `src/common/data.js` contém oficinas mockadas e constantes
- `src/v1/` pode receber escolhas intencionalmente piores para a pesquisa
- `src/v2/` deve buscar melhor usabilidade sem mudar o fluxo funcional