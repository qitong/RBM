import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { useState, type ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

type Rule = {
  configVersion?: string
  metric: string
  unit: string
  warningThreshold: number
  actionThreshold: number
  thresholdId?: string
}

function ruleFor(body: Record<string, unknown>, version: string, studyId: string, metric: string): Rule {
  const data = body.data as { versions: Array<{ configVersion: string; studyId: string; rules: Rule[] }> }
  const found = data.versions.find((item) => item.configVersion === version && item.studyId === studyId)
  if (!found) throw new Error(`missing ${version} for ${studyId}`)
  const rule = found.rules.find((item) => item.metric === metric)
  if (!rule) throw new Error(`missing ${metric}`)
  return rule
}

function expectLine(scope: ParentNode, id: string, traceable: boolean, rule?: Rule) {
  const line = scope.querySelector(`[data-bound-threshold="${id}"]`) as HTMLElement | null
  expect(line).toBeTruthy()
  expect(line).toHaveAttribute('data-traceable', traceable ? 'true' : 'false')
  if (!traceable || !rule) {
    expect(line).toHaveTextContent('无法溯源')
    expect(line).not.toHaveAttribute('data-warning')
    expect(line).not.toHaveAttribute('data-unit')
    return
  }
  expect(line).toHaveAttribute('data-config-version', 'v1')
  expect(line).toHaveAttribute('data-unit', rule.unit)
  expect(line).toHaveAttribute('data-warning', String(rule.warningThreshold))
  expect(line).toHaveAttribute('data-action', String(rule.actionThreshold))
  expect(line).toHaveTextContent(
    `阈值版本 v1 · 单位 ${rule.unit} · 预警界限 ${rule.warningThreshold} · 行动界限 ${rule.actionThreshold}`,
  )
}

describe('synthetic risk shows its bound historical threshold', () => {
  let port = 0
  let proc: ChildProcess | null = null

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

  it('matches the version record, and refuses a missing version or another study', async () => {
    const started = await startApi()
    port = started.port
    proc = started.proc

    const thresholds = await send(port, 'GET', '/api/rbqm/thresholds')
    const rule = ruleFor(thresholds, 'v1', 'SYN-STUDY-001', 'informed_consent_sd')
    const detail = await send(port, 'GET', '/api/rbqm/risks/RSK-KRI-101')
    const bound = (detail.data as { boundThreshold: Record<string, unknown> }).boundThreshold
    expect(bound).toMatchObject({
      traceable: true,
      configVersion: 'v1',
      studyId: 'SYN-STUDY-001',
      unit: rule.unit,
      warningThreshold: rule.warningThreshold,
      actionThreshold: rule.actionThreshold,
      thresholdId: rule.thresholdId,
    })

    for (const id of ['RSK-KRI-MISSING', 'RSK-KRI-WRONG-STUDY']) {
      const body = await send(port, 'GET', `/api/rbqm/risks/${id}`)
      expect((body.data as { boundThreshold: unknown }).boundThreshold).toEqual({
        traceable: false,
        label: '无法溯源',
      })
    }

    render(<Harness><AlertTracking /></Harness>)
    const positive = await waitFor(() => {
      const node = document.querySelector('[data-alert-id="RSK-KRI-101"]')
      expect(node).toBeTruthy()
      return node as HTMLElement
    })
    expectLine(positive, 'RSK-KRI-101', true, rule)
    fireEvent.click(within(positive).getByRole('button', { name: '填写人工研判' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expectLine(dialog, 'RSK-KRI-101', true, rule))
    fireEvent.click(within(dialog).getByRole('button', { name: '返回' }))

    for (const id of ['RSK-KRI-MISSING', 'RSK-KRI-WRONG-STUDY']) {
      const card = document.querySelector(`[data-alert-id="${id}"]`) as HTMLElement
      expectLine(card, id, false)
      expect(card.textContent).not.toContain('预警界限')
      expect(card.textContent).not.toContain('8')
      expect(card.textContent).not.toContain('9')
      fireEvent.click(within(card).getByRole('button', { name: '填写人工研判' }))
      const opened = await screen.findByRole('dialog')
      await waitFor(() => expectLine(opened, id, false))
      expect(opened.textContent).not.toContain('预警界限')
      fireEvent.click(within(opened).getByRole('button', { name: '返回' }))
    }

    const saved = await send(port, 'POST', '/api/rbqm/thresholds', {
      operator: '合成质量员甲',
      rules: [{
        scope: 'site_kri',
        ctqId: 'CTQ-ICF',
        metric: 'informed_consent_sd',
        dimension: 'INFORMED CONSENT',
        unit: 'SD',
        warningThreshold: 1.25,
        actionThreshold: 4.5,
        weight: 0.25,
        rationale: '合成新版本，不应覆盖已绑定的历史界限。',
      }],
    })
    expect(saved.configVersion).toBe('v2')
    const again = await send(port, 'GET', '/api/rbqm/risks/RSK-KRI-101')
    expect(again.configVersion).toBe('v2')
    expect((again.data as { boundThreshold: Record<string, unknown> }).boundThreshold).toMatchObject({
      traceable: true,
      configVersion: 'v1',
      unit: rule.unit,
      warningThreshold: rule.warningThreshold,
      actionThreshold: rule.actionThreshold,
    })
    const stillMissing = await send(port, 'GET', '/api/rbqm/risks/RSK-KRI-MISSING')
    expect((stillMissing.data as { boundThreshold: unknown }).boundThreshold).toEqual({
      traceable: false,
      label: '无法溯源',
    })

    cleanup()
    render(<Harness><AlertTracking /></Harness>)
    const rebound = await waitFor(() => {
      const node = document.querySelector('[data-alert-id="RSK-KRI-101"]')
      expect(node).toBeTruthy()
      return node as HTMLElement
    })
    expectLine(rebound, 'RSK-KRI-101', true, rule)
    expect(rebound.textContent).not.toContain('1.25')
    expect(rebound.textContent).not.toContain('4.5')
    expect(rebound.textContent).not.toContain('v2')
  }, 20000)
})
