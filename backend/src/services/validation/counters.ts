import { classifyIssue } from './checkSummary.js'
import {
  MAX_ISSUES_PER_CHECK,
  type IssueCounters,
  type ValidationIssue,
} from './types.js'

export function createCounters(seed: ValidationIssue[] = []): IssueCounters {
  const counters: IssueCounters = {
    errors: 0,
    warnings: 0,
    total: 0,
    categories: new Map(),
    storedPerCheck: new Map(),
    errorRows: new Set(),
  }
  for (const issue of seed) {
    counters.total++
    if (issue.severity === 'error') {
      counters.errors++
      if (issue.row > 0) counters.errorRows.add(issue.row)
    } else {
      counters.warnings++
    }
    const id = issue.checkId ?? classifyIssue(issue)
    counters.categories.set(id, (counters.categories.get(id) ?? 0) + 1)
    counters.storedPerCheck.set(id, (counters.storedPerCheck.get(id) ?? 0) + 1)
  }
  return counters
}

export function pushIssue(
  issues: ValidationIssue[],
  counters: IssueCounters,
  issue: ValidationIssue
) {
  counters.total++
  if (issue.severity === 'error') {
    counters.errors++
    if (issue.row > 0) counters.errorRows.add(issue.row)
  } else {
    counters.warnings++
  }
  const checkId = classifyIssue(issue)
  counters.categories.set(checkId, (counters.categories.get(checkId) ?? 0) + 1)
  const storedForCheck = counters.storedPerCheck.get(checkId) ?? 0
  if (storedForCheck < MAX_ISSUES_PER_CHECK) {
    issues.push({ ...issue, checkId })
    counters.storedPerCheck.set(checkId, storedForCheck + 1)
  }
}

export function isIssueListTruncated(counters: IssueCounters): boolean {
  for (const [id, count] of counters.categories) {
    if (count > (counters.storedPerCheck.get(id) ?? 0)) return true
  }
  return false
}
