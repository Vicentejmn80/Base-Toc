import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, MoreHorizontal, Sparkles, Upload } from 'lucide-react'
import { useAppExperience } from '../../lib/experience'
import { useAppStore } from '../../state/store'
import { useToast } from '../../state/toast'
import { WorkspaceIcon } from '../ui/WorkspaceIcon'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { EmptyState } from '../ui/EmptyState'
import { RecordForm } from '../records/RecordForm'
import { RecordTable } from '../records/RecordTable'
import { MetricCards } from '../dashboard/MetricCards'
import { NarrativeSummary } from '../dashboard/NarrativeSummary'
import { GoalCard } from '../dashboard/GoalCard'
import { AnalysisCard } from '../dashboard/AnalysisCard'
import { ProactiveInsights } from '../dashboard/ProactiveInsights'
import { ChartsPanel } from '../dashboard/ChartsPanel'
import { FollowUps } from '../dashboard/FollowUps'
import { ActivityFeed } from '../dashboard/ActivityFeed'
import { ActivityHeatmap } from '../progress/ActivityHeatmap'
import { WorkspaceComposer } from './WorkspaceComposer'
import { CaptureLauncher, CaptureSheet } from './CaptureSheet'
import { ImportSheet } from './ImportSheet'
import { FinanceOnboarding } from '../finance/FinanceOnboarding'
import { FinancePanel } from '../finance/FinancePanel'
import { ensureFinanceBook } from '../../finance/domain/book'
import { ReentryBanner } from '../capture/ReentryBanner'
import { MobileProgressFeed } from '../mobile/MobileProgressFeed'
import { needsReentry } from '../../metrics/coverage'
import { isWithinPeriod, type PeriodKey } from '../../lib/dates'
import type { Goal, RecordItem } from '../../domain/types'
import { recordTitle } from '../../lib/records'
import { cn } from '../../lib/cn'
import { createId } from '../../lib/id'
import { fieldByRole } from '../../lib/schema'
import { AiRequestError } from '../../lib/aiClient'
import { buildAnalysisPayload, type ProgressAnalysis } from '../../lib/analysisPayload'
import { requestProgressAnalysis } from '../../lib/analyzeProgress'
import { describeExperiment, markExperimentReviewed, saveExperiment } from '../../lib/experiments'

const tabs = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'tabla', label: 'Tabla' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'actividad', label: 'Actividad' },
] as const

type TabId = (typeof tabs)[number]['id']

