import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { useState, type ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../src/context/ThresholdContext'
import AlertTracking from '../src/components/AlertTracking'

const REPO = path.resolve(import.meta.dirname, '../..')
const BACKEND = path.join(REPO, 'backend')
const nativeFetch = globalThis.fetch.bind(globalThis)

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function startApi(): Promise<{ port: number; proc: ChildProcess; planFile: string }> {
  const port = await freePort()
  const planFile = path.join(mkdtempSync(path.join(tmpdir(), 'rbm-bb-')), 'plan.json')
  const venvPython = path.join(BACKEND, '.venv', 'bin', 'python')
  const python = existsSync(venvPython) ? venvPython : 'python3'
  const proc = spawn(
    python,
    ['-m', 'uvicorn', 'src.api.main:app', '--host', '127.0.0.1', '--port', String(port)],
    { cwd: BACKEND, env: { ...process.env, RBM_CTQ_STORE: planFile }, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let log = ''
  proc.stdout?.on('data', (chunk) => { log += chunk.toString() })
  proc.stderr?.on('data', (chunk) => { log += chunk.toString() })
  const started = Date.now()
  while (Date.now() - started < 15000) {
    if (proc.exitCode !== null) throw new Error(`API exited ${proc.exitCode}: ${log}`)
    try {
      const res = await nativeFetch(`http://127.0.0.1:${port}/api/health`)
      if (res.ok) return { port, proc, planFile }
    } catch {
      await delay(100)
    }
  }
  proc.kill()
  throw new Error(`API did not start: ${log}`)
}

async function send(port: number, method: string, pathname: string, body?: unknown) {
  const res = await nativeFetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) as Record<string, unknown> : {}
  return { status: res.status, json }
}

function observation(siteId: string, value: number, observedAt: string) {
  return {
    studyId: 'SYN-STUDY-001',
    siteId,
    metric: 'informed_consent_sd',
    value,
    observedAt,
  }
}

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

describe('repeated synthetic site exceedances through the public API', () => {
  let port = 0
  let proc: ChildProcess | null = null
  let planFile = ''

  beforeAll(() => {
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const url = raw.startsWith('http') ? raw : `http://127.0.0.1:${port}${raw}`
      return nativeFetch(url, init)
    })
  })

  afterAll(() => {
    proc?.kill()
    vi.unstubAllGlobals()
  })

  it('keeps one pending candidate and does not add a study QTL before confirmation', async () => {
    const started = await startApi()
    port = started.port
    proc = started.proc
    planFile = started.planFile

    const risksBefore = await send(port, 'GET', '/api/rbqm/risks')
    const qtlBefore = (risksBefore.json.data as Array<{ id: string; scope: string }>)
      .filter((item) => item.scope === 'study_qtl')
      .map((item) => item.id)
    expect(qtlBefore).toEqual(['RSK-QTL-001'])

    const once = await send(port, 'POST', '/api/rbqm/site-exceedances', {
      operator: '中央监查员-合成',
      observations: [observation('SYN-SITE-101', 3.5, '2026-11-02')],
    })
    expect(once.status).toBe(200)
    expect(once.json.data).toMatchObject({
      createdCandidateIds: [],
      pending: [],
      studyLevel: [],
      studyQtlIds: ['RSK-QTL-001'],
    })

    const replay = await send(port, 'POST', '/api/rbqm/site-exceedances', {
      operator: '中央监查员-合成',
      observations: [
        observation('SYN-SITE-101', 3.5, '2026-11-02'),
        observation('SYN-SITE-101', 3.5, '2026-11-02'),
      ],
    })
    expect(replay.status).toBe(200)
    expect(replay.json.data).toMatchObject({
      createdCandidateIds: [],
      pending: [],
      studyLevel: [],
      studyQtlIds: ['RSK-QTL-001'],
    })

    const twice = await send(port, 'POST', '/api/rbqm/site-exceedances', {
      operator: '中央监查员-合成',
      observations: [
        observation('SYN-SITE-101', 3.6, '2026-11-09'),
        observation('SYN-SITE-101', -3.7, '2026-11-16'),
      ],
    })
    expect(twice.status).toBe(200)
    const pending = twice.json.data as {
      createdCandidateIds: string[]
      pending: Array<{ id: string; exceedanceCount: number; status: string }>
      studyLevel: unknown[]
      studyQtlIds: string[]
    }
    expect(pending.createdCandidateIds).toEqual(['CAND-SYN-SITE-101-informed_consent_sd'])
    expect(pending.pending).toHaveLength(1)
    expect(pending.pending[0]).toMatchObject({
      id: 'CAND-SYN-SITE-101-informed_consent_sd',
      status: 'pending_confirmation',
      exceedanceCount: 3,
    })
    expect(pending.studyLevel).toEqual([])
    expect(pending.studyQtlIds).toEqual(['RSK-QTL-001'])

    const third = await send(port, 'POST', '/api/rbqm/site-exceedances', {
      operator: '中央监查员-合成',
      observations: [observation('SYN-SITE-101', 4, '2026-11-23')],
    })
    const stillOne = third.json.data as { pending: Array<{ exceedanceCount: number }>; studyLevel: unknown[] }
    expect(stillOne.pending).toHaveLength(1)
    expect(stillOne.pending[0].exceedanceCount).toBe(4)
    expect(stillOne.studyLevel).toEqual([])

    const warningOnly = await send(port, 'POST', '/api/rbqm/site-exceedances', {
      operator: '中央监查员-合成',
      observations: [
        observation('SYN-SITE-102', 2.1, '2026-11-02'),
        observation('SYN-SITE-102', 2.4, '2026-11-09'),
      ],
    })
    const ids = (warningOnly.json.data as { pending: Array<{ id: string }> }).pending.map((item) => item.id)
    expect(ids).toEqual(['CAND-SYN-SITE-101-informed_consent_sd'])

    const refused = await send(port, 'POST', '/api/rbqm/risks/RSK-QTL-001/transitions', {
      toStatus: 'Closed',
      operator: '中央监查员-合成',
    })
    expect(refused.status).toBe(422)
    expect(refused.json).toMatchObject({
      code: 'CLOSE_GUARD',
      status: 'Detected',
    })
    expect(new Set(refused.json.missing as string[])).toEqual(new Set(['rootCause', 'assignee', 'effectivenessNote']))

    const risksAfter = await send(port, 'GET', '/api/rbqm/risks')
    const qtlAfter = (risksAfter.json.data as Array<{ id: string; scope: string }>)
      .filter((item) => item.scope === 'study_qtl')
      .map((item) => item.id)
    expect(qtlAfter).toEqual(['RSK-QTL-001'])
    expect(JSON.stringify(risksAfter.json.data)).not.toContain('CAND-SYN-SITE-101')

    render(<Harness><AlertTracking /></Harness>)
    await waitFor(() => expect(document.querySelector('[data-alert-id="RSK-QTL-001"]')).toBeTruthy())
    expect(screen.getAllByText('研究级 QTL')).toHaveLength(1)
    expect(screen.queryByText('CAND-SYN-SITE-101-informed_consent_sd')).toBeNull()
    expect(screen.getByText('重要方案偏离比例')).toBeTruthy()

    if (existsSync(planFile)) {
      expect(readFileSync(planFile, 'utf8')).not.toContain('informed_consent_sd')
    }
  }, 20000)

  it('keeps two nearby exceeding floats as one pending candidate', async () => {
    const started = await startApi()
    try {
      const res = await nativeFetch(`http://127.0.0.1:${started.port}/api/rbqm/site-exceedances`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: '中央监查员-合成',
          observations: [3.000000000001, 3.000000000002].map((value) => ({
            studyId: 'SYN-STUDY-001',
            siteId: 'SYN-SITE-203',
            metric: 'informed_consent_sd',
            value,
            observedAt: '2026-11-02',
          })),
        }),
      })
      const json = await res.json() as {
        data: {
          createdCandidateIds: string[]
          pending: Array<{ exceedanceCount: number }>
          studyLevel: unknown[]
          studyQtlIds: string[]
        }
      }
      expect(res.status).toBe(200)
      expect(json.data.createdCandidateIds).toEqual(['CAND-SYN-SITE-203-informed_consent_sd'])
      expect(json.data.pending).toHaveLength(1)
      expect(json.data.pending[0].exceedanceCount).toBe(2)
      expect(json.data.studyLevel).toEqual([])
      expect(json.data.studyQtlIds).toEqual(['RSK-QTL-001'])
    } finally {
      started.proc.kill()
    }
  }, 20000)
})
