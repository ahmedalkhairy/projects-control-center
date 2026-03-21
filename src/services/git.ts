/**
 * Real GitHub & GitLab API client.
 * Uses fetch directly — GitHub allows CORS with Authorization header.
 * For self-hosted GitLab, may need proxy if CORS is restricted.
 */

import type { GitEvent, GitEventStatus, GitRepo } from '../types'
import { generateId } from '../utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  ok:           boolean
  error?:       string
  openPRs?:     number
  openIssues?:  number
  pipelineStatus?: GitEventStatus
  events?:      GitEvent[]
  stars?:       number
  description?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ghHeaders(token?: string): HeadersInit {
  const h: HeadersInit = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

function glHeaders(token?: string): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function ghFetch(path: string, token?: string) {
  const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders(token) })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
  return res.json()
}

async function glFetch(base: string, path: string, token?: string) {
  const res = await fetch(`${base}/api/v4${path}`, { headers: glHeaders(token) })
  if (!res.ok) throw new Error(`GitLab API ${res.status}: ${res.statusText}`)
  return res.json()
}

/** Extracts "owner/repo" from either "owner/repo" or a full GitHub URL. */
function ghRepoPath(nameOrUrl: string): string {
  try {
    const url = new URL(nameOrUrl)
    // e.g. https://github.com/owner/repo → "/owner/repo" → "owner/repo"
    return url.pathname.replace(/^\//, '').replace(/\.git$/, '')
  } catch {
    // Already in "owner/repo" format
    return nameOrUrl.replace(/\.git$/, '')
  }
}

function mapGhPipelineStatus(conclusion: string | null, status: string): GitEventStatus {
  if (status === 'in_progress' || status === 'queued') return 'running'
  if (conclusion === 'success') return 'success'
  if (conclusion === 'failure' || conclusion === 'timed_out') return 'failed'
  if (conclusion === 'cancelled') return 'cancelled'
  return 'pending'
}

function mapGlPipelineStatus(status: string): GitEventStatus {
  if (status === 'success' || status === 'passed') return 'success'
  if (status === 'failed') return 'failed'
  if (status === 'running') return 'running'
  if (status === 'pending' || status === 'waiting_for_resource') return 'pending'
  if (status === 'canceled') return 'cancelled'
  return 'pending'
}

// ─── GitHub Sync ──────────────────────────────────────────────────────────────

export async function syncGitHubRepo(repo: GitRepo): Promise<SyncResult> {
  try {
    const repoPath    = ghRepoPath(repo.name || repo.url)
    const { token, defaultBranch, id: repoId } = repo

    // Parallel fetches
    const [repoData, prsData, issuesData, commitsData, runsData, releasesData] = await Promise.allSettled([
      ghFetch(`/repos/${repoPath}`, token),
      ghFetch(`/repos/${repoPath}/pulls?state=open&per_page=100`, token),
      ghFetch(`/repos/${repoPath}/issues?state=open&per_page=100`, token),
      ghFetch(`/repos/${repoPath}/commits?per_page=15&sha=${defaultBranch}`, token),
      ghFetch(`/repos/${repoPath}/actions/runs?per_page=1&branch=${defaultBranch}`, token),
      ghFetch(`/repos/${repoPath}/releases?per_page=5`, token),
    ])

    const info      = repoData.status      === 'fulfilled' ? repoData.value      : null
    const prs       = prsData.status       === 'fulfilled' ? prsData.value       : []
    const allIssues = issuesData.status    === 'fulfilled' ? issuesData.value     : []
    const commits   = commitsData.status   === 'fulfilled' ? commitsData.value    : []
    const runs      = runsData.status      === 'fulfilled' ? runsData.value       : null
    const releases  = releasesData.status  === 'fulfilled' ? releasesData.value   : []

    // Filter real issues (exclude PRs from issues endpoint)
    const issues = Array.isArray(allIssues)
      ? allIssues.filter((i: any) => !i.pull_request)
      : []

    // Pipeline status
    const latestRun = runs?.workflow_runs?.[0]
    const pipelineStatus: GitEventStatus | undefined = latestRun
      ? mapGhPipelineStatus(latestRun.conclusion, latestRun.status)
      : undefined

    // Build events list
    const events: GitEvent[] = []

    // Pipeline run
    if (latestRun) {
      events.push({
        id:        `${repoId}-pipeline-${latestRun.id}`,
        repoId,
        type:      'pipeline',
        title:     latestRun.name ?? 'CI run',
        author:    latestRun.actor?.login ?? 'unknown',
        timestamp: latestRun.updated_at ?? latestRun.created_at,
        url:       latestRun.html_url,
        status:    pipelineStatus,
        branch:    latestRun.head_branch,
      })
    }

    // Recent commits (pushes)
    for (const c of (commits as any[]).slice(0, 8)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'push',
        title:     c.commit?.message?.split('\n')[0] ?? 'commit',
        author:    c.author?.login ?? c.commit?.author?.name ?? 'unknown',
        timestamp: c.commit?.author?.date ?? new Date().toISOString(),
        url:       c.html_url,
        branch:    defaultBranch,
        sha:       c.sha?.slice(0, 7),
      })
    }

    // Recent open PRs
    for (const pr of (prs as any[]).slice(0, 5)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'pull_request',
        title:     pr.title,
        author:    pr.user?.login ?? 'unknown',
        timestamp: pr.updated_at,
        url:       pr.html_url,
        status:    pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
        branch:    pr.head?.ref,
        number:    pr.number,
      })
    }

    // Recent issues
    for (const iss of (issues as any[]).slice(0, 5)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'issue',
        title:     iss.title,
        author:    iss.user?.login ?? 'unknown',
        timestamp: iss.updated_at,
        url:       iss.html_url,
        status:    iss.state === 'open' ? 'open' : 'closed',
        number:    iss.number,
      })
    }

    // Releases
    for (const rel of (releases as any[]).slice(0, 3)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'release',
        title:     rel.name ?? rel.tag_name,
        author:    rel.author?.login ?? 'unknown',
        timestamp: rel.published_at ?? rel.created_at,
        url:       rel.html_url,
      })
    }

    // Sort all events newest first
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return {
      ok:             true,
      openPRs:        Array.isArray(prs) ? prs.length : 0,
      openIssues:     issues.length,
      pipelineStatus,
      events:         events.slice(0, 25),
      stars:          info?.stargazers_count,
      description:    info?.description ?? undefined,
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// ─── GitLab Sync ──────────────────────────────────────────────────────────────

export async function syncGitLabRepo(repo: GitRepo): Promise<SyncResult> {
  try {
    const base    = (repo.apiUrl ?? 'https://gitlab.com').replace(/\/$/, '')
    const repoName = (() => {
      try { return new URL(repo.name || repo.url).pathname.replace(/^\//, '').replace(/\.git$/, '') }
      catch { return (repo.name || '').replace(/\.git$/, '') }
    })()
    const encoded = encodeURIComponent(repoName)
    const { token, defaultBranch, id: repoId } = repo

    const [projectData, mrsData, issuesData, commitsData, pipelinesData, releasesData] = await Promise.allSettled([
      glFetch(base, `/projects/${encoded}`, token),
      glFetch(base, `/projects/${encoded}/merge_requests?state=opened&per_page=100`, token),
      glFetch(base, `/projects/${encoded}/issues?state=opened&per_page=100`, token),
      glFetch(base, `/projects/${encoded}/repository/commits?per_page=15&ref_name=${defaultBranch}`, token),
      glFetch(base, `/projects/${encoded}/pipelines?per_page=1&ref=${defaultBranch}`, token),
      glFetch(base, `/projects/${encoded}/releases?per_page=5`, token),
    ])

    const info      = projectData.status    === 'fulfilled' ? projectData.value    : null
    const mrs       = mrsData.status        === 'fulfilled' ? mrsData.value        : []
    const issues    = issuesData.status     === 'fulfilled' ? issuesData.value     : []
    const commits   = commitsData.status    === 'fulfilled' ? commitsData.value    : []
    const pipelines = pipelinesData.status  === 'fulfilled' ? pipelinesData.value  : []
    const releases  = releasesData.status   === 'fulfilled' ? releasesData.value   : []

    const latestPipeline = Array.isArray(pipelines) ? pipelines[0] : null
    const pipelineStatus: GitEventStatus | undefined = latestPipeline
      ? mapGlPipelineStatus(latestPipeline.status)
      : undefined

    const events: GitEvent[] = []

    // Pipeline
    if (latestPipeline) {
      events.push({
        id:        `${repoId}-pipeline-${latestPipeline.id}`,
        repoId,
        type:      'pipeline',
        title:     `Pipeline #${latestPipeline.id}`,
        author:    latestPipeline.user?.username ?? 'unknown',
        timestamp: latestPipeline.updated_at ?? latestPipeline.created_at,
        url:       latestPipeline.web_url,
        status:    pipelineStatus,
        branch:    latestPipeline.ref,
      })
    }

    // Commits
    for (const c of (commits as any[]).slice(0, 8)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'push',
        title:     c.title ?? c.message?.split('\n')[0] ?? 'commit',
        author:    c.author_name ?? 'unknown',
        timestamp: c.authored_date ?? c.created_at,
        url:       c.web_url,
        branch:    defaultBranch,
        sha:       c.short_id ?? c.id?.slice(0, 7),
      })
    }

    // Merge requests
    for (const mr of (mrs as any[]).slice(0, 5)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'merge_request',
        title:     mr.title,
        author:    mr.author?.username ?? 'unknown',
        timestamp: mr.updated_at,
        url:       mr.web_url,
        status:    mr.state === 'merged' ? 'merged' : mr.state === 'closed' ? 'closed' : 'open',
        branch:    mr.source_branch,
        number:    mr.iid,
      })
    }

    // Issues
    for (const iss of (issues as any[]).slice(0, 5)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'issue',
        title:     iss.title,
        author:    iss.author?.username ?? 'unknown',
        timestamp: iss.updated_at,
        url:       iss.web_url,
        status:    iss.state === 'opened' ? 'open' : 'closed',
        number:    iss.iid,
      })
    }

    // Releases
    for (const rel of (releases as any[]).slice(0, 3)) {
      events.push({
        id:        generateId(),
        repoId,
        type:      'release',
        title:     rel.name ?? rel.tag_name,
        author:    rel.author?.username ?? 'unknown',
        timestamp: rel.released_at ?? rel.created_at,
        url:       rel._links?.self ?? '',
      })
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return {
      ok:             true,
      openPRs:        Array.isArray(mrs) ? mrs.length : 0,
      openIssues:     Array.isArray(issues) ? issues.length : 0,
      pipelineStatus,
      events:         events.slice(0, 25),
      stars:          info?.star_count,
      description:    info?.description ?? undefined,
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function syncRepo(repo: GitRepo): Promise<SyncResult> {
  return repo.provider === 'github'
    ? syncGitHubRepo(repo)
    : syncGitLabRepo(repo)
}
