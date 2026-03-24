/**
 * Central registry of all workspace modules.
 * Shared between Sidebar (to filter nav) and SettingsView (to render toggles).
 */

import type { LucideIcon } from 'lucide-react'
import {
  Target, Inbox, CheckSquare, NotebookPen, Wrench,
  ClipboardList, Flag, BarChart3, Sparkles, Bolt, GitBranch, Link2,
} from 'lucide-react'
import type { NavSection } from './types'

/** Every section that can be toggled on/off (Settings is always visible). */
export type ModuleKey = Exclude<NavSection, 'settings'>

export interface ModuleDef {
  key:         ModuleKey
  label:       string
  description: string
  icon:        LucideIcon
  /** Tailwind text color for the icon when active */
  iconColor:   string
  /** Tailwind bg color for the icon swatch in the settings card */
  swatchBg:    string
  /** If true the user cannot disable this module */
  core:        boolean
  group:       'Workspace' | 'Reports' | 'Project'
}

export const MODULE_DEFS: ModuleDef[] = [
  // ── Workspace ──────────────────────────────────────────────────────────────
  {
    key:         'focus',
    label:       'Focus Mode',
    description: 'Pin tasks to a distraction-free view and track what you\'re working on right now.',
    icon:        Target,
    iconColor:   'text-amber-400',
    swatchBg:    'bg-amber-500/20',
    core:        false,
    group:       'Workspace',
  },
  {
    key:         'inbox',
    label:       'Inbox',
    description: 'Centralised feed of notifications from Jira, GitLab, and other integrations.',
    icon:        Inbox,
    iconColor:   'text-blue-400',
    swatchBg:    'bg-blue-500/20',
    core:        true,   // always visible
    group:       'Workspace',
  },
  {
    key:         'tasks',
    label:       'Tasks',
    description: 'Full task board — create, prioritise, and track tasks across all your projects.',
    icon:        CheckSquare,
    iconColor:   'text-blue-400',
    swatchBg:    'bg-blue-500/20',
    core:        false,
    group:       'Workspace',
  },
  {
    key:         'notes',
    label:       'Notes',
    description: 'Capture meeting notes and extract action items into tasks with one click.',
    icon:        NotebookPen,
    iconColor:   'text-emerald-400',
    swatchBg:    'bg-emerald-500/20',
    core:        false,
    group:       'Workspace',
  },
  {
    key:         'debt',
    label:       'Tech Debt',
    description: 'Log, categorise, and prioritise technical debt items and convert them to tasks.',
    icon:        Wrench,
    iconColor:   'text-rose-400',
    swatchBg:    'bg-rose-500/20',
    core:        false,
    group:       'Workspace',
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  {
    key:         'standup',
    label:       'Standup',
    description: 'Auto-generate your daily standup from completed and in-progress tasks.',
    icon:        ClipboardList,
    iconColor:   'text-sky-400',
    swatchBg:    'bg-sky-500/20',
    core:        false,
    group:       'Reports',
  },
  {
    key:         'milestones',
    label:       'Milestones',
    description: 'Track project milestones with progress bars, due dates, and linked tasks.',
    icon:        Flag,
    iconColor:   'text-indigo-400',
    swatchBg:    'bg-indigo-500/20',
    core:        false,
    group:       'Reports',
  },
  {
    key:         'digest',
    label:       'Weekly Digest',
    description: 'Auto-generated weekly summary with stats, velocity, and export to Markdown.',
    icon:        BarChart3,
    iconColor:   'text-cyan-400',
    swatchBg:    'bg-cyan-500/20',
    core:        false,
    group:       'Reports',
  },

  // ── Project ────────────────────────────────────────────────────────────────
  {
    key:         'ai',
    label:       'AI Assistant',
    description: 'Gemini-powered chat, standup drafts, weekly narrative, and task suggestions.',
    icon:        Sparkles,
    iconColor:   'text-violet-400',
    swatchBg:    'bg-violet-500/20',
    core:        false,
    group:       'Project',
  },
  {
    key:         'quick-actions',
    label:       'Quick Actions',
    description: 'Customisable shortcuts to fire off common workflows without navigating.',
    icon:        Bolt,
    iconColor:   'text-blue-400',
    swatchBg:    'bg-blue-500/20',
    core:        false,
    group:       'Project',
  },
  {
    key:         'repositories',
    label:       'Repositories',
    description: 'Link and monitor Git repositories — branches, commits, and build status.',
    icon:        GitBranch,
    iconColor:   'text-blue-400',
    swatchBg:    'bg-blue-500/20',
    core:        false,
    group:       'Project',
  },
  {
    key:         'integrations',
    label:       'Integrations',
    description: 'Configure Jira, GitLab, and other external service connections.',
    icon:        Link2,
    iconColor:   'text-blue-400',
    swatchBg:    'bg-blue-500/20',
    core:        true,   // always visible — needed to set up connections
    group:       'Project',
  },
]

/** Default state: every module enabled */
export function defaultEnabledModules(): Record<ModuleKey, boolean> {
  return Object.fromEntries(MODULE_DEFS.map(m => [m.key, true])) as Record<ModuleKey, boolean>
}
