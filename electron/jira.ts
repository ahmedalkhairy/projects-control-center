/**
 * Jira HTTP client for the Electron main process.
 * Runs in Node.js — no CORS, no proxy needed.
 * Supports self-signed certificates (self-hosted Jira).
 */

import https from 'https'
import http from 'http'
import { URL } from 'url'

// ─── Types (duplicated to avoid importing renderer code in main process) ──────

export interface JiraConfig {
  serverUrl:  string
  projectKey: string
  username:   string
  apiToken:   string
}

export interface TestResult {
  ok:           boolean
  displayName?: string
  error?:       string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) return 'https://' + u
  return u
}

function isCloud(serverUrl: string): boolean {
  return /atlassian\.net/i.test(serverUrl)
}

function apiBase(cfg: JiraConfig): string {
  return isCloud(cfg.serverUrl) ? '/rest/api/3' : '/rest/api/2'
}

function authHeader(cfg: JiraConfig): string {
  return 'Basic ' + Buffer.from(`${cfg.username}:${cfg.apiToken}`).toString('base64')
}

interface RequestOptions {
  method?:  string
  headers:  Record<string, string>
  body?:    string
}

interface RequestResult {
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data:   any
}

/** Promisified Node.js HTTP/HTTPS request with self-signed cert support. */
function makeRequest(url: string, opts: RequestOptions): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const lib     = isHttps ? https : http

    const req = lib.request(
      {
        hostname:           parsed.hostname,
        port:               parsed.port || (isHttps ? 443 : 80),
        path:               parsed.pathname + parsed.search,
        method:             opts.method ?? 'GET',
        headers:            opts.headers,
        rejectUnauthorized: false, // allow self-signed certs on self-hosted instances
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 200, data: JSON.parse(raw) })
          } catch {
            resolve({ status: res.statusCode ?? 200, data: raw })
          }
        })
      }
    )

    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function testJiraConnectionNode(cfg: JiraConfig): Promise<TestResult> {
  try {
    const base = normalizeUrl(cfg.serverUrl)
    const url  = `${base}${apiBase(cfg)}/myself`

    const { status, data } = await makeRequest(url, {
      headers: {
        'Authorization': authHeader(cfg),
        'Accept':        'application/json',
      },
    })

    if (status < 200 || status >= 300) {
      const message = data?.errorMessages?.[0] ?? data?.message ?? `HTTP ${status}`
      return { ok: false, error: message }
    }

    return { ok: true, displayName: data?.displayName ?? data?.name }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function fetchJiraNotificationsNode(
  cfg:        JiraConfig,
  maxResults = 50,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ ok: boolean; issues?: any[]; error?: string }> {
  try {
    const base   = normalizeUrl(cfg.serverUrl)
    const jql    = `project = "${cfg.projectKey}" AND updated >= -7d ORDER BY updated DESC`
    const fields = ['summary', 'status', 'priority', 'issuetype', 'assignee', 'reporter', 'updated', 'labels']

    let result: RequestResult

    if (isCloud(cfg.serverUrl)) {
      result = await makeRequest(`${base}${apiBase(cfg)}/search/jql`, {
        method:  'POST',
        headers: {
          'Authorization': authHeader(cfg),
          'Accept':        'application/json',
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ jql, maxResults, fields }),
      })
    } else {
      const params = new URLSearchParams({ jql, maxResults: String(maxResults), fields: fields.join(',') })
      result = await makeRequest(`${base}${apiBase(cfg)}/search?${params}`, {
        headers: {
          'Authorization': authHeader(cfg),
          'Accept':        'application/json',
        },
      })
    }

    const { status, data } = result

    if (status < 200 || status >= 300) {
      const message = data?.errorMessages?.[0] ?? data?.message ?? `HTTP ${status}`
      return { ok: false, error: message }
    }

    return { ok: true, issues: data?.issues ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function createJiraIssueNode(
  cfg:     JiraConfig,
  summary: string,
  description: string,
  priority: string,   // 'Low' | 'Medium' | 'High' | 'Critical'
): Promise<{ ok: boolean; key?: string; id?: string; error?: string }> {
  try {
    const base = normalizeUrl(cfg.serverUrl)
    const cloud = isCloud(cfg.serverUrl)

    const body: Record<string, unknown> = {
      fields: {
        project:     { key: cfg.projectKey },
        summary,
        issuetype:   { name: 'Task' },
        priority:    { name: priority },
        ...(description
          ? cloud
            // Cloud (API v3) uses Atlassian Document Format
            ? { description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] } }
            // Server (API v2) uses plain text
            : { description }
          : {}),
      },
    }

    const { status, data } = await makeRequest(`${base}${apiBase(cfg)}/issue`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(cfg),
        'Accept':        'application/json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    })

    if (status < 200 || status >= 300) {
      const message = data?.errors
        ? Object.values(data.errors).join(', ')
        : data?.errorMessages?.[0] ?? data?.message ?? `HTTP ${status}`
      return { ok: false, error: message }
    }

    return { ok: true, key: data.key, id: data.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function fetchJiraIssuesAsTasksNode(
  cfg:       JiraConfig,
  projectId: string,
  maxResults = 100,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ ok: boolean; tasks?: any[]; error?: string }> {
  try {
    const base   = normalizeUrl(cfg.serverUrl)
    const jql    = `project = "${cfg.projectKey}" AND assignee = currentUser() ORDER BY updated DESC`
    const fields = ['summary', 'description', 'status', 'priority', 'issuetype', 'labels', 'created', 'updated']

    let result: RequestResult

    if (isCloud(cfg.serverUrl)) {
      // Cloud: POST /rest/api/3/search/jql
      result = await makeRequest(`${base}${apiBase(cfg)}/search/jql`, {
        method:  'POST',
        headers: {
          'Authorization': authHeader(cfg),
          'Accept':        'application/json',
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ jql, maxResults, fields }),
      })
    } else {
      // Server/DC: GET /rest/api/2/search
      const params = new URLSearchParams({ jql, maxResults: String(maxResults), fields: fields.join(',') })
      result = await makeRequest(`${base}${apiBase(cfg)}/search?${params}`, {
        headers: {
          'Authorization': authHeader(cfg),
          'Accept':        'application/json',
        },
      })
    }

    const { status, data } = result

    if (status < 200 || status >= 300) {
      const message = data?.errorMessages?.[0] ?? data?.message ?? `HTTP ${status}`
      return { ok: false, error: message }
    }

    // Map Jira issues → Task-shaped objects (mapping done in renderer store)
    return { ok: true, tasks: data?.issues ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
