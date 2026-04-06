# Pipeline de métricas em `tools`

Esta pasta agora concentra um pipeline Python único para processar os JSONs exportados pela pesquisa de usabilidade.

## Entry point

O único arquivo executável na raiz é:

```bash
python3 tools/analyze_metrics.py <input> [<input> ...]
```

As entradas podem ser:
- um único arquivo JSON
- vários arquivos JSON
- uma pasta contendo JSONs
- várias pastas e arquivos na mesma execução

## Exemplos

Processar um único arquivo:

```bash
python3 tools/analyze_metrics.py /home/shaka/temp/metrics-v1-2026-04-03_14-53-34-860Z.json
```

Processar uma pasta inteira:

```bash
python3 tools/analyze_metrics.py /home/shaka/temp --recursive
```

Gerar apenas CSVs e gráficos:

```bash
python3 tools/analyze_metrics.py /home/shaka/temp --recursive --only sessions comparison charts
```

Gerar apenas mouse tracking:

```bash
python3 tools/analyze_metrics.py /home/shaka/temp --recursive --only mouse
```

Gerar heatmaps por versão:

```bash
python3 tools/analyze_metrics.py /home/shaka/temp --recursive --only heatmaps --heatmap-scope version
```

## Estrutura

```text
tools/
  analyze_metrics.py
  README.md
  input/
  processing/
  reports/
  visualization/
  assets/
    screenshots/
      common/
      v1/
      v2/
  output/
```

## Saídas

Cada execução cria uma pasta em `tools/output/` com:

- `csv/session_metrics.csv`
- `csv/version_comparison.csv`
- `charts/*.svg`
- `mouse-tracking/<sessao>/*.svg`
- `heatmaps/by-version/<versao>/*.svg`

## Observações

- O pipeline continua compatível com JSONs antigos, inclusive quando faltam `objectiveSets`.
- Screenshots específicas por interface podem ser colocadas em `tools/assets/screenshots/v1/` e `tools/assets/screenshots/v2/`.
- Se não existir screenshot para uma view, o SVG é gerado sobre um canvas neutro.
