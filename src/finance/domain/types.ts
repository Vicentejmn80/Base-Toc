export type AccountKind = 'bank' | 'cash' | 'wallet' | 'exchange' | 'fintech' | 'card' | 'broker' | 'other'

export type FinancialEventType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'exchange'
  | 'refund'
  | 'fee'
  | 'adjustment'
  | 'other'

export interface MoneyAmount {
  amount: number
  currency: string
}

export interface FinancialAccount {
  id: string
  name: string
  type: AccountKind
  institution?: string
  currency: string
  country?: string
  identifier?: string
  balance: number
  active: boolean
  createdAt: string
}

export interface FinanceSetup {
  complete: boolean
  country?: string
  displayCurrency?: string
  extraCurrencies: string[]
}

export interface FinancialEvent {
  id: string
  workspaceId: string
  groupId: string
  type: FinancialEventType
  amount: number
  currency: string
  originalAmount: number
  originalCurrency: string
  accountId?: string
  accountName?: string
  counterpartyAccountId?: string
  counterpartyAccountName?: string
  category?: string
  description: string
  sourceEventId?: string
  date: string
  destinationAmount?: number
  destinationCurrency?: string
  feeAmount?: number
  feeCurrency?: string
  impliedRate?: number
  rateQuote?: string
  createdAt: string
}

export interface FinanceBook {
  setup: FinanceSetup
  accounts: FinancialAccount[]
  events: FinancialEvent[]
  categories: string[]
}

export interface ParsedLeg {
  amount: number
  currency?: string
  accountHint?: string
}

export interface ParsedFinanceEvent {
  type: FinancialEventType
  amount?: number
  currency?: string
  accountHint?: string
  destinationAmount?: number
  destinationCurrency?: string
  destinationAccountHint?: string
  category?: string
  description: string
  date?: string
  feeAmount?: number
  feeCurrency?: string
  impliedRate?: number
  rateQuote?: string
}

export type FinanceBrainResult =
  | { kind: 'events'; events: ParsedFinanceEvent[]; source: string }
  | { kind: 'needs_clarification'; question: string; partial?: ParsedFinanceEvent[]; source: string }
  | { kind: 'unparsed'; source: string }

export const DEFAULT_FINANCE_CATEGORIES = [
  'salary',
  'freelance',
  'business',
  'food',
  'transport',
  'housing',
  'subscriptions',
  'education',
  'health',
  'entertainment',
  'taxes',
  'fees',
  'other',
] as const
