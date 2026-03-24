import { useState } from 'react'
import { useStore } from '../store'
import type { LucideIcon } from 'lucide-react'
import {
  Inbox,
  Trello,
  Mail,
  MessageCircle,
  GitBranch,
  ExternalLink,
  Check,
  Trash2,
  Eye,
  EyeOff,
  ArrowRightCircle,
  CheckCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { HelpButton } from './HelpButton'
import clsx from 'clsx'
import {
  timeAgo,
  priorityBg,
  priorityBorderLeft,
  sourceBg,
  sourceLabel,
} from '../utils'
import type { Message, MessageSource, MessageStatus, Priority } from '../types'

const SOURCE_ICONS: Record<MessageSource, LucideIcon> = {
  jira:     Trello,
  github:   GitBranch,
  gitlab:   GitBranch,
  email:    Mail,
  whatsapp: MessageCircle,
}

type SourceFilter = 'all' | MessageSource
type StatusFilter = 'all' | MessageStatus
type PriorityFilter = 'all' | Priority

// Status sort order: unread first, handled last
const STATUS_ORDER: Record<MessageStatus, number> = { unread: 0, read: 1, handled: 2 }

export default function InboxView() {
  const {
    activeProjectId,
    messages,
    markMessageRead,
    markMessageUnread,
    markMessageHandled,
    deleteMessage,
    convertToTask,
  } = useStore()

  const [sourceFilter, setSourceFilter]     = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [showFilters, setShowFilters]       = useState(false)

  const projectMessages = messages[activeProjectId] ?? []

  // 1. Filter
  const filtered = projectMessages.filter(m => {
    if (sourceFilter !== 'all' && m.source !== sourceFilter) return false
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (priorityFilter !== 'all' && m.priority !== priorityFilter) return false
    return true
  })

  // 2. Sort: unread → read → handled; within each group newest first
  const sorted = [...filtered].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (statusDiff !== 0) return statusDiff
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const unreadCount = projectMessages.filter(m => m.status === 'unread').length

  function getSourceCount(source: MessageSource) {
    return projectMessages.filter(m => m.source === source).length
  }

  function markAllRead() {
    projectMessages
      .filter(m => m.status === 'unread')
      .forEach(m => markMessageRead(m.id))
  }

  const SOURCE_TABS: { key: SourceFilter; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'jira',     label: 'Jira' },
    { key: 'github',   label: 'GitHub' },
    { key: 'gitlab',   label: 'GitLab' },
    { key: 'email',    label: 'Email' },
    { key: 'whatsapp', label: 'WhatsApp' },
  ]

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'read', label: 'Read' },
    { key: 'handled', label: 'Handled' },
  ]

  const PRIORITY_FILTERS: { key: PriorityFilter; label: string; color: string }[] = [
    { key: 'all',      label: 'All',      color: '' },
    { key: 'critical', label: 'Critical', color: 'text-red-400' },
    { key: 'high',     label: 'High',     color: 'text-orange-400' },
    { key: 'medium',   label: 'Medium',   color: 'text-yellow-400' },
    { key: 'low',      label: 'Low',      color: 'text-slate-400' },
  ]

  const activeFilterCount = (sourceFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (priorityFilter !== 'all' ? 1 : 0)

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">Inbox</h1>
          <HelpButton
            title="Inbox"
            description="Centralizes all incoming notifications from your connected integrations — Jira, GitLab, email, WhatsApp, and GitHub. Every new message arrives here first."
            tips={[
              'Mark messages as Read / Handled to track what you\'ve processed.',
              '"→ To Task" converts a message into a task in the current project.',
              'Filter by source (Jira, GitLab, etc.) or priority using the dropdowns.',
              'Unread count shows on the sidebar badge so nothing slips through.',
            ]}
          />
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors',
              showFilters || activeFilterCount > 0
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Source tabs */}
      <div className="flex items-center gap-2 mb-3">
        {SOURCE_TABS.map(tab => {
          const count = tab.key === 'all' ? projectMessages.length : getSourceCount(tab.key as MessageSource)
          const isActive = sourceFilter === tab.key
          const SourceIcon = tab.key !== 'all' ? SOURCE_ICONS[tab.key as MessageSource] : null

          return (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              )}
            >
              {SourceIcon && (
                <SourceIcon
                  size={12}
                  className={clsx(
                    tab.key === 'jira'     && 'text-blue-400',
                    tab.key === 'github'   && 'text-slate-300',
                    tab.key === 'gitlab'   && 'text-orange-400',
                    tab.key === 'email'    && 'text-purple-400',
                    tab.key === 'whatsapp' && 'text-green-400'
                  )}
                />
              )}
              {tab.label}
              <span
                className={clsx(
                  'text-xs px-1.5 py-0.5 rounded',
                  isActive ? 'bg-slate-700 text-slate-300' : 'bg-slate-800/80 text-slate-500'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="mb-4 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          {/* Status row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-14 flex-shrink-0">Status</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={clsx(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
                    statusFilter === f.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-14 flex-shrink-0">Priority</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRIORITY_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setPriorityFilter(f.key)}
                  className={clsx(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
                    priorityFilter === f.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 hover:text-slate-200',
                    priorityFilter !== f.key && f.color
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setSourceFilter('all'); setStatusFilter('all'); setPriorityFilter('all') }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}

      {/* Result count hint */}
      {activeFilterCount > 0 && (
        <p className="text-xs text-slate-600 mb-3">
          Showing {sorted.length} of {projectMessages.length} messages
        </p>
      )}

      {/* Message list */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <Inbox size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No messages</p>
          <p className="text-slate-600 text-sm mt-1">
            {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Your inbox is empty'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(message => (
            <MessageCard
              key={message.id}
              message={message}
              onMarkRead={() => markMessageRead(message.id)}
              onMarkUnread={() => markMessageUnread(message.id)}
              onMarkHandled={() => markMessageHandled(message.id)}
              onDelete={() => deleteMessage(message.id)}
              onConvertToTask={() => convertToTask(message.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface MessageCardProps {
  message: Message
  onMarkRead: () => void
  onMarkUnread: () => void
  onMarkHandled: () => void
  onDelete: () => void
  onConvertToTask: () => void
}

function MessageCard({
  message,
  onMarkRead,
  onMarkUnread,
  onMarkHandled,
  onDelete,
  onConvertToTask,
}: MessageCardProps) {
  const [hovered, setHovered] = useState(false)
  const SourceIcon = SOURCE_ICONS[message.source]
  const isUnread = message.status === 'unread'
  const isHandled = message.status === 'handled'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={clsx(
        'relative rounded-xl border transition-all duration-150 overflow-hidden group',
        'border-l-2',
        priorityBorderLeft(message.priority as Priority),
        isUnread
          ? 'bg-slate-900 border-slate-700 hover:border-slate-600'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700',
        isHandled && 'opacity-60'
      )}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={clsx(
                'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border flex-shrink-0',
                sourceBg(message.source)
              )}
            >
              <SourceIcon size={11} />
              {sourceLabel(message.source)}
            </div>
            {isUnread && (
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
            )}
            {isHandled && (
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                handled
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">
            {timeAgo(message.timestamp)}
          </span>
        </div>

        {/* Title */}
        <h3
          className={clsx(
            'text-sm leading-snug mb-1.5',
            isUnread ? 'font-semibold text-slate-100' : 'font-medium text-slate-300'
          )}
        >
          {message.title}
        </h3>

        {/* Body preview */}
        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {message.body}
        </p>

        {/* Bottom row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs text-slate-600 truncate">
              from: {message.from}
            </span>
            <span
              className={clsx(
                'badge text-xs border flex-shrink-0',
                priorityBg(message.priority as Priority)
              )}
            >
              {message.priority}
            </span>
            {message.labels?.slice(0, 2).map(label => (
              <span
                key={label}
                className="text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Action buttons (visible on hover) */}
          <div
            className={clsx(
              'flex items-center gap-1 flex-shrink-0 transition-opacity duration-150',
              hovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            {/* Mark read/unread toggle */}
            <button
              onClick={isUnread ? onMarkRead : onMarkUnread}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              aria-label={isUnread ? 'Mark as read' : 'Mark as unread'}
              title={isUnread ? 'Mark as read' : 'Mark as unread'}
            >
              {isUnread ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>

            {/* Mark handled */}
            {!isHandled && (
              <button
                onClick={onMarkHandled}
                className="p-1.5 rounded text-slate-500 hover:text-green-400 hover:bg-slate-700 transition-colors"
                aria-label="Mark as handled"
                title="Mark as handled"
              >
                <Check size={13} />
              </button>
            )}

            {/* Convert to task */}
            <button
              onClick={onConvertToTask}
              className="p-1.5 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors"
              aria-label="Convert to task"
              title="Convert to task"
            >
              <ArrowRightCircle size={13} />
            </button>

            {/* External link */}
            {message.externalLink && (
              <a
                href={message.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                aria-label="Open in external app"
                title="Open external link"
              >
                <ExternalLink size={13} />
              </a>
            )}

            {/* Delete */}
            <button
              onClick={onDelete}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
              aria-label="Delete message"
              title="Delete message"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
