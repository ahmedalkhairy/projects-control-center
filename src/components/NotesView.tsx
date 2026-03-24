import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import {
  NotebookPen, Plus, Trash2, ArrowRight, CheckSquare,
  FileText, ChevronRight, Search, Clock, SquarePen,
} from 'lucide-react'
import { HelpButton } from './HelpButton'
import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import type { MeetingNote } from '../types'

type EditorTab = 'write' | 'extract'

export default function NotesView() {
  const {
    projects,
    activeProjectId,
    notes,
    activeNoteId,
    addNote,
    updateNote,
    deleteNote,
    setActiveNoteId,
    extractNoteTask,
    tasks,
  } = useStore()

  const [tab, setTab] = useState<EditorTab>('write')
  const [search, setSearch] = useState('')
  const [justExtracted, setJustExtracted] = useState<Set<string>>(new Set())
  const [convertedNote, setConvertedNote] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null

  // Filter notes for the current project
  const projectNotes = notes.filter(n =>
    n.projectId === activeProjectId &&
    (search === '' ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()))
  )

  // Auto-select first note when project changes
  useEffect(() => {
    if (!activeNote || activeNote.projectId !== activeProjectId) {
      const first = notes.find(n => n.projectId === activeProjectId)
      setActiveNoteId(first?.id ?? null)
    }
  }, [activeProjectId])

  // Reset tab when switching notes
  useEffect(() => {
    setTab('write')
    setJustExtracted(new Set())
    setConvertedNote(false)
  }, [activeNoteId])

  function handleNewNote() {
    addNote(activeProjectId)
    setTab('write')
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  function handleDelete(note: MeetingNote) {
    deleteNote(note.id)
  }

  // Lines for the Extract tab — non-empty lines only
  const contentLines = (activeNote?.content ?? '')
    .split('\n')
    .map((line, idx) => ({ line: line.trim(), idx, raw: line }))
    .filter(l => l.line.length > 0)

  // All task IDs for this project (to detect already-extracted ones)
  const projectTaskIds = new Set(
    (tasks[activeNote?.projectId ?? ''] ?? []).map(t => t.id)
  )

  function handleExtract(line: string, noteId: string) {
    extractNoteTask(noteId, line, activeNote!.projectId)
    setJustExtracted(prev => new Set([...prev, line]))
  }

  function handleConvertNoteToTask() {
    if (!activeNote) return
    const title = activeNote.title.trim() || 'Untitled note'
    extractNoteTask(activeNote.id, title, activeNote.projectId)
    // Also stamp the description by updating the created task via addTask path isn't available here,
    // so we use the store's addTask directly for richer data
    // Instead: use extractNoteTask for the ID link, then patch the task description
    const { tasks: currentTasks, updateTask } = useStore.getState()
    const projectTasks = currentTasks[activeNote.projectId] ?? []
    const created = projectTasks[projectTasks.length - 1]
    if (created && activeNote.content.trim()) {
      updateTask(created.id, { description: activeNote.content })
    }
    setConvertedNote(true)
    setTimeout(() => setConvertedNote(false), 2500)
  }

  const project = projects.find(p => p.id === activeProjectId)

  return (
    <div className="flex h-full">
      {/* ── Left panel: note list ── */}
      <div className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <NotebookPen size={14} className="text-violet-400" />
            <span className="text-sm font-semibold text-slate-200">Notes</span>
            <HelpButton
              title="Meeting Notes"
              description="A quick-capture notepad for meetings and ideas. Write freely, then extract action items as tasks with one click."
              tips={[
                'Switch to the Extract tab to see each line as a potential task.',
                'Click → on any line to instantly create a task from it.',
                '"Convert whole note" creates one task with the entire content.',
                'Saved notes are searchable and linked to the current project.',
                'Use standup view to save a generated standup as a note.',
              ]}
            />
          </div>
          <button
            onClick={handleNewNote}
            className="p-1 rounded text-slate-500 hover:text-violet-400 hover:bg-slate-800 transition-colors"
            title="New note"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-2.5 py-1.5">
            <Search size={12} className="text-slate-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto py-1">
          {projectNotes.length === 0 ? (
            <div className="py-8 text-center">
              <FileText size={20} className="text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">
                {search ? 'No matching notes' : 'No notes yet'}
              </p>
              {!search && (
                <button
                  onClick={handleNewNote}
                  className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  + New note
                </button>
              )}
            </div>
          ) : (
            projectNotes.map(note => {
              const isActive = note.id === activeNoteId
              const taskCount = note.extractedTaskIds.filter(id => projectTaskIds.has(id)).length
              return (
                <button
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 transition-colors group border-l-2',
                    isActive
                      ? 'bg-slate-800 border-violet-500'
                      : 'border-transparent hover:bg-slate-800/50 hover:border-slate-600'
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className={clsx(
                      'text-xs font-medium truncate flex-1',
                      isActive ? 'text-slate-100' : 'text-slate-400'
                    )}>
                      {note.title || 'Untitled note'}
                    </p>
                    {isActive && (
                      <ChevronRight size={10} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-600 flex items-center gap-0.5">
                      <Clock size={9} />
                      {format(parseISO(note.updatedAt), 'MMM d')}
                    </span>
                    {taskCount > 0 && (
                      <span className="text-xs text-violet-500 flex items-center gap-0.5">
                        <CheckSquare size={9} />
                        {taskCount}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right panel: editor ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeNote ? (
          <>
            {/* Note toolbar */}
            <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              {/* Project chip */}
              <div className="flex items-center gap-2">
                {project && (
                  <div className="flex items-center gap-1.5 bg-slate-800 rounded-full px-2.5 py-0.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="text-xs text-slate-400">{project.name}</span>
                  </div>
                )}
                <span className="text-xs text-slate-600">
                  {format(parseISO(activeNote.updatedAt), 'MMM d, yyyy · h:mm a')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Convert whole note to task */}
                <button
                  onClick={handleConvertNoteToTask}
                  disabled={!activeNote?.title && !activeNote?.content}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                    convertedNote
                      ? 'bg-green-600/20 text-green-400 border-green-600/30'
                      : 'bg-violet-600/20 text-violet-400 border-violet-600/30 hover:bg-violet-600/40 hover:text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                  title="Convert entire note to a task"
                >
                  {convertedNote ? (
                    <><CheckSquare size={12} /> Converted</>
                  ) : (
                    <><SquarePen size={12} /> To Task</>
                  )}
                </button>

                {/* Tab switcher */}
                <div className="flex bg-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setTab('write')}
                    className={clsx(
                      'px-3 py-1 rounded-md transition-colors font-medium',
                      tab === 'write' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    Write
                  </button>
                  <button
                    onClick={() => setTab('extract')}
                    className={clsx(
                      'px-3 py-1 rounded-md transition-colors font-medium',
                      tab === 'extract' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    Extract Tasks
                    {contentLines.length > 0 && (
                      <span className="ml-1 text-slate-600">({contentLines.length})</span>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => handleDelete(activeNote)}
                  className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Delete note"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="px-6 pt-5 pb-2 flex-shrink-0">
              <input
                ref={titleRef}
                value={activeNote.title}
                onChange={e => updateNote(activeNote.id, { title: e.target.value })}
                placeholder="Meeting title…"
                className="w-full bg-transparent text-xl font-semibold text-slate-100 placeholder-slate-700 focus:outline-none"
              />
            </div>

            {/* Editor area */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {tab === 'write' ? (
                <textarea
                  ref={contentRef}
                  value={activeNote.content}
                  onChange={e => updateNote(activeNote.id, { content: e.target.value })}
                  placeholder={`Start typing meeting notes...\n\nTip: Each line can become a task. Switch to "Extract Tasks" to convert lines to tasks.`}
                  className="w-full h-full min-h-[400px] bg-transparent text-sm text-slate-300 placeholder-slate-700 focus:outline-none resize-none leading-relaxed"
                />
              ) : (
                <ExtractTab
                  lines={contentLines}
                  note={activeNote}
                  justExtracted={justExtracted}
                  onExtract={line => handleExtract(line, activeNote.id)}
                />
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <NotebookPen size={28} className="text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium mb-1">No note selected</p>
            <p className="text-slate-600 text-sm mb-5">
              Create a note to capture meeting outcomes and extract tasks
            </p>
            <button
              onClick={handleNewNote}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} />
              New Note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Extract Tab ──────────────────────────────────────────────────────────────

interface ExtractTabProps {
  lines: { line: string; idx: number; raw: string }[]
  note: MeetingNote
  justExtracted: Set<string>
  onExtract: (line: string) => void
}

function ExtractTab({ lines, note, justExtracted, onExtract }: ExtractTabProps) {
  const alreadyExtracted = new Set(
    lines
      .filter(l => justExtracted.has(l.line))
      .map(l => l.line)
  )

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <FileText size={24} className="text-slate-700 mx-auto mb-3" />
        <p className="text-sm text-slate-600">Write some notes first, then come back to extract tasks.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 pt-1">
      <p className="text-xs text-slate-600 mb-3">
        Click <ArrowRight size={10} className="inline" /> to convert any line into a task in this project.
      </p>
      {lines.map(({ line, idx }) => {
        const extracted = alreadyExtracted.has(line)
        // Detect if the line looks like a heading (starts with # or is ALL CAPS short)
        const isHeading = line.startsWith('#') || (line.length < 40 && line === line.toUpperCase() && /[A-Z]/.test(line))

        return (
          <div
            key={idx}
            className={clsx(
              'group flex items-start gap-3 px-3 py-2 rounded-lg transition-colors',
              extracted
                ? 'opacity-40'
                : isHeading
                ? 'bg-slate-800/30'
                : 'hover:bg-slate-800/60'
            )}
          >
            {/* Line indicator */}
            <span className="text-xs text-slate-700 w-5 text-right flex-shrink-0 mt-0.5 font-mono">
              {idx + 1}
            </span>

            {/* Line text */}
            <p className={clsx(
              'flex-1 text-sm leading-relaxed min-w-0',
              isHeading ? 'font-semibold text-slate-300' : 'text-slate-400',
              extracted && 'line-through',
            )}>
              {line.replace(/^#+\s*/, '')}
            </p>

            {/* Extract button */}
            {!extracted && !isHeading && (
              <button
                onClick={() => onExtract(line.replace(/^[-*•]\s*/, '').replace(/^#+\s*/, ''))}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-violet-600/20 text-violet-400 border border-violet-600/30 hover:bg-violet-600/40 hover:text-violet-300 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 whitespace-nowrap"
                title="Convert to task"
              >
                <ArrowRight size={11} />
                Task
              </button>
            )}

            {extracted && (
              <span className="flex items-center gap-1 text-xs text-slate-600 flex-shrink-0">
                <CheckSquare size={11} />
                Added
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