export function WorkspacePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { getWorkspace, activities, saveRecord, saveFinance, deleteRecord, updateWorkspace, deleteWorkspace, setGoal } = useAppStore()
  const { showToast } = useToast()
  const workspace = id ? getWorkspace(id) : undefined
  const experience = useAppExperience()

  const tab = (tabs.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'resumen') as TabId
  const periodParam = params.get('period')
  const period = (
    ['7d', '30d', '90d', 'all'].includes(periodParam ?? '')
      ? periodParam
      : experience === 'mobile'
        ? '7d'
        : 'all'
  ) as PeriodKey

  const [formOpen, setFormOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<RecordItem | null>(null)
  const [deleting, setDeleting] = useState<RecordItem | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editSpaceOpen, setEditSpaceOpen] = useState(false)
  const [deleteSpaceOpen, setDeleteSpaceOpen] = useState(false)
  const [spaceName, setSpaceName] = useState('')
  const [spaceDescription, setSpaceDescription] = useState('')
  const [goalLabel, setGoalLabel] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [analysis, setAnalysis] = useState<ProgressAnalysis | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [experimentTick, setExperimentTick] = useState(0)

  const filteredRecords = useMemo(() => {
    if (!workspace) return []
    const dateField = workspace.fields.find((field) => field.type === 'date')
    return workspace.records.filter((record) => {
      const value = dateField ? record.values[dateField.key] : record.createdAt
      return isWithinPeriod(value || record.createdAt, period)
    })
  }, [workspace, period])

  const scopedWorkspace = useMemo(() => {
    if (!workspace) return undefined
    return { ...workspace, records: filteredRecords }
  }, [workspace, filteredRecords])

  const workspaceActivities = activities.filter((item) => item.workspaceId === workspace?.id).slice(0, 20)
  const experimentFacts = workspace && experimentTick >= 0 ? describeExperiment(workspace) : null

  if (!workspace || !scopedWorkspace) {
    return (
      <EmptyState
        title="Este espacio no existe"
        description="Puede que lo hayas eliminado o que el enlace sea antiguo."
        action={<Button onClick={() => navigate('/')}>Volver al inicio</Button>}
      />
    )
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(record: RecordItem) {
    setEditing(record)
    setFormOpen(true)
  }

  async function analyzeProgress() {
    if (!scopedWorkspace || !workspace) return
    setAnalysisStatus('loading')
    setAnalysisError(null)
    try {
      const experiment = describeExperiment(workspace)
      const payload = {
        ...buildAnalysisPayload(scopedWorkspace, period),
        experimentoActivo: experiment,
      }
      const result = await requestProgressAnalysis(payload)
      if (experiment?.status === 'due') markExperimentReviewed(workspace.id)
      if (result.experimento && (!experiment || experiment.status === 'due')) {
        saveExperiment(workspace.id, result.experimento)
      }
      setExperimentTick((current) => current + 1)
      setAnalysis(result)
      setAnalysisStatus('ready')
    } catch (error) {
      setAnalysisStatus('error')
      setAnalysisError(
        error instanceof AiRequestError ? error.message : 'No se pudo analizar el progreso.',
      )
    }
  }

  function openGoalEditor() {
    if (!workspace) return
    const current = workspace.goals[0]
    setGoalLabel(current?.label ?? '')
    setGoalTarget(current ? String(current.target) : '')
    setGoalDeadline(current?.deadline ?? '')
    setGoalOpen(true)
  }

  function setTab(nextTab: TabId) {
    const next = new URLSearchParams(params)
    next.set('tab', nextTab)
    setParams(next)
  }

  const isMobile = experience === 'mobile'
  const showFeed = isMobile && tab === 'resumen'
  const financeBook = workspace.kind === 'finance' ? ensureFinanceBook(workspace.finance) : undefined
  const financeNeedsSetup = Boolean(financeBook && !financeBook.setup.complete)
  const financeBody = financeBook ? (
    financeNeedsSetup ? (
      <FinanceOnboarding
        book={financeBook}
        onComplete={(book) => saveFinance(workspace.id, book, 'Se configuró el espacio de finanzas.')}
      />
    ) : (
      <FinancePanel book={financeBook} />
    )
  ) : null
  const mobileTabs = [
    { id: 'resumen', label: 'Tu progreso' },
    { id: 'tabla', label: 'Tabla' },
    { id: 'graficos', label: 'Gráficos' },
    { id: 'actividad', label: 'Actividad' },
  ] as const

  const overflowMenu = (
    <div className="relative">
      <Button variant="secondary" onClick={() => setMenuOpen((open) => !open)} aria-label="Más acciones" className="min-h-11 min-w-11">
        <MoreHorizontal size={16} />
      </Button>
      {menuOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-line bg-white p-1 shadow-[var(--shadow-float)]">
          {isMobile ? (
            <>
              <button
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-soft"
                onClick={() => {
                  setImportOpen(true)
                  setMenuOpen(false)
                }}
              >
                Importar
              </button>
              <button
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-soft"
                onClick={() => {
                  openCreate()
                  setMenuOpen(false)
                }}
              >
                Llenar formulario
              </button>
              <button
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-soft"
                onClick={() => {
                  openGoalEditor()
                  setMenuOpen(false)
                }}
              >
                Definir meta
              </button>
              <button
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-soft"
                onClick={() => {
                  void analyzeProgress()
                  setMenuOpen(false)
                }}
              >
                Analizar
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-soft"
            onClick={() => {
              setSpaceName(workspace.name)
              setSpaceDescription(workspace.description)
              setEditSpaceOpen(true)
              setMenuOpen(false)
            }}
          >
            Editar espacio
          </button>
          <button
            type="button"
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
            onClick={() => {
              setDeleteSpaceOpen(true)
              setMenuOpen(false)
            }}
          >
            Eliminar espacio
          </button>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="space-y-8">
      {isMobile ? (
        <div className="sticky top-0 z-20 -mx-4 mb-1 flex items-center gap-1 border-b border-line bg-canvas/95 px-2 py-1 backdrop-blur">
          <Link
            to="/spaces"
            aria-label="Volver a espacios"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink"
          >
            <ChevronLeft size={22} />
          </Link>
          <p className="truncate text-sm font-semibold">{workspace.name}</p>
        </div>
      ) : null}

      {isMobile ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(event) => {
                const next = new URLSearchParams(params)
                next.set('period', event.target.value)
                setParams(next)
              }}
              className="min-h-11 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-base"
              aria-label="Periodo"
            >
              <option value="7d">Esta semana</option>
              <option value="30d">Este mes</option>
              <option value="90d">90 días</option>
              <option value="all">Todo</option>
            </select>
            <CaptureLauncher onClick={() => setCaptureOpen(true)} />
            <Button
              variant="secondary"
              data-testid="import-open"
              onClick={() => setImportOpen(true)}
              className="min-h-11 min-w-11"
              aria-label="Importar"
            >
              <Upload size={16} />
            </Button>
            {overflowMenu}
          </div>
          {!showFeed ? (
            <div className="flex gap-1 overflow-auto rounded-2xl bg-canvas p-1">
              {mobileTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'min-h-11 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-muted',
                    tab === item.id && 'bg-white text-ink shadow-sm',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
      <header className="flex flex-col gap-5 rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <WorkspaceIcon name={workspace.icon} color={workspace.color} size="lg" kind={workspace.kind} />
            <div>
              <h1 className="type-title">{workspace.name}</h1>
              <p className="type-meta mt-1.5 max-w-xl">{workspace.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(event) => {
                const next = new URLSearchParams(params)
                next.set('period', event.target.value)
                setParams(next)
              }}
              className="min-h-11 rounded-xl border border-line bg-white px-3 py-2 text-base sm:text-sm"
            >
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
              <option value="90d">90 días</option>
              <option value="all">Todo</option>
            </select>
            <CaptureLauncher onClick={() => setCaptureOpen(true)} />
            <Button variant="secondary" data-testid="import-open" onClick={() => setImportOpen(true)} className="min-h-11">
              <Upload size={16} />
              Importar
            </Button>
            <Button variant="ghost" onClick={openCreate} className="min-h-11 text-muted">
              Llenar formulario
            </Button>
            <Button variant="secondary" onClick={openGoalEditor} className="min-h-11">
              Definir meta
            </Button>
            <Button
              variant="secondary"
              onClick={() => void analyzeProgress()}
              className="min-h-11"
              disabled={analysisStatus === 'loading'}
            >
              <Sparkles size={16} />
              <span className="sm:hidden">Analizar</span>
              <span className="hidden sm:inline">Analizar mi progreso</span>
            </Button>
            {overflowMenu}
          </div>
        </div>

        <div className="flex gap-1 overflow-auto rounded-2xl bg-canvas p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'min-h-11 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-muted',
                tab === item.id && 'bg-white text-ink shadow-sm',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      )}

      {needsReentry(workspace) ? <ReentryBanner /> : null}

      {showFeed ? (
        <div className="space-y-4">
          {financeBody}
          <MobileProgressFeed
            workspace={workspace}
            period={period}
            activities={workspaceActivities}
            onSeeDetail={() => setTab('tabla')}
            onDefineGoal={openGoalEditor}
          />
          {analysisStatus !== 'idle' ? (
            <AnalysisCard
              status={analysisStatus}
              analysis={analysis}
              experiment={experimentFacts}
              errorMessage={analysisError}
              onRetry={() => void analyzeProgress()}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'resumen' && !isMobile ? (
        <div className="space-y-8">
          {financeBody}
          <NarrativeSummary workspace={workspace} period={period} />
          <ActivityHeatmap workspace={workspace} />
          <GoalCard
            workspace={workspace}
            goal={workspace.goals[0] ?? null}
            onDefineGoal={openGoalEditor}
          />
          <AnalysisCard
            status={analysisStatus}
            analysis={analysis}
            experiment={experimentFacts}
            errorMessage={analysisError}
            onRetry={() => void analyzeProgress()}
          />
          <ProactiveInsights workspace={workspace} />
          <MetricCards workspace={workspace} />
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <ChartsPanel workspace={scopedWorkspace} />
            <div className="space-y-6">
              <FollowUps workspace={scopedWorkspace} />
              <ActivityFeed activities={workspaceActivities.slice(0, 5)} />
            </div>
          </div>
          <WorkspaceComposer workspace={scopedWorkspace} />
        </div>
      ) : null}

      {tab === 'tabla' ? (
        <RecordTable
          workspace={workspace}
          records={filteredRecords}
          onAdd={() => setCaptureOpen(true)}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      ) : null}

      {tab === 'graficos' ? (
        <div className="space-y-8">
          <NarrativeSummary workspace={workspace} period={period} />
          <MetricCards workspace={workspace} />
          <ChartsPanel workspace={scopedWorkspace} />
        </div>
      ) : null}

      {tab === 'actividad' ? <ActivityFeed activities={workspaceActivities} /> : null}

      <Modal
        open={formOpen}
        title={editing ? 'Editar registro' : 'Agregar registro'}
        description={`Los campos se adaptan a ${workspace.name}.`}
        wide
        onClose={() => setFormOpen(false)}
      >
        <RecordForm
          key={editing?.id ?? 'new'}
          workspace={workspace}
          record={editing}
          onCancel={() => setFormOpen(false)}
          onSave={(values) => {
            const next = { ...values }
            if (
              workspace.kind === 'fitness' &&
              (next.ritmo === null || next.ritmo === '') &&
              typeof next.distancia === 'number' &&
              typeof next.duracion === 'number' &&
              next.distancia > 0
            ) {
              next.ritmo = Number((next.duracion / next.distancia).toFixed(2))
            }
            saveRecord(workspace.id, next, editing ?? undefined)
            setFormOpen(false)
            showToast(editing ? 'Registro actualizado' : 'Registro guardado', 'success')
          }}
        />
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="Eliminar registro"
        description="Esta acción no se puede deshacer en esta versión local."
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleting) return
                deleteRecord(workspace.id, deleting.id)
                setDeleting(null)
                showToast('Registro eliminado', 'success')
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          ¿Seguro que quieres eliminar {recordTitle(deleting, 'este registro', workspace)}?
        </p>
      </Modal>

      <CaptureSheet
        open={captureOpen}
        workspace={workspace}
        onClose={() => setCaptureOpen(false)}
        onOpenForm={openCreate}
        onConfirm={(values, existing) => {
          saveRecord(workspace.id, values, existing)
        }}
      />

      <ImportSheet
        open={importOpen}
        workspace={workspace}
        onClose={() => setImportOpen(false)}
        onImported={() => setTab('tabla')}
      />

      <Modal
        open={goalOpen}
        title="Definir meta"
        description="Una meta opcional por espacio con proyección local."
        onClose={() => setGoalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGoalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const target = Number(goalTarget)
                if (!goalLabel.trim()) {
                  showToast('La descripción de la meta es obligatoria', 'danger')
                  return
                }
                if (!Number.isFinite(target) || target <= 0) {
                  showToast('La meta objetivo debe ser un número mayor a 0', 'danger')
                  return
                }
                const nextGoal: Goal = {
                  id: workspace.goals[0]?.id ?? createId('goal'),
                  workspaceId: workspace.id,
                  label: goalLabel.trim(),
                  target,
                  deadline: goalDeadline || undefined,
                  unit: workspace.goals[0]?.unit ?? fieldByRole(workspace, 'amount')?.unit,
                }
                setGoal(workspace.id, nextGoal)
                setGoalOpen(false)
                showToast('Meta guardada', 'success')
              }}
            >
              Guardar meta
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Descripción</span>
            <input
              value={goalLabel}
              onChange={(event) => setGoalLabel(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              placeholder="Ej. 10 clientes para diciembre"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Métrica objetivo</span>
            <input
              type="number"
              value={goalTarget}
              onChange={(event) => setGoalTarget(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              placeholder="Ej. 10"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Fecha límite</span>
            <input
              type="date"
              value={goalDeadline}
              onChange={(event) => setGoalDeadline(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={editSpaceOpen}
        title="Editar espacio"
        onClose={() => setEditSpaceOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditSpaceOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!spaceName.trim()) {
                  showToast('El nombre es obligatorio', 'danger')
                  return
                }
                updateWorkspace(workspace.id, { name: spaceName.trim(), description: spaceDescription.trim() })
                setEditSpaceOpen(false)
                showToast('Espacio actualizado', 'success')
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nombre</span>
            <input
              value={spaceName}
              onChange={(event) => setSpaceName(event.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Descripción</span>
            <textarea
              value={spaceDescription}
              onChange={(event) => setSpaceDescription(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={deleteSpaceOpen}
        title="Eliminar espacio"
        description="Se borrarán sus registros y su actividad local."
        onClose={() => setDeleteSpaceOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteSpaceOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteWorkspace(workspace.id)
                showToast('Espacio eliminado', 'success')
                navigate('/')
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">¿Eliminar {workspace.name} de forma permanente en este dispositivo?</p>
      </Modal>
    </div>
  )
}
