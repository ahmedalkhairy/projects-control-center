import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Task, Project, Message, TechDebtItem, Milestone } from '../types'

// ─── Model ────────────────────────────────────────────────────────────────────

const MODEL = 'gemini-2.5-flash'

// ─── Client factory ────────────────────────────────────────────────────────────
// Gemini API supports browser-side calls (no CORS proxy needed).

function makeClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey)
}

// ─── Context builders ──────────────────────────────────────────────────────────

function taskSummary(tasks: Task[]): string {
  return tasks.slice(0, 30).map(t => {
    const meta = [
      t.assignee ? `@${t.assignee}` : '',
      t.storyPoints != null ? `${t.storyPoints}sp` : '',
      t.completedAt ? `completed ${t.completedAt.slice(0, 10)}` : '',
    ].filter(Boolean).join(', ')

    const desc = t.description
      ? `\n    Description: ${t.description.replace(/\s+/g, ' ').slice(0, 300)}${t.description.length > 300 ? '…' : ''}`
      : ''

    return `- [${t.status}] [${t.priority}] ${t.title}` +
      (t.jiraKey ? ` (${t.jiraKey})` : '') +
      (meta ? ` (${meta})` : '') +
      desc
  }).join('\n')
}

function groupBySprint(tasks: Task[]): string {
  const sprintMap = new Map<string, Task[]>()
  const backlog: Task[] = []

  for (const t of tasks) {
    if (t.sprint) {
      const list = sprintMap.get(t.sprint) ?? []
      list.push(t)
      sprintMap.set(t.sprint, list)
    } else {
      backlog.push(t)
    }
  }

  const sections: string[] = []

  for (const [sprintName, sprintTasks] of sprintMap) {
    sections.push(`Sprint: ${sprintName} (${sprintTasks.length} tasks)\n${taskSummary(sprintTasks)}`)
  }

  if (backlog.length > 0) {
    sections.push(`Backlog / No Sprint (${backlog.length} tasks)\n${taskSummary(backlog)}`)
  }

  return sections.join('\n\n')
}

// ─── Standup draft ─────────────────────────────────────────────────────────────

export interface StandupDraftResult {
  done: string
  today: string
  blockers: string
}

export async function generateStandupDraft(params: {
  project: Project
  doneTasks: Task[]
  inProgressTasks: Task[]
  plannedTasks: Task[]
  blockerTasks: Task[]
  apiKey: string
}): Promise<StandupDraftResult> {
  const { project, doneTasks, inProgressTasks, plannedTasks, blockerTasks, apiKey } = params
  const genAI = makeClient(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })

  const prompt = `You are writing a concise daily standup update for a software team.

Project: ${project.name}
${project.description ? `Description: ${project.description}` : ''}

Tasks completed recently:
${doneTasks.length ? taskSummary(doneTasks) : '(none)'}

Tasks currently in progress:
${inProgressTasks.length ? taskSummary(inProgressTasks) : '(none)'}

Tasks planned next:
${plannedTasks.length ? taskSummary(plannedTasks) : '(none)'}

Tasks that may be blockers (critical priority):
${blockerTasks.length ? taskSummary(blockerTasks) : '(none)'}

Write a standup update in three short sections.
Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "done": "bullet-point text for what was done yesterday",
  "today": "bullet-point text for what will be worked on today",
  "blockers": "bullet-point text for blockers, or empty string if none"
}

Keep each section brief — 1-4 bullet points, one line each. Write naturally, like a real developer.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  try {
    const clean = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(clean) as StandupDraftResult
  } catch {
    return { done: text, today: '', blockers: '' }
  }
}

// ─── Weekly narrative ──────────────────────────────────────────────────────────

export async function generateWeeklyNarrative(params: {
  project: Project
  range: number
  completedTasks: Task[]
  inProgressTasks: Task[]
  blockerTasks: Task[]
  openDebtCount: number
  milestoneCount: number
  inboxCount: number
  apiKey: string
}): Promise<string> {
  const {
    project, range, completedTasks, inProgressTasks,
    blockerTasks, openDebtCount, milestoneCount, inboxCount, apiKey,
  } = params
  const genAI = makeClient(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })

  const prompt = `You are a technical project manager writing a concise weekly digest summary.

