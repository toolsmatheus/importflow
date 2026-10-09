import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  EnvioJobSnapshot,
  ProductValidationResult,
  ValidationCheckSummaryItem,
  ValidationIssue,
} from '@/types'
import { buildSendCheckSummary } from '@/features/produtos/PainelChecagensInconsistencia'
import { skipReasonLabel } from '@/features/produtos/EtapaEnvioHelpers'

const BRAND = {
  firefly: [18, 53, 59] as [number, number, number],
  genoa: [21, 117, 114] as [number, number, number],
  muted: [74, 122, 120] as [number, number, number],
  line: [216, 226, 225] as [number, number, number],
  danger: [178, 51, 51] as [number, number, number],
  warning: [200, 147, 58] as [number, number, number],
  ink: [15, 45, 50] as [number, number, number],
}

export interface RelatorioAlertasPdfInput {
  validationResult?: ProductValidationResult | null
  job?: EnvioJobSnapshot | null
  /** Linhas do CSV (para resolver código de barras por índice/linha). */
  rows?: Record<string, string>[] | null
  /** Nome do arquivo CSV de origem, se conhecido. */
  fileName?: string | null
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number }
}

function groupIssuesByCheck(issues: ValidationIssue[]): Map<string, ValidationIssue[]> {
  const map = new Map<string, ValidationIssue[]>()
  for (const issue of issues) {
    const id = issue.checkId ?? (issue.severity === 'warning' ? 'other_warning' : 'other_error')
    const list = map.get(id) ?? []
    list.push(issue)
    map.set(id, list)
  }
  return map
}

function resolveCheckIssues(
  byCheck: Map<string, ValidationIssue[]>,
  check: ValidationCheckSummaryItem
): ValidationIssue[] {
  const direct = byCheck.get(check.id) ?? []
  if (direct.length > 0) {
    return direct.filter((i) => i.severity === check.severity)
  }
  if (check.id === 'other_error' || check.id === 'other_warning' || check.id === 'other') {
    return (byCheck.get('other') ?? []).filter((i) => i.severity === check.severity)
  }
  return []
}

function csvLine(index: number): string {
  return index >= 0 ? String(index + 2) : '—'
}

function barcodeFromRow(row: Record<string, string> | undefined): string {
  const raw = String(row?.codigobarras ?? '').trim()
  return raw || '—'
}

/** Linha do CSV (1 = cabeçalho) → barras na linha de dados. */
function barcodeByCsvRow(
  rows: Record<string, string>[] | undefined,
  csvRow: number
): string {
  if (!rows || csvRow < 2) return '—'
  return barcodeFromRow(rows[csvRow - 2])
}

/** Índice 0-based do payload de envio → barras. */
function barcodeBySendIndex(
  rows: Record<string, string>[] | undefined,
  index: number
): string {
  if (!rows || index < 0) return '—'
  return barcodeFromRow(rows[index])
}

function formatWhen(d = new Date()): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ensureSpace(doc: JsPdfWithAutoTable, y: number, needed = 28): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed < pageH - 16) return y
  doc.addPage()
  return 18
}

function drawSectionTitle(doc: JsPdfWithAutoTable, title: string, y: number): number {
  y = ensureSpace(doc, y, 16)
  doc.setFillColor(...BRAND.genoa)
  doc.rect(14, y, 3, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND.firefly)
  doc.text(title, 20, y + 5.5)
  return y + 12
}

function drawCheckHeading(
  doc: JsPdfWithAutoTable,
  label: string,
  count: number,
  severity: 'error' | 'warning',
  y: number
): number {
  y = ensureSpace(doc, y, 14)
  const tone = severity === 'error' ? BRAND.danger : BRAND.warning
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...tone)
  doc.text(`${label}  ·  ${count}`, 14, y + 4)
  doc.setDrawColor(...BRAND.line)
  doc.setLineWidth(0.2)
  doc.line(14, y + 6.5, doc.internal.pageSize.getWidth() - 14, y + 6.5)
  return y + 10
}

function drawEmptyNote(doc: JsPdfWithAutoTable, text: string, y: number): number {
  y = ensureSpace(doc, y, 10)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.muted)
  doc.text(text, 14, y + 3)
  return y + 8
}

