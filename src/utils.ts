import { formatDistanceToNow, format } from 'date-fns'
import type { Priority, TaskStatus, MessageSource } from './types'
import type { CSSProperties } from 'react'

export function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return 'unknown'
  }
}

export function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy')
  } catch {
    return 'unknown'
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy HH:mm')
  } catch {
    return 'unknown'
  }
}

export function priorityColor(priority: Priority): string {
  switch (priority) {
    case 'critical': return 'text-red-400'
    case 'high': return 'text-orange-400'
    case 'medium': return 'text-yellow-400'
    case 'low': return 'text-slate-400'
    default: return 'text-slate-400'
  }
}

export function priorityBg(priority: Priority): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'low': return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export function priorityDot(priority: Priority): string {
  switch (priority) {
    case 'critical': return 'bg-red-500'
    case 'high': return 'bg-orange-500'
    case 'medium': return 'bg-yellow-500'
    case 'low': return 'bg-slate-500'
    default: return 'bg-slate-500'
  }
}

export function priorityBorderLeft(priority: Priority): string {
  switch (priority) {
    case 'critical': return 'border-l-red-500'
    case 'high': return 'border-l-orange-500'
    case 'medium': return 'border-l-yellow-500'
    case 'low': return 'border-l-slate-600'
    default: return 'border-l-slate-600'
  }
}

export function statusColor(status: TaskStatus): string {
  switch (status) {
    case 'todo': return 'text-slate-400'
    case 'in-progress': return 'text-blue-400'
    case 'done': return 'text-green-400'
    default: return 'text-slate-400'
  }
}

export function statusBg(status: TaskStatus): string {
  switch (status) {
    case 'todo': return 'bg-slate-500/20 text-slate-400'
    case 'in-progress': return 'bg-blue-500/20 text-blue-400'
    case 'done': return 'bg-green-500/20 text-green-400'
    default: return 'bg-slate-500/20 text-slate-400'
  }
}

export function sourceColor(source: MessageSource): string {
  switch (source) {
    case 'jira': return 'text-blue-400'
    case 'email': return 'text-purple-400'
    case 'whatsapp': return 'text-green-400'
    default: return 'text-slate-400'
  }
}

export function sourceBg(source: MessageSource): string {
  switch (source) {
    case 'jira':    return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'github':  return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    case 'gitlab':  return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'email':   return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'whatsapp':return 'bg-green-500/20 text-green-400 border-green-500/30'
    default:        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export function sourceIcon(source: MessageSource): string {
  switch (source) {
    case 'jira':    return 'Trello'
    case 'github':  return 'GitBranch'
    case 'gitlab':  return 'GitBranch'
    case 'email':   return 'Mail'
    case 'whatsapp':return 'MessageCircle'
    default:        return 'MessageSquare'
  }
}

export function sourceLabel(source: MessageSource): string {
  switch (source) {
    case 'jira':    return 'Jira'
    case 'github':  return 'GitHub'
    case 'gitlab':  return 'GitLab'
    case 'email':   return 'Email'
    case 'whatsapp':return 'WhatsApp'
    default:        return source
  }
}

export function projectColorStyle(color: string): CSSProperties {
  return { color }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date()
}

// ─── Desktop Push Notifications ───────────────────────────────────────────────

export async function requestDesktopPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

const TYPE_ICON: Record<string, string> = {
  error:   '🔴',
  warning: '⚠️',
  info:    'ℹ️',
  success: '✅',
}

export function sendDesktopNotification(
  title: string,
  body: string,
  type: 'info' | 'warning' | 'error' | 'success',
  url?: string,
): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const icon = TYPE_ICON[type] ?? 'ℹ️'
  const n = new Notification(`${icon} ${title}`, {
    body,
    silent: false,
    requireInteraction: true,   // stays until user dismisses — OS controls timeout otherwise
  })
  if (url) n.onclick = () => { window.open(url, '_blank', 'noopener,noreferrer'); n.close() }
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen) + '...'
}