Project: ${project.name}
Period: last ${range} days
${project.description ? `Description: ${project.description}` : ''}

Stats:
- Completed tasks: ${completedTasks.length}
- In-progress tasks: ${inProgressTasks.length}
- Critical blockers: ${blockerTasks.length}
- Open tech debt items: ${openDebtCount}
- Active milestones: ${milestoneCount}
- Inbox messages received: ${inboxCount}

Completed tasks:
${completedTasks.length ? taskSummary(completedTasks) : '(none)'}

In-progress tasks:
${inProgressTasks.length ? taskSummary(inProgressTasks) : '(none)'}

Write a 2-3 paragraph executive summary of the week. Be concise, professional, and highlight:
1. Key accomplishments
2. Current focus and momentum
3. Any risks or blockers that need attention

Do NOT use bullet points. Write in flowing prose. Keep it under 200 words.`

  const result = await model.generateContent(prompt)
  return result.response.text()
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function streamChat(params: {
  messages: ChatMessage[]
  project: Project
  tasks: Task[]
  recentInbox: Message[]
  techDebt: TechDebtItem[]
  milestones: Milestone[]
  apiKey: string
  onChunk: (text: string) => void
  onDone: () => void
  onError: (err: string) => void
}): Promise<void> {
  const {
    messages, project, tasks, recentInbox, techDebt, milestones,
    apiKey, onChunk, onDone, onError,
  } = params

  const genAI = makeClient(apiKey)

  const openTasks  = tasks.filter(t => t.status !== 'done')
  const doneTasks  = tasks.filter(t => t.status === 'done')
  const openDebt   = techDebt.filter(d => d.status !== 'resolved')
  const activeMilestones = milestones.filter(m => m.status !== 'completed')

  const sprintNames = [...new Set(openTasks.map(t => t.sprint).filter(Boolean))]
  const teamMembers = [...new Set(openTasks.map(t => t.assignee).filter(Boolean))]

  const systemInstruction = `You are an AI assistant embedded in a developer operations dashboard called "Control Center".

Current project: ${project.name}
${project.description ? `Project description: ${project.description}` : ''}

Project context:
- Total open tasks (entire team): ${openTasks.length} (${tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length} critical)
- Completed tasks: ${doneTasks.length}
- In-progress tasks: ${tasks.filter(t => t.status === 'in-progress').length}
- Active sprints: ${sprintNames.length > 0 ? sprintNames.join(', ') : 'none detected'}
- Team members with tasks: ${teamMembers.length > 0 ? teamMembers.join(', ') : 'unknown'}
- Tech debt items: ${openDebt.length} open
- Active milestones: ${activeMilestones.length}
- Recent inbox messages: ${recentInbox.length}

All open tasks grouped by sprint (team-wide):
${groupBySprint(openTasks.slice(0, 60))}

${activeMilestones.length > 0 ? `Active milestones:
${activeMilestones.map(m => `- ${m.title} (due: ${m.dueDate}, status: ${m.status})`).join('\n')}` : ''}

${openDebt.length > 0 ? `Top tech debt items:
${openDebt.slice(0, 5).map(d => `- [${d.category}] ${d.title}`).join('\n')}` : ''}

You have full knowledge of the entire team's tasks above, grouped by sprint. Each task shows the assignee with @name. When asked about sprint analysis, task distribution, or team workload — answer at the team level, not just one person. Be concise and actionable.`

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction,
    })

    // Build Gemini history from all messages except the last user message
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = model.startChat({ history })
    const result = await chat.sendMessageStream(lastMessage.content)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) onChunk(text)
    }

    onDone()
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err))
  }
}