function drawTable(
  doc: JsPdfWithAutoTable,
  head: string[],
  body: string[][],
  y: number,
  columnStyles?: Record<number, { cellWidth?: number | 'auto' }>
): number {
  if (body.length === 0) {
    return drawEmptyNote(doc, 'Nenhuma ocorrência listada nesta checagem.', y)
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: 14, right: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.6,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: BRAND.firefly,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 250],
    },
    columnStyles,
    didDrawPage: (data) => {
      // footer page number filled later
      void data
    },
  })

  return (doc.lastAutoTable?.finalY ?? y) + 8
}

function addFooters(doc: JsPdfWithAutoTable) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND.muted)
    doc.text('ToolsDataWeb · ToolsPharma', 14, h - 8)
    doc.text(`Página ${i} de ${total}`, w - 14, h - 8, { align: 'right' })
  }
}

const JOB_FINISHED = new Set(['completed', 'failed', 'cancelled'])

/** PDF só após o envio ter terminado (sucesso, falha ou cancelamento). */
export function podeGerarRelatorioAlertasPdf(input: RelatorioAlertasPdfInput): boolean {
  return Boolean(input.job && JOB_FINISHED.has(input.job.status))
}

/**
 * Gera e baixa PDF pós-envio: resumo do job + todas as checagens de validação
 * (inclusive as que não tiveram ocorrência) e detalhes do envio.
 */
