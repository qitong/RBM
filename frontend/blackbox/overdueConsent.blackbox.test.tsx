import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { useState, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../src/context/ThresholdContext'
import OverdueConsentJudgment from '../src/components/OverdueConsentJudgment'
import { judgeOverdueConsentRate, type PercentRuleInput } from '../src/ctq/judgeOverdueConsent'

const REPO = path.resolve(import.meta.dirname, '../..')
const BACKEND = path.join(REPO, 'backend')
const PROTOCOL = readFileSync(
  path.join(BACKEND, 'tests/fixtures/synthetic_mist_protocol.txt'),
  'utf8',
)
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

async function startApi(): Promise<{ port: number; proc: ChildProcess }> {
  const port = await freePort()
  const store = path.join(mkdtempSync(path.join(tmpdir(), 'rbm-bb-')), 'plan.json')
  const venvPython = path.join(BACKEND, '.venv', 'bin', 'python')
  const python = existsSync(venvPython) ? venvPython : 'python3'
  const proc = spawn(
    python,
    ['-m', 'uvicorn', 'src.api.main:app', '--host', '127.0.0.1', '--port', String(port)],
    { cwd: BACKEND, env: { ...process.env, RBM_CTQ_STORE: store }, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let log = ''
  proc.stdout?.on('data', (chunk) => { log += chunk.toString() })
  proc.stderr?.on('data', (chunk) => { log += chunk.toString() })
  const started = Date.now()
  while (Date.now() - started < 15000) {
    if (proc.exitCode !== null) throw new Error(`API exited ${proc.exitCode}: ${log}`)
    try {
      const res = await nativeFetch(`http://127.0.0.1:${port}/api/health`)
      if (res.ok) return { port, proc }
    } catch {
      await delay(100)
    }
  }
  proc.kill()
  throw new Error(`API did not start: ${log}`)
}

function stopApi(proc: ChildProcess) {
  proc.kill()
}

async function send(port: number, method: string, pathname: string, body?: unknown) {
  const res = await nativeFetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) as Record<string, unknown> : {}
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${text}`)
  return json
}

async function approvePercent(port: number, protocol: string) {
  const draft = await send(port, 'POST', '/api/ctq/extract', { protocolText: protocol })
  await send(port, 'POST', `/api/ctq/drafts/${draft.draftId}/approve`, {
    operator: '审阅员-合成甲',
    decisions: [{
      candidateId: 'KRI-01',
      accept: true,
      warningThreshold: 4,
      actionThreshold: 9,
      monitoringMethod: 'CENTRAL_REVIEW',
    }],
  })
}

function ruleFromActive(body: Record<string, unknown>): { rule: PercentRuleInput; studyCode: string } {
  const active = body.active as {
    studyCode: string
    legacyThresholdMap: Array<PercentRuleInput>
  }
  const rule = active.legacyThresholdMap.find((item) => item.candidateId === 'KRI-01')
  if (!rule) throw new Error('approved plan has no KRI-01')
  return { rule, studyCode: active.studyCode }
}

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

describe('synthetic overdue consent through the public API and page', () => {
  let port = 0
  let proc: ChildProcess | null = null

  beforeAll(() => {
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const url = raw.startsWith('http') ? raw : `http://127.0.0.1:${port}${raw}`
      return nativeFetch(url, init)
    })
  })

  afterEach(() => cleanup())

  afterAll(() => {
    if (proc) stopApi(proc)
    vi.unstubAllGlobals()
  })

  async function boot() {
    if (proc) stopApi(proc)
    const started = await startApi()
    port = started.port
    proc = started.proc
  }

  it('fails closed when no plan is approved', async () => {
    await boot()
    const active = await send(port, 'GET', '/api/ctq/active')
    expect(active.active).toBeNull()
    render(<Harness><OverdueConsentJudgment /></Harness>)
    const failure = await screen.findByRole('alert')
    expect(failure).toHaveAttribute('data-judgment', 'failed')
    expect(screen.queryByText(/判断：/)).not.toBeInTheDocument()
  }, 20000)

  it('judges 3.9, 4 and 9 from the approved SYN-FICTION-MIST-001 plan', async () => {
    await boot()
    await approvePercent(port, PROTOCOL)
    const { rule, studyCode } = ruleFromActive(await send(port, 'GET', '/api/ctq/active'))
    expect(studyCode).toBe('SYN-FICTION-MIST-001')
    expect(rule.unit).toBe('百分比')
    expect(judgeOverdueConsentRate(3.9, rule, studyCode)).toMatchObject({ ok: true, level: 'normal' })
    expect(judgeOverdueConsentRate(4, rule, studyCode)).toMatchObject({ ok: true, level: 'warning' })
    expect(judgeOverdueConsentRate(9, rule, studyCode)).toMatchObject({ ok: true, level: 'action' })
    render(<Harness><OverdueConsentJudgment /></Harness>)
    const shown = await screen.findByText(/判断：行动/)
    expect(shown).toHaveAttribute('data-unit', '百分比')
  }, 20000)

  it('does not grade the fixture when the approved plan is another study', async () => {
    await boot()
    const other = PROTOCOL.replace('研究编号：SYN-FICTION-MIST-001', '研究编号：SYN-OTHER-STUDY')
    await approvePercent(port, other)
    const { rule, studyCode } = ruleFromActive(await send(port, 'GET', '/api/ctq/active'))
    expect(studyCode).toBe('SYN-OTHER-STUDY')
    for (const value of [3.9, 4, 9]) {
      expect(judgeOverdueConsentRate(value, rule, studyCode)).toMatchObject({ ok: false, code: 'WRONG_STUDY' })
    }
    render(<Harness><OverdueConsentJudgment /></Harness>)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveAttribute('data-failure', 'WRONG_STUDY'))
    expect(screen.queryByText(/判断：/)).not.toBeInTheDocument()
  }, 20000)
})
