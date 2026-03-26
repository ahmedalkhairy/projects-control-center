/**
 * GitLab HTTP client for the Electron main process.
 * Runs in Node.js — no CORS, no proxy needed.
 * Supports self-signed certificates (self-hosted GitLab).
 */

import https from 'https'
import http from 'http'
import { URL } from 'url'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitLabConfig {
  instanceUrl: string
  projectPath: string
  token: string
}

export interface TestResult {
  ok: boolean
  displayName?: string
  error?: string
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRequest(url: string, hdrs: Record<string, string>): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const lib     = isHttps ? https : http

    const req = lib.request(
      {
        hostname:           parsed.hostname,
        port:               parsed.port || (isHttps ? 443 : 80),
        path:               parsed.pathname + parsed.search,
        method:             'GET',
        headers:            hdrs,
        rejectUnauthorized: false, // allow self-signed certs on self-hosted instances
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
        res.on('end', () => {
          try   { resolve({ status: res.statusCode ?? 200, data: JSON.parse(raw) }) }
          catch { resolve({ status: res.statusCode ?? 200, data: raw }) }
        })
      },
    )

    req.on('error', reject)
    req.end()
  })
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function baseUrl(cfg: GitLabConfig): string {
  return (cfg.instanceUrl ?? 'https://gitlab.com').replace(/\/$/, '')
}

function encodedPath(cfg: GitLabConfig): string {
  return encodeURIComponent((cfg.projectPath ?? '').replace(/^\//, ''))
}

function authHeaders(cfg: GitLabConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept:        'application/json',
  }
}

/** Promisified PUT request with JSON body. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePutRequest(url: string, hdrs: Record<string, string>, body: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const lib     = isHttps ? https : http
    const buf     = Buffer.from(body, 'utf-8')

    const req = lib.request(
      {
        hostname:           parsed.hostname,
        port:               parsed.port || (isHttps ? 443 : 80),
        path:               parsed.pathname + parsed.search,
        method:             'PUT',
        headers:            { ...hdrs, 'Content-Type': 'application/json', 'Content-Length': buf.length },
        rejectUnauthorized: false,
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
        res.on('end', () => {
          try   { resolve({ status: res.statusCode ?? 200, data: JSON.parse(raw) }) }
          catch { resolve({ status: res.statusCode ?? 200, data: raw }) }
        })
      },
    )
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function testGitLabConnectionNode(cfg: GitLabConfig): Promise<TestResult> {
  try {
    const { status, data } = await makeRequest(`${baseUrl(cfg)}/api/v4/user`, authHeaders(cfg))
    if (status < 200 || status >= 300) return { ok: false, error: data?.message ?? `HTTP ${status}` }
    return { ok: true, displayName: data?.name ?? data?.username }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function fetchGitLabIssuesNode(
  cfg: GitLabConfig,
  maxResults = 100,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ ok: boolean; issues?: any[]; error?: string }> {
  try {
    const params = new URLSearchParams({
      state:          'opened',
      assigned_to_me: 'true',
      per_page:       String(maxResults),
      order_by:       'updated_at',
      sort:           'desc',
    })
    const url = `${baseUrl(cfg)}/api/v4/projects/${encodedPath(cfg)}/issues?${params}`
    const { status, data } = await makeRequest(url, authHeaders(cfg))
    if (status < 200 || status >= 300) return { ok: false, error: data?.message ?? `HTTP ${status}` }
    return { ok: true, issues: Array.isArray(data) ? data : [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function fetchGitLabNotificationsNode(
  cfg: GitLabConfig,
  maxResults = 50,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ ok: boolean; issues?: any[]; error?: string }> {
  try {
    const since  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const params = new URLSearchParams({
      state:         'opened',
      updated_after: since,
      per_page:      String(maxResults),
      order_by:      'updated_at',
      sort:          'desc',
    })
    const url = `${baseUrl(cfg)}/api/v4/projects/${encodedPath(cfg)}/issues?${params}`
    const { status, data } = await makeRequest(url, authHeaders(cfg))
    if (status < 200 || status >= 300) return { ok: false, error: data?.message ?? `HTTP ${status}` }
    return { ok: true, issues: Array.isArray(data) ? data : [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Push a status change to GitLab by opening or closing the issue.
 * stateEvent: 'close' (→ done) | 'reopen' (→ todo / in-progress)
 */
export async function updateGitLabIssueStatusNode(
  cfg:        GitLabConfig,
  iid:        number,
  stateEvent: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${baseUrl(cfg)}/api/v4/projects/${encodedPath(cfg)}/issues/${iid}`
    const { status, data } = await makePutRequest(url, authHeaders(cfg), JSON.stringify({ state_event: stateEvent }))
    if (status < 200 || status >= 300) return { ok: false, error: data?.message ?? `HTTP ${status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
