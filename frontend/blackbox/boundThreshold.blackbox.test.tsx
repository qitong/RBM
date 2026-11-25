import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { useState, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../src/context/ThresholdContext'
import AlertTracking from '../src/components/AlertTracking'

const REPO = path.resolve(import.meta.dirname, '../..')
const BACKEND = path.join(REPO, 'backend')
const nativeFetch = globalThis.fetch.bind(globalThis)

type Rule = {
  metric: string
  unit: string
  warningThreshold: number
  actionThreshold: number
}

type VersionRecord = {
  configVersion: string
  studyId: string
  rules: Rule[]
}

type BoundThreshold = {
  traceable: boolean
  traceLabel?: string
  configVersion?: string
  studyId?: string
  unit?: string
  warningThreshold?: number
  actionThreshold?: number
}

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

function versionRule(versions: VersionRecord[], configVersion: string, studyId: string, metric: string): Rule {
  const version = versions.find((item) => item.configVersion === configVersion && item.studyId === studyId)
  if (!version) throw new Error(`missing ${configVersion} for ${studyId}`)
  const rule = version.rules.find((item) => item.metric === metric)
  if (!rule) throw new Error(`missing ${metric} on ${configVersion}`)
  return rule
}

function boundPhrase(rule: Rule, configVersion: string): string {
  return `已绑定历史阈值 ${configVersion} · 单位 ${rule.unit} · 预警 ${rule.warningThreshold} · 行动 ${rule.actionThreshold}`
}

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

describe('bound historical threshold through the public API and page', () => {
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
    proc?.kill()
    vi.unstubAllGlobals()
  })

  it('shows the bound version and refuses a missing or cross-study version', async () => {
    const started = await startApi()
    port = started.port
    proc = started.proc

    const before = await send(port, 'GET', '/api/rbqm/thresholds')
    const versions = (before.data as { versions: VersionRecord[] }).versions
    const historical = versionRule(versions, 'v1', 'SYN-STUDY-001', 'informed_consent_sd')
    const foreign = versionRule(versions, 'v-foreign', 'SYN-STUDY-009', 'informed_consent_sd')
    expect(historical).toMatchObject({ unit: 'SD', warningThreshold: 2, actionThreshold: 3 })
    expect(foreign).toMatchObject({ unit: 'SD', warningThreshold: 8.5, actionThreshold: 9.5 })

    const saved = await send(port, 'POST', '/api/rbqm/thresholds', {
      operator: '合成质量员甲',
      rules: [{
        scope: 'site_kri',
        ctqId: 'CTQ-ICF',
        metric: 'informed_consent_sd',
        dimension: 'INFORMED CONSENT',
        unit: 'fold',
        warningThreshold: 1.25,
        actionThreshold: 6.5,
        weight: 0.25,
        rationale: '合成的当前版本，不能回写已经绑定的信号。',
      }],
    })
    expect(saved.configVersion).toBe('v2')

    const detail = await send(port, 'GET', '/api/rbqm/risks/RSK-KRI-101')
    const listed = await send(port, 'GET', '/api/rbqm/risks')
    const risk = (detail.data as { risk: { boundThreshold: BoundThreshold; status: string } }).risk
    const fromList = ((listed.data as Array<{ id: string; boundThreshold: BoundThreshold }>))
      .find((item) => item.id === 'RSK-KRI-101')
    expect(fromList?.boundThreshold).toEqual(risk.boundThreshold)
    expect(risk.status).toBe('Detected')
    expect(risk.boundThreshold).toEqual({
      traceable: true,
      configVersion: 'v1',
      studyId: 'SYN-STUDY-001',
      unit: historical.unit,
      warningThreshold: historical.warningThreshold,
      actionThreshold: historical.actionThreshold,
    })

    for (const id of ['RSK-KRI-20261125-404', 'RSK-KRI-20261125-409']) {
      const body = await send(port, 'GET', `/api/rbqm/risks/${id}`)
      const unbound = (body.data as { risk: { boundThreshold: BoundThreshold } }).risk.boundThreshold
      expect(unbound).toEqual({ traceable: false, traceLabel: '无法溯源' })
    }

    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories: [{
        id: 'INFORMED CONSENT',
        label: '知情同意',
        weight: 0.25,
        warningThreshold: 4.4,
        actionThreshold: 7.7,
        enabled: true,
      }],
      globalWarning: 4.4,
      globalAction: 7.7,
    }))
    render(<Harness><AlertTracking /></Harness>)

    const phrase = boundPhrase(historical, 'v1')
    await waitFor(() => {
      expect(document.querySelector('[data-bound-threshold="RSK-KRI-101"]')).toHaveTextContent(phrase)
    })
    const positiveCard = document.querySelector('[data-alert-id="RSK-KRI-101"]') as HTMLElement
    fireEvent.click(within(positiveCard).getByRole('button', { name: '填写人工研判' }))
    expect(screen.getByRole('dialog').querySelector('[data-bound-threshold="RSK-KRI-101"]')?.textContent).toBe(phrase)

    for (const id of ['RSK-KRI-20261125-404', 'RSK-KRI-20261125-409']) {
      const card = document.querySelector(`[data-alert-id="${id}"]`) as HTMLElement
      expect(card.querySelector(`[data-bound-threshold="${id}"]`)?.textContent).toBe('无法溯源')
      fireEvent.click(within(card).getByRole('button', { name: '填写人工研判' }))
      const dialog = screen.getByRole('dialog')
      const readout = dialog.querySelector(`[data-bound-threshold="${id}"]`)
      expect(readout?.textContent).toBe('无法溯源')
      expect(dialog.textContent).not.toContain('预警')
      expect(dialog.textContent).not.toContain('已绑定历史阈值')
      expect(dialog.textContent).not.toContain('8.5')
      expect(dialog.textContent).not.toContain('9.5')
      expect(dialog.textContent).not.toContain('1.25')
      expect(dialog.textContent).not.toContain('6.5')
      expect(dialog.textContent).not.toContain('4.4')
      expect(dialog.textContent).not.toContain('7.7')
    }
  }, 30000)
})