export function baixarRelatorioAlertasPdf(input: RelatorioAlertasPdfInput): void {
  const { validationResult, job, fileName } = input
  if (!podeGerarRelatorioAlertasPdf(input) || !job) {
    throw new Error('O relatório PDF só fica disponível após o envio ao sistema.')
  }

  const productRows = input.rows ?? validationResult?.rows ?? undefined

  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable
  const pageW = doc.internal.pageSize.getWidth()
  let y = 16

  // Cabeçalho
  doc.setFillColor(...BRAND.firefly)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFillColor(...BRAND.genoa)
  doc.rect(0, 22, pageW, 1.2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ToolsDataWeb', 14, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Relatório de alertas e erros da importação', 14, 16)

  y = 30
  doc.setTextColor(...BRAND.ink)
  doc.setFontSize(8.5)
  const meta: string[] = [
    `Gerado em ${formatWhen()}`,
  ]
  if (fileName) meta.push(`Arquivo: ${fileName}`)
  if (job) {
    meta.push(`Job: ${job.id}`)
    meta.push(`Filial: ${job.idFilial}`)
    meta.push(`Status: ${job.status}`)
  }
  doc.setTextColor(...BRAND.muted)
  doc.text(meta.join('  ·  '), 14, y)
  y += 8

  // Resumo
  y = drawSectionTitle(doc, 'Resumo', y)
  const summaryRows: string[][] = []
  if (job) {
    summaryRows.push(['Produtos gravados com sucesso', String(job.successCount ?? 0)])
    summaryRows.push(['Produtos ignorados (já existiam)', String(job.productSkipped ?? 0)])
    summaryRows.push(['Falhas reais de inserção', String(job.errorCount ?? 0)])
    const dcb = (job.errors ?? []).filter((e) =>
      e.message.trim().toLowerCase().startsWith('aviso:')
    ).length
    summaryRows.push(['Avisos de DCB no envio', String(dcb)])
  }
  if (validationResult) {
    summaryRows.push(['Erros de validação no arquivo', String(validationResult.errorCount ?? 0)])
    summaryRows.push(['Alertas de validação no arquivo', String(validationResult.warningCount ?? 0)])
    if (validationResult.totalRecords != null) {
      summaryRows.push(['Total de registros no arquivo', String(validationResult.totalRecords)])
    }
  }
  y = drawTable(doc, ['Indicador', 'Quantidade'], summaryRows, y, {
    0: { cellWidth: 120 },
    1: { cellWidth: 40 },
  })

  // —— Envio (todas as checagens, inclusive zeradas) ——
  y = drawSectionTitle(doc, 'Resultado do envio', y)
  const sendChecks = buildSendCheckSummary(job)
  for (const check of sendChecks) {
    y = drawCheckHeading(doc, check.label, check.count, check.severity, y)

    if (check.count === 0) {
      y = drawEmptyNote(doc, 'Nenhuma ocorrência — checagem OK.', y)
      continue
    }

    if (check.id === 'insert_failures') {
      const rows = (job.errors ?? [])
        .filter((e) => !e.message.trim().toLowerCase().startsWith('aviso:'))
        .map((e) => [
          csvLine(e.index),
          String(e.batch ?? '—'),
          e.codigo || '—',
          barcodeBySendIndex(productRows, e.index),
          e.message,
        ])
      y = drawTable(doc, ['Linha', 'Lote', 'Código', 'Barras', 'Mensagem'], rows, y, {
        0: { cellWidth: 14 },
        1: { cellWidth: 14 },
        2: { cellWidth: 22 },
        3: { cellWidth: 32 },
      })
      if (job.errorsTruncated) {
        y = drawEmptyNote(
          doc,
          'Lista de falhas truncada no servidor — nem todas as ocorrências estão neste PDF.',
          y
        )
      }
    } else if (check.id === 'dcb_warning') {
      const rows = (job.errors ?? [])
        .filter((e) => e.message.trim().toLowerCase().startsWith('aviso:'))
        .map((e) => [
          csvLine(e.index),
          e.codigo || '—',
          barcodeBySendIndex(productRows, e.index),
          e.message.replace(/^Aviso:\s*/i, ''),
        ])
      y = drawTable(doc, ['Linha', 'Código', 'Barras', 'Mensagem'], rows, y, {
        0: { cellWidth: 14 },
        1: { cellWidth: 22 },
        2: { cellWidth: 32 },
      })
    } else if (check.id === 'skip_barcode' || check.id === 'skip_migracao') {
      const reason = check.id === 'skip_barcode' ? 'codigo_barras' : 'codigo_migracao'
      const rows = (job.skipped ?? [])
        .filter((s) => s.reason === reason)
        .map((s) => [
          csvLine(s.index),
          s.codigo || '—',
          s.nome || '—',
          s.codigobarras || barcodeBySendIndex(productRows, s.index),
          s.message || skipReasonLabel(s.reason),
        ])
      y = drawTable(
        doc,
        ['Linha', 'Código', 'Nome', 'Barras', 'Motivo'],
        rows,
        y,
        {
          0: { cellWidth: 14 },
          1: { cellWidth: 22 },
          2: { cellWidth: 40 },
          3: { cellWidth: 32 },
        }
      )
      if (job.skippedTruncated) {
        y = drawEmptyNote(
          doc,
          'Lista de ignorados truncada — use “Baixar ignorados CSV” para a lista completa.',
          y
        )
      }
    }
  }

  // —— Validação (todas as checagens, inclusive zeradas) ——
  if (validationResult?.checkSummary?.length) {
    y = drawSectionTitle(doc, 'Validação do arquivo (todas as checagens)', y)

    if (validationResult.truncated) {
      y = drawEmptyNote(
        doc,
        'Atenção: a validação truncou detalhes (até 200 ocorrências por checagem). Contagens do resumo permanecem completas.',
        y
      )
    }

    const byCheck = groupIssuesByCheck(validationResult.issues ?? [])
    const checks = validationResult.checkSummary

    for (const check of checks) {
      y = drawCheckHeading(doc, check.label, check.count, check.severity, y)
      if (check.count === 0) {
        y = drawEmptyNote(doc, 'Nenhuma ocorrência — checagem OK.', y)
        continue
      }

      const issues = resolveCheckIssues(byCheck, check)
      const rows = issues.map((i) => [
        i.row > 0 ? String(i.row) : 'arquivo',
        barcodeByCsvRow(productRows, i.row),
        i.field || '—',
        i.value || '—',
        i.message,
      ])
      y = drawTable(doc, ['Linha', 'Barras', 'Campo', 'Valor', 'Mensagem'], rows, y, {
        0: { cellWidth: 14 },
        1: { cellWidth: 30 },
        2: { cellWidth: 24 },
        3: { cellWidth: 28 },
      })
      if (issues.length === 0 && check.count > 0) {
        y = drawEmptyNote(
          doc,
          `${check.count} ocorrência(s) contabilizada(s), mas os detalhes não estão disponíveis neste snapshot.`,
          y
        )
      } else if (issues.length < check.count) {
        y = drawEmptyNote(
          doc,
          `Exibindo ${issues.length} de ${check.count} ocorrência(s) desta checagem.`,
          y
        )
      }
    }
  } else if (validationResult) {
    y = drawSectionTitle(doc, 'Validação do arquivo', y)
    y = drawEmptyNote(
      doc,
      'Resumo de checagens não disponível neste snapshot da validação.',
      y
    )
  }

  addFooters(doc)

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const name = `ToolsDataWeb-alertas-erros-${stamp}.pdf`
  doc.save(name)
}
