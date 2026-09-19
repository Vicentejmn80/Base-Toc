import type { FinanceBook, FinanceBrainResult } from '../domain/types'
import { parseFinanceUtterance } from './parser'
import { validateFinanceParse } from './validator'

export function interpretFinance(text: string, book: FinanceBook): FinanceBrainResult {
  return validateFinanceParse(parseFinanceUtterance(text, book), book)
}
