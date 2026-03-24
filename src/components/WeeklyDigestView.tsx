import { useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  BarChart3, Copy, Check, RefreshCw, TrendingUp,
  TrendingDown, Minus, CheckCircle2, Circle, Clock,
  AlertTriangle, Inbox, Wrench, Flag, ChevronDown, ChevronUp,
  Sparkles, Loader2, X,
} from 'lucide-react'
import clsx from 'clsx'
import { format, subDays, isAfter, parseISO } from 'date-fns'
import type { Task, Message } from '../types'
import { generateWeeklyNarrative } from '../services/claude'
import { HelpButton } from './HelpButton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityColor(p: Task['priority']) {
  switch (p) {
    case 'critical': return 'text-red-400 bg-red-500/10'
    case 'high':     return 'text-orange-400 bg-orange-500/10'
    case 'medium':   return 'text-yellow-400 bg-yellow-500/10'
    case 'low':      return 'text-slate-400 bg-slate-700'
  }
}

function since(days: number) {
  return subDays(new Date(), days)
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function WeeklyDigestView() {
  const {
    activeProjectId, tasks, messages, techDebt, milestones, projects, geminiApiKey,
  } = useStore()

  const [expandSection, setExpandSection] = useState<Record<string, boolean>>({
    completed: true, inProgress: false, blockers: false, inbox: false, debt: false, milestones: false,
  })
  const [copied, setCopied]           = useState(false)
  const [range, setRange]             = useState<7 | 14 | 30>(7)
  const [aiNarrative, setAiNarrative] = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiError, setAiError]         = useState('')

  const cutoff    = useMemo(() => since(range), [range])
  const project   = projects.find(p => p.id === activeProjectId)
  const allTasks  = tasks[activeProjectId] ?? []
  const allMsgs   = messages[activeProjectId] ?? []

  // ── Computed data ──

  const completed = allTasks.filter(t =>
    t.status === 'done' && t.completedAt && isAfter(parseISO(t.completedAt), cutoff)
  ).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())

  const inProgress = allTasks.filter(t => t.status === 'in-progress')
    .sort((a, b) => {
      const o = { critical: 0, high: 1, medium: 2, low: 3 }
      return o[a.priority] - o[b.priority]
    })

  const addedThisWeek = allTasks.filter(t => isAfter(parseISO(t.createdAt), cutoff))

  const blockers = allTasks.filter(t =>
    t.priority === 'critical' && t.status !== 'done'
  )

  const inboxActivity = allMsgs.filter(m => isAfter(parseISO(m.timestamp), cutoff))

  const projectDebt = techDebt.filter(d => d.projectId === activeProjectId && d.status !== 'resolved')

  const projectMilestones = milestones
    .filter(m => m.projectId === activeProjectId)
    .slice(0, 5)

  // Velocity: completed this week vs previous week
  const prevCutoff    = since(range * 2)
  const prevCompleted = allTasks.filter(t =>
    t.status === 'done' && t.completedAt &&
    isAfter(parseISO(t.completedAt), prevCutoff) && !isAfter(parseISO(t.completedAt), cutoff)
  )
  const velocityDiff  = completed.length - prevCompleted.length
  const VelocityIcon  = velocityDiff > 0 ? TrendingUp : velocityDiff < 0 ? TrendingDown : Minus
  const velocityColor = velocityDiff > 0 ? 'text-emerald-400' : velocityDiff < 0 ? 'text-red-400' : 'text-slate-500'

  // ── Markdown export ──

  function buildMarkdown() {
    const dateRange = `${format(cutoff, 'MMM d')} – ${format(new Date(), 'MMM d, yyyy')}`
    const lines: string[] = []
    lines.push(`# Weekly Digest — ${project?.name ?? 'Project'}`)
    lines.push(`**Period:** ${dateRange}`)
    lines.push('')
    lines.push('## 📊 Summary')
    lines.push(`- ✅ Completed: **${completed.length}** tasks`)
    lines.push(`- 🔄 In Progress: **${inProgress.length}** tasks`)
    lines.push(`- ➕ Added: **${addedThisWeek.length}** new tasks`)
    lines.push(`- 🚧 Blockers: **${blockers.length}** critical`)
    lines.push(`- 📬 Inbox: **${inboxActivity.length}** messages`)
    lines.push('')
    if (completed.length > 0) {
      lines.push('## ✅ Completed')
      completed.slice(0, 10).forEach(t => {
        lines.push(`- ${t.title.replace(/^\[.*?\]\s*/, '')} *(${t.priority})*`)
      })
      lines.push('')
    }
    if (inProgress.length > 0) {
      lines.push('## 🔄 In Progress')
      inProgress.slice(0, 8).forEach(t => {
        lines.push(`- ${t.title.replace(/^\[.*?\]\s*/, '')} *(${t.priority})*`)
      })
      lines.push('')
    }
    if (blockers.length > 0) {
      lines.push('## 🚧 Blockers')
      blockers.forEach(t => lines.push(`- ⚠ ${t.title.replace(/^\[.*?\]\s*/, '')}`))
      lines.push('')
    }
    return lines.join('\n')
  }

  function copy() {
    const md = aiNarrative
      ? buildMarkdown() + `\n\n## 🤖 AI Summary\n${aiNarrative}`
      : buildMarkdown()
    navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleAiNarrative() {
    if (!geminiApiKey || !project) return
    setAiLoading(true)
    setAiError('')
    try {
      const text = await generateWeeklyNarrative({
        project,
        range,
        completedTasks:  completed,
        inProgressTasks: inProgress,
        blockerTasks:    blockers,
        openDebtCount:   projectDebt.length,
        milestoneCount:  projectMilestones.filter(m => m.status !== 'completed').length,
        inboxCount:      inboxActivity.length,
        apiKey:          geminiApiKey,
      })
      setAiNarrative(text)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  function toggle(key: string) {
    setExpandSection(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const dateRange = `${format(cutoff, 'MMM d')} – ${format(new Date(), 'MMM d')}`

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-slate-100">Weekly Digest</h1>
            <HelpButton
              title="Weekly Digest"
              description="Auto-generated weekly summary of project activity. Shows task velocity, completed work, blockers, tech debt, and inbox activity across your selected time range."
              tips={[
                'Switch between 7d / 14d / 30d to change the reporting period.',
                'Velocity compares this period\'s completions to the previous same-length period.',
                '"✨ AI Summary" generates a narrative executive summary using Claude.',
                '"Export Markdown" copies a full report to clipboard — paste into Confluence, Notion, or Slack.',
                'Expand each section to see individual task details.',
              ]}
            />
          </div>
          <p className="text-sm text-slate-500">{dateRange} · {project?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range picker */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            {([7, 14, 30] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={clsx('px-2.5 py-1 rounded-md transition-colors font-medium',
                  range === r ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {r}d
              </button>
            ))}
          </div>

          {geminiApiKey && (
            <button
              onClick={handleAiNarrative}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-violet-600/30 bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {aiLoading ? 'Generating…' : '✨ AI Summary'}
            </button>
          )}

          <button
            onClick={copy}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
              copied
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            )}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Export Markdown'}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Completed */}
        <StatCard
          label={`Completed (${range}d)`}
          value={completed.length}
          color="text-emerald-400"
          sub={
            <span className={clsx('flex items-center gap-1 text-xs', velocityColor)}>
              <VelocityIcon size={11} />
              {Math.abs(velocityDiff)} vs prev period
            </span>
          }
        />

        {/* In Progress */}
        <StatCard
          label="In Progress"
          value={inProgress.length}
          color="text-blue-400"
          sub={<span className="text-xs text-slate-600">{addedThisWeek.length} new this period</span>}
        />

        {/* Blockers */}
        <StatCard
          label="Critical Blockers"
          value={blockers.length}
          color={blockers.length > 0 ? 'text-red-400' : 'text-slate-400'}
          sub={<span className="text-xs text-slate-600">{projectDebt.length} open tech debt</span>}
        />
      </div>

      {/* AI Narrative */}
      {aiError && (
        <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          AI error: {aiError}
        </div>
      )}
      {aiNarrative && (
        <div className="mb-6 bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
              <Sparkles size={13} />
              AI Executive Summary
            </div>
            <button
              onClick={() => setAiNarrative('')}
              className="text-slate-600 hover:text-slate-400 transition-colors"
              aria-label="Dismiss AI summary"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{aiNarrative}</p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        <DigestSection
          icon={<CheckCircle2 size={14} className="text-emerald-400" />}
          title={`Completed (${completed.length})`}
          open={expandSection.completed}
          onToggle={() => toggle('completed')}
        >
          {completed.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-2">No tasks completed in this period.</p>
          ) : (
            <TaskList tasks={completed.slice(0, 12)} />
          )}
        </DigestSection>

        <DigestSection
          icon={<Clock size={14} className="text-blue-400" />}
          title={`In Progress (${inProgress.length})`}
          open={expandSection.inProgress}
          onToggle={() => toggle('inProgress')}
        >
          {inProgress.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-2">No tasks currently in progress.</p>
          ) : (
            <TaskList tasks={inProgress.slice(0, 10)} />
          )}
        </DigestSection>

        {blockers.length > 0 && (
          <DigestSection
            icon={<AlertTriangle size={14} className="text-red-400" />}
            title={`Blockers — Critical (${blockers.length})`}
            open={expandSection.blockers}
            onToggle={() => toggle('blockers')}
            accent="rose"
          >
            <TaskList tasks={blockers} />
          </DigestSection>
        )}

        <DigestSection
          icon={<Inbox size={14} className="text-violet-400" />}
          title={`Inbox Activity (${inboxActivity.length})`}
          open={expandSection.inbox}
          onToggle={() => toggle('inbox')}
        >
          {inboxActivity.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-2">No inbox messages in this period.</p>
          ) : (
            <InboxList messages={inboxActivity.slice(0, 8)} />
          )}
        </DigestSection>

        {projectDebt.length > 0 && (
          <DigestSection
            icon={<Wrench size={14} className="text-rose-400" />}
            title={`Open Tech Debt (${projectDebt.length})`}
            open={expandSection.debt}
            onToggle={() => toggle('debt')}
          >
            <div className="space-y-1.5">
              {projectDebt.slice(0, 6).map(d => (
                <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 rounded-lg">
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded capitalize', priorityColor(d.priority))}>
                    {d.priority}
                  </span>
                  <span className="text-xs text-slate-300 truncate">{d.title}</span>
                  <span className="text-xs text-slate-600 ml-auto capitalize">{d.category.replace('-', ' ')}</span>
                </div>
              ))}
            </div>
          </DigestSection>
        )}

        {projectMilestones.length > 0 && (
          <DigestSection
            icon={<Flag size={14} className="text-blue-400" />}
            title={`Milestones (${projectMilestones.length})`}
            open={expandSection.milestones}
            onToggle={() => toggle('milestones')}
          >
            <div className="space-y-2">
              {projectMilestones.map(m => {
                const linked = (tasks[activeProjectId] ?? []).filter(t => m.linkedTaskIds.includes(t.id))
                const done   = linked.filter(t => t.status === 'done').length
                const pct    = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{m.title}</p>
                      <p className="text-xs text-slate-600">Due {format(parseISO(m.dueDate), 'MMM d')}</p>
                    </div>
                    <div className="w-20">
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </DigestSection>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className={clsx('text-3xl font-bold', color)}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-1">{label}</p>
      {sub}
    </div>
  )
}

function DigestSection({
  icon, title, open, onToggle, accent = 'default', children,
}: {
  icon: React.ReactNode
  title: string
  open: boolean
  onToggle: () => void
  accent?: 'default' | 'rose'
  children: React.ReactNode
}) {
  return (
    <div className={clsx(
      'bg-slate-900 border rounded-xl overflow-hidden',
      accent === 'rose' ? 'border-rose-500/20' : 'border-slate-800'
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        {icon}
        <span className="flex-1 text-sm font-medium text-slate-300">{title}</span>
        {open ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-800 pt-3">{children}</div>}
    </div>
  )
}

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <div className="space-y-1.5">
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/40 rounded-lg transition-colors">
          <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0',
            t.status === 'done' ? 'bg-emerald-500' :
            t.status === 'in-progress' ? 'bg-blue-500' : 'bg-slate-600'
          )} />
          <span className={clsx('flex-1 text-xs truncate', t.status === 'done' ? 'text-slate-500' : 'text-slate-300')}>
            {t.title.replace(/^\[.*?\]\s*/, '')}
          </span>
          <span className={clsx('text-xs px-1.5 py-0.5 rounded capitalize flex-shrink-0', priorityColor(t.priority))}>
            {t.priority}
          </span>
          {t.dueDate && (
            <span className="text-xs text-slate-600 flex-shrink-0">
              {format(parseISO(t.dueDate), 'MMM d')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function InboxList({ messages }: { messages: Message[] }) {
  const bySource = messages.reduce<Record<string, number>>((acc, m) => {
    acc[m.source] = (acc[m.source] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {Object.entries(bySource).map(([src, count]) => (
          <span key={src} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700">
            {src}: {count}
          </span>
        ))}
      </div>
      {messages.slice(0, 6).map(m => (
        <div key={m.id} className="flex items-start gap-2 px-2 py-1.5 hover:bg-slate-800/40 rounded-lg transition-colors">
          <span className="text-xs text-slate-600 uppercase tracking-wide flex-shrink-0 pt-0.5 w-12 truncate">{m.source}</span>
          <span className="flex-1 text-xs text-slate-300 truncate">{m.title}</span>
          <span className="text-xs text-slate-600 flex-shrink-0">{format(parseISO(m.timestamp), 'MMM d')}</span>
        </div>
      ))}
    </div>
  )
}
