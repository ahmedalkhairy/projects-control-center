import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import {
  Sparkles, Send, Trash2, Bot, User, Loader2, Settings,
  Copy, Check, Plus, MessageSquare, ChevronLeft, ChevronRight, Pencil, X,
} from 'lucide-react'
import clsx from 'clsx'
import type { ChatMessage } from '../services/claude'
import { streamChat } from '../services/claude'
import { HelpButton } from './HelpButton'

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  function handleCopy() {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={clsx('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-violet-600 to-purple-700'
      )}>
        {isUser ? <User size={13} className="text-white" /> : <Bot size={13} className="text-white" />}
      </div>
      <div className={clsx(
        'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative',
        isUser
          ? 'bg-blue-600/20 text-slate-100 border border-blue-600/20'
          : 'bg-slate-800/80 text-slate-200 border border-slate-700/50'
      )}>
        <div className="whitespace-pre-wrap break-words">
          {msg.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>
        {!isStreaming && msg.content && (
          <button
            onClick={handleCopy}
            className={clsx(
              'absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
              'text-slate-500 hover:text-slate-300'
            )}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What are my highest priority tasks right now?',
  'Summarize the current project status.',
  'What should I focus on today?',
  'Are there any critical blockers I should know about?',
  'What tech debt items need the most attention?',
  'Write a status update for this project.',
]

function formatSessionDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export default function AIAssistantView() {
  const {
    activeProjectId, projects, tasks, messages: storeMessages,
    techDebt, milestones, geminiApiKey, setActiveSection,
    aiSessions, saveAiSession, deleteAiSession, updateAiSessionTitle,
  } = useStore()

  const project       = projects.find(p => p.id === activeProjectId)
  const projectTasks  = tasks[activeProjectId] ?? []
  const projectMsgs   = (storeMessages[activeProjectId] ?? []).slice(0, 20)
  const projectDebt   = techDebt.filter(d => d.projectId === activeProjectId)
  const projectMiles  = milestones.filter(m => m.projectId === activeProjectId)
  const projectSessions = aiSessions
    .filter(s => s.projectId === activeProjectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const [chatHistory, setChatHistory]     = useState<ChatMessage[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [input, setInput]                 = useState('')
  const [isStreaming, setIsStreaming]     = useState(false)
  const [error, setError]                 = useState('')
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editTitle, setEditTitle]         = useState('')

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const streamBuf  = useRef('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isStreaming])

  // Save + reset when project changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      saveAiSession(activeProjectId, chatHistory, currentSessionId ?? undefined)
    }
    setChatHistory([])
    setCurrentSessionId(null)
    setError('')
    streamBuf.current = ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  function startNewChat() {
    if (chatHistory.length > 0) {
      saveAiSession(activeProjectId, chatHistory, currentSessionId ?? undefined)
    }
    setChatHistory([])
    setCurrentSessionId(null)
    setError('')
    streamBuf.current = ''
    inputRef.current?.focus()
  }

  function loadSession(sessionId: string) {
    // Save current first
    if (chatHistory.length > 0) {
      saveAiSession(activeProjectId, chatHistory, currentSessionId ?? undefined)
    }
    const session = aiSessions.find(s => s.id === sessionId)
    if (!session) return
    setChatHistory(session.messages as ChatMessage[])
    setCurrentSessionId(sessionId)
    setError('')
    streamBuf.current = ''
  }

  function handleSuggestion(text: string) {
    setInput(text)
    inputRef.current?.focus()
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming || !geminiApiKey) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updatedHistory = [...chatHistory, userMsg]
    setChatHistory(updatedHistory)
    setInput('')
    setError('')
    setIsStreaming(true)
    streamBuf.current = ''

    setChatHistory(h => [...h, { role: 'assistant', content: '' }])

    await streamChat({
      messages: updatedHistory,
      project: project!,
      tasks: projectTasks,
      recentInbox: projectMsgs,
      techDebt: projectDebt,
      milestones: projectMiles,
      apiKey: geminiApiKey,
      onChunk: (chunk) => {
        streamBuf.current += chunk
        const buf = streamBuf.current
        setChatHistory(h => {
          const next = [...h]
          next[next.length - 1] = { role: 'assistant', content: buf }
          return next
        })
      },
      onDone: () => {
        setIsStreaming(false)
        // Auto-save after each assistant response
        const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: streamBuf.current }]
        const savedId = saveAiSession(activeProjectId, finalHistory, currentSessionId ?? undefined)
        if (!currentSessionId) setCurrentSessionId(savedId)
      },
      onError: (err) => {
        setIsStreaming(false)
        setError(err)
        setChatHistory(h => {
          const last = h[h.length - 1]
          if (last?.role === 'assistant' && !last.content) return h.slice(0, -1)
          return h
        })
      },
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function startEditTitle(id: string, title: string) {
    setEditingId(id)
    setEditTitle(title)
  }

  function commitEditTitle(id: string) {
    if (editTitle.trim()) updateAiSessionTitle(id, editTitle.trim())
    setEditingId(null)
  }

  if (!geminiApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
        <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center">
          <Sparkles size={28} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">AI Assistant</h2>
          <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
            Connect your Google Gemini API key to enable the AI assistant.
          </p>
        </div>
        <button
          onClick={() => setActiveSection('settings')}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Settings size={14} />
          Go to Settings
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Sessions sidebar ───────────────────────────────────────── */}
      <div className={clsx(
        'flex flex-col border-r border-slate-800 bg-slate-900/50 transition-all duration-200 flex-shrink-0',
        sidebarOpen ? 'w-52' : 'w-0 overflow-hidden'
      )}>
        {/* New chat button */}
        <div className="p-2.5 border-b border-slate-800">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-violet-600/20 hover:bg-violet-600/30 border border-violet-600/30 rounded-lg transition-colors"
          >
            <Plus size={13} />
            New Chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-1.5 space-y-0.5 px-1.5">
          {projectSessions.length === 0 ? (
            <div className="text-center text-xs text-slate-600 py-8 px-2">
              No saved sessions yet
            </div>
          ) : (
            projectSessions.map(session => (
              <div
                key={session.id}
                className={clsx(
                  'group relative rounded-lg px-2.5 py-2 cursor-pointer transition-colors',
                  currentSessionId === session.id
                    ? 'bg-violet-600/20 border border-violet-600/20'
                    : 'hover:bg-slate-800/60 border border-transparent'
                )}
                onClick={() => loadSession(session.id)}
              >
                {editingId === session.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => commitEditTitle(session.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEditTitle(session.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                    className="w-full text-xs text-slate-200 bg-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                ) : (
                  <>
                    <div className="flex items-start gap-1.5">
                      <MessageSquare size={11} className="text-slate-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-300 leading-snug line-clamp-2 flex-1">
                        {session.title}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 ml-4">
                      {formatSessionDate(session.updatedAt)}
                    </div>

                    {/* Action buttons */}
                    <div className="absolute right-1.5 top-1.5 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); startEditTitle(session.id, session.title) }}
                        className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (currentSessionId === session.id) {
                            setChatHistory([])
                            setCurrentSessionId(null)
                          }
                          deleteAiSession(session.id)
                        }}
                        className="p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Main chat area ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              title={sidebarOpen ? 'Hide history' : 'Show history'}
            >
              {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            </button>

            <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-purple-700 rounded-lg flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-100">AI Assistant</div>
                <HelpButton
                  title="AI Assistant"
                  description="A project-aware chat powered by Google Gemini (gemini-2.5-flash). Conversations are saved automatically and accessible from the history sidebar."
                  tips={[
                    'Ask for task prioritization: "What should I focus on today?"',
                    'Request status summaries: "Summarize the current project state."',
                    'Get writing help: "Write a status update for stakeholders."',
                    'Conversations are auto-saved after each reply.',
                    'Toggle the history panel with the ‹ › button.',
                    'Set your Gemini API key in Settings → AI Assistant.',
                  ]}
                />
              </div>
              <div className="text-xs text-slate-500">{project?.name} · gemini-2.5-flash</div>
            </div>
          </div>

          {chatHistory.length > 0 && (
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 px-2.5 py-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              New chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="w-14 h-14 bg-violet-600/10 rounded-2xl flex items-center justify-center border border-violet-600/20">
                <Bot size={24} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 mb-1.5">
                  How can I help with {project?.name}?
                </h3>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  I have full context about your tasks, milestones, tech debt, and inbox. Ask me anything.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-full border border-slate-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatHistory.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                isStreaming={isStreaming && i === chatHistory.length - 1 && msg.role === 'assistant'}
              />
            ))
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              Error: {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-slate-800 p-4">
          <div className="flex items-end gap-3 bg-slate-800/60 border border-slate-700 rounded-2xl px-4 py-3 focus-within:border-violet-600/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this project…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ height: 'auto', minHeight: '24px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 128) + 'px'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={clsx(
                'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                input.trim() && !isStreaming
                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              )}
            >
              {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-xs text-slate-700 mt-1.5 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
