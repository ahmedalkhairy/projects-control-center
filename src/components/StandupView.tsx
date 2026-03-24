import { useState, useMemo } from 'react'
import { useStore } from '../store'
import {
  ClipboardList, Copy, Check, Plus, X, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, BookmarkPlus, Sparkles, Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import { format, subHours, isAfter } from 'date-fns'
import type { Task } from '../types'
import { generateStandupDraft } from '../services/claude'
import { HelpButton } from './HelpButton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StandupLine {
  id: string
  text: string
  fromTask?: Task
  included: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLines(tasks: Task[]): StandupLine[] {
  return tasks.map(t => ({
    id: t.id,
    text: t.title.replace(/^\[.*?\]\s*/, ''), // strip [GL-xx] prefixes
    fromTask: t,
    included: true,
  }))
}

function formatStandup(
  date: string,
  done: StandupLine[],
  today: StandupLine[],
  planned: StandupLine[],
  blockers: StandupLine[],
  customDone: string,
  customToday: string,
  customBlockers: string,
): string {
  const lines: string[] = []
  lines.push(`📋 Daily Standup — ${date}`)
  lines.push('')

  // Done
  const doneItems = [
    ...done.filter(l => l.included).map(l => `  • ${l.text}`),
    ...customDone.split('\n').map(l => l.trim()).filter(Boolean).map(l => `  • ${l}`),
  ]
  lines.push('✅ Done Yesterday:')
  lines.push(doneItems.length ? doneItems.join('\n') : '  • Nothing to report')
  lines.push('')

  // Today
  const todayItems = [
    ...today.filter(l => l.included).map(l => `  • ${l.text}`),
    ...planned.filter(l => l.included).map(l => `  • ${l.text} (planned)`),
    ...customToday.split('\n').map(l => l.trim()).filter(Boolean).map(l => `  • ${l}`),
  ]
  lines.push('🔄 Working on Today:')
  lines.push(todayItems.length ? todayItems.join('\n') : '  • Nothing planned')
  lines.push('')

  // Blockers
  const blockerItems = [
    ...blockers.filter(l => l.included).map(l => `  • [BLOCKED] ${l.text}`),
    ...customBlockers.split('\n').map(l => l.trim()).filter(Boolean).map(l => `  • ${l}`),
  ]
  lines.push('🚧 Blockers:')
  lines.push(blockerItems.length ? blockerItems.join('\n') : '  • No blockers')
  lines.push('')

  return lines.join('\n')
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function StandupView() {
  const { activeProjectId, tasks, projects, addNote, geminiApiKey } = useStore()

  const allTasks  = tasks[activeProjectId] ?? []
  const project   = projects.find(p => p.id === activeProjectId)
  const today     = format(new Date(), 'EEEE, MMMM d yyyy')
  const since48h  = subHours(new Date(), 48)

  // Auto-populate sections from tasks
  const autoDone = useMemo(() => makeLines(
    allTasks.filter(t =>
      t.status === 'done' &&
      t.completedAt && isAfter(new Date(t.completedAt), since48h)
    ).slice(0, 8)
  ), [activeProjectId]) // eslint-disable-line

  const autoToday = useMemo(() => makeLines(
    allTasks.filter(t => t.status === 'in-progress').slice(0, 8)
  ), [activeProjectId]) // eslint-disable-line

  const autoPlanned = useMemo(() => makeLines(
    allTasks
      .filter(t => t.status === 'todo')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 }
        return order[a.priority] - order[b.priority]
      })
      .slice(0, 5)
  ), [activeProjectId]) // eslint-disable-line

  const autoBlockers = useMemo(() => makeLines(
    allTasks.filter(t =>
      t.priority === 'critical' && t.status !== 'done'
    ).slice(0, 5)
  ), [activeProjectId]) // eslint-disable-line

  const [done, setDone]         = useState<StandupLine[]>(autoDone)
  const [today2, setToday2]     = useState<StandupLine[]>(autoToday)
  const [planned, setPlanned]   = useState<StandupLine[]>(autoPlanned)
  const [blockers, setBlockers] = useState<StandupLine[]>(autoBlockers)
  const [customDone, setCustomDone]         = useState('')
  const [customToday, setCustomToday]       = useState('')
  const [customBlockers, setCustomBlockers] = useState('')
  const [copied, setCopied]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]   = useState('')

  const standupText = formatStandup(
    today, done, today2, planned, blockers,
    customDone, customToday, customBlockers
  )

  function refresh() {
    setDone(makeLines(
      allTasks.filter(t =>
        t.status === 'done' &&
        t.completedAt && isAfter(new Date(t.completedAt), since48h)
      ).slice(0, 8)
    ))
    setToday2(makeLines(allTasks.filter(t => t.status === 'in-progress').slice(0, 8)))
    setPlanned(makeLines(allTasks.filter(t => t.status === 'todo').sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return order[a.priority] - order[b.priority]
    }).slice(0, 5)))
    setBlockers(makeLines(allTasks.filter(t => t.priority === 'critical' && t.status !== 'done').slice(0, 5)))
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(standupText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleAiDraft() {
    if (!geminiApiKey || !project) return
    setAiLoading(true)
    setAiError('')
    try {
      const result = await generateStandupDraft({
        project,
        doneTasks:       done.filter(l => l.included).map(l => l.fromTask!).filter(Boolean),
        inProgressTasks: today2.filter(l => l.included).map(l => l.fromTask!).filter(Boolean),
        plannedTasks:    planned.filter(l => l.included).map(l => l.fromTask!).filter(Boolean),
        blockerTasks:    blockers.filter(l => l.included).map(l => l.fromTask!).filter(Boolean),
        apiKey: geminiApiKey,
      })
      if (result.done)     setCustomDone(prev => prev ? `${prev}\n${result.done}` : result.done)
      if (result.today)    setCustomToday(prev => prev ? `${prev}\n${result.today}` : result.today)
      if (result.blockers) setCustomBlockers(prev => prev ? `${prev}\n${result.blockers}` : result.blockers)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  function saveAsNote() {
    const id = addNote(activeProjectId)
    const { updateNote } = useStore.getState()
    updateNote(id, { title: `Standup — ${today}`, content: standupText })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function toggleLine(list: StandupLine[], setList: (l: StandupLine[]) => void, id: string) {
    setList(list.map(l => l.id === id ? { ...l, included: !l.included } : l))
  }

  function removeLine(list: StandupLine[], setList: (l: StandupLine[]) => void, id: string) {
    setList(list.filter(l => l.id !== id))
  }

  return (
    <div className="flex h-full">
      {/* ── Left: Sections ── */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-semibold text-slate-100">Daily Standup</h1>
              <HelpButton
                title="Daily Standup Generator"
                description="Auto-generates your standup update from task data. Shows what you completed recently, what you're working on, and any blockers — then lets you copy and share it."
                tips={[
                  '"Refresh from tasks" re-pulls the latest task data.',
                  'Check/uncheck lines to include or exclude them from the output.',
                  'Add custom notes in the text area below each section.',
                  '"✨ AI Draft" uses Claude to write a more natural standup from your tasks.',
                  '"Save as Note" stores the standup in your Notes for future reference.',
                  'Press Copy and paste directly into Slack, Teams, or your standup channel.',
                ]}
              />
            </div>
            <p className="text-sm text-slate-500">{today} · {project?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {geminiApiKey && (
              <button
                onClick={handleAiDraft}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-600/10 hover:bg-violet-600/20 rounded-lg border border-violet-600/20 transition-colors disabled:opacity-50"
              >
                {aiLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Sparkles size={12} />
                }
                {aiLoading ? 'Drafting…' : '✨ AI Draft'}
              </button>
            )}
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              <RefreshCw size={12} />
              Refresh from tasks
            </button>
          </div>
        </div>

        {/* AI error */}
        {aiError && (
          <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            AI error: {aiError}
          </div>
        )}

        {/* Done Yesterday */}
        <Section
          icon={<CheckCircle2 size={14} className="text-emerald-400" />}
          title="Done Yesterday"
          color="emerald"
          lines={done}
          onToggle={(id) => toggleLine(done, setDone, id)}
          onRemove={(id) => removeLine(done, setDone, id)}
          customValue={customDone}
          onCustomChange={setCustomDone}
          placeholder="Any other things you finished?"
          emptyText="No tasks completed in the last 48 hours."
        />

        {/* Today */}
        <Section
          icon={<Clock size={14} className="text-blue-400" />}
          title="Working on Today"
          color="blue"
          lines={[...today2, ...planned.map(l => ({ ...l, text: `${l.text} (planned)` }))]}
          onToggle={(id) => {
            toggleLine(today2, setToday2, id) || toggleLine(planned, setPlanned, id)
          }}
          onRemove={(id) => {
            removeLine(today2, setToday2, id)
            removeLine(planned, setPlanned, id)
          }}
          customValue={customToday}
          onCustomChange={setCustomToday}
          placeholder="Anything else planned for today?"
          emptyText="No active or planned tasks."
        />

        {/* Blockers */}
        <Section
          icon={<AlertTriangle size={14} className="text-rose-400" />}
          title="Blockers"
          color="rose"
          lines={blockers}
          onToggle={(id) => toggleLine(blockers, setBlockers, id)}
          onRemove={(id) => removeLine(blockers, setBlockers, id)}
          customValue={customBlockers}
          onCustomChange={setCustomBlockers}
          placeholder="Any blockers or dependencies?"
          emptyText="No blockers — great! 🎉"
        />
      </div>

      {/* ── Right: Preview ── */}
      <div className="w-96 flex-shrink-0 border-l border-slate-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <ClipboardList size={14} className="text-slate-500" />
            Preview
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveAsNote}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                saved
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
              )}
            >
              {saved ? <Check size={11} /> : <BookmarkPlus size={11} />}
              {saved ? 'Saved!' : 'Save as Note'}
            </button>
            <button
              onClick={copyToClipboard}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                copied
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
                  : 'bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/30'
              )}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <pre className="flex-1 overflow-y-auto p-4 text-xs text-slate-400 font-mono leading-relaxed whitespace-pre-wrap select-all">
          {standupText}
        </pre>
      </div>
    </div>
  )
}

