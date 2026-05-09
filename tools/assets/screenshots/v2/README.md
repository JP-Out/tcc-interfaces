# Screenshots da v2 para metricas

Estes arquivos sao usados como fundo dos SVGs de mouse tracking e heatmap.

O pipeline resolve primeiro `tools/assets/screenshots/v2/<view>.png` antes de cair em `tools/assets/screenshots/common/`.

## Mapeamento

| Contexto registrado | Arquivo |
| --- | --- |
| `home` | `home.png` |
| `home-menu-perfil` | `home-menu-perfil.png` |
| `home-modal-acesso-rapido` | `home-modal-acesso-rapido.png` |
| `oficinas` | `oficinas.png` |
| `oficinas-modal-explorar-oficinas` | `oficinas-modal-explorar-oficinas.png` |
| `gerenciar` | `gerenciar.png` |
| `gerenciar-modal-minhas-oficinas` | `gerenciar-modal-minhas-oficinas.png` |

## Origem

- `prints_v2/tela_inicial.png` -> `home.png`
- `prints_v2/tela_inicial.png` -> `home-menu-perfil.png`
- `prints_v2/tela_inicial_acesso_rapido.png` -> `home-modal-acesso-rapido.png`
- `prints_v2/explorar_oficinas.png` -> `oficinas.png`
- `prints_v2/explorar_oficinas_detalhe.png` -> `oficinas-modal-explorar-oficinas.png`
- `prints_v2/minhas_oficinas.png` -> `gerenciar.png`
- `prints_v2/minhas_oficinas_detalhes.png` -> `gerenciar-modal-minhas-oficinas.png`

Os JSONs antigos da pesquisa registram apenas `home`, `oficinas` e `gerenciar` na v2. Os contextos de modal/menu passam a ser registrados nas proximas coletas apos a atualizacao de `src/v2/app.js`.