// ─── Section Component ────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ReactNode
  title: string
  color: 'emerald' | 'blue' | 'rose'
  lines: StandupLine[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  customValue: string
  onCustomChange: (v: string) => void
  placeholder: string
  emptyText: string
}

function Section({ icon, title, color, lines, onToggle, onRemove, customValue, onCustomChange, placeholder, emptyText }: SectionProps) {
  const borderColor = { emerald: 'border-emerald-500/30', blue: 'border-blue-500/30', rose: 'border-rose-500/30' }[color]
  const bgColor = { emerald: 'bg-emerald-500/5', blue: 'bg-blue-500/5', rose: 'bg-rose-500/5' }[color]

  return (
    <div className={clsx('rounded-xl border p-4 mb-4', borderColor, bgColor)}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <span className="ml-auto text-xs text-slate-600">
          {lines.filter(l => l.included).length}/{lines.length} selected
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-slate-600 italic mb-3">{emptyText}</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {lines.map(line => (
            <div
              key={line.id}
              className={clsx(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
                line.included ? 'bg-slate-800/60' : 'opacity-40'
              )}
            >
              <button
                onClick={() => onToggle(line.id)}
                className="flex-shrink-0"
              >
                {line.included
                  ? <Check size={13} className="text-emerald-400" />
                  : <div className="w-3 h-3 rounded border border-slate-600" />
                }
              </button>
              <span className={clsx('flex-1 text-xs', line.included ? 'text-slate-300' : 'text-slate-600 line-through')}>
                {line.text}
              </span>
              {line.fromTask && (
                <span className={clsx(
                  'text-xs px-1.5 py-0.5 rounded capitalize',
                  line.fromTask.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                  line.fromTask.priority === 'high'     ? 'bg-orange-500/20 text-orange-400' :
                  'bg-slate-700 text-slate-500'
                )}>
                  {line.fromTask.priority}
                </span>
              )}
              <button onClick={() => onRemove(line.id)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Custom note */}
      <div className="flex items-start gap-2">
        <Plus size={12} className="text-slate-600 mt-1.5 flex-shrink-0" />
        <textarea
          value={customValue}
          onChange={e => onCustomChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="flex-1 bg-transparent text-xs text-slate-400 placeholder-slate-700 focus:outline-none resize-none leading-relaxed"
        />
      </div>
    </div>
  )
}
