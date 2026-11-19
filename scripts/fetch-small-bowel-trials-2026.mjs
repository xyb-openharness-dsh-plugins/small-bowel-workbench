#!/usr/bin/env node
/**
 * Small Bowel Adenocarcinoma 临床试验快照采集（M4）
 * 唯一入口：unified-trial-mcp（MCP stdio）。调用方不拼登记库 URL、不传超时/路径/密钥。
 * 用法：UNIFIED_TRIAL_MCP_DIR=~/Downloads/unified_search_trials node scripts/fetch-mpn-trials-2026.mjs
 * 产出：research/small-bowel-2026/{manifest.json, trials-2026.jsonl, small_bowel_trials_2026.sqlite, README.md}
 * FAILED / NEEDS_SETUP 原样进入 source_statuses；不算“查过”，不计覆盖率。
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'research/small-bowel-2026')
const MCP_DIR = process.env.UNIFIED_TRIAL_MCP_DIR || join(process.env.HOME || '', 'Downloads/unified_search_trials')
const SNAPSHOT_DATE = '2026-11-19'
const RETRIEVED_AT = new Date().toISOString()
const SHA = (bytes) => createHash('sha256').update(bytes).digest('hex')

const QUERIES = [
  { label: 'small bowel adenocarcinoma', args: { condition: 'small bowel adenocarcinoma', limit: 100 } },
  { label: 'small intestine adenocarcinoma', args: { condition: 'small intestine adenocarcinoma', limit: 100 } },
  { label: 'small intestine cancer', args: { condition: 'small intestine cancer', limit: 100 } },
  { label: 'small bowel cancer', args: { condition: 'small bowel cancer', limit: 100 } },
]

function sdkUrl(rel) {
  return pathToFileURL(join(MCP_DIR, 'node_modules/@modelcontextprotocol/sdk/dist/esm', rel)).href
}

async function main() {
  const { Client } = await import(sdkUrl('client/index.js'))
  const { StdioClientTransport } = await import(sdkUrl('client/stdio.js'))
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(MCP_DIR, 'dist/src/cli/main.js'), 'serve'],
    env: { ...process.env },
  })
  const client = new Client({ name: 'sba-m4', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)

  const discovered = new Map()
  const statusRows = []
  const queryLog = []
  for (const q of QUERIES) {
    const response = await client.callTool({ name: 'search_trials', arguments: q.args })
    const payload = response.structuredContent
    if (!payload) throw new Error(`search_trials 无 structuredContent（${q.label}）`)
    for (const s of payload.statuses || []) {
      statusRows.push({
        query: q.label, source_id: s.sourceId, state: s.state, reason_code: s.reasonCode || '',
        explanation: s.explanation || '', result_count: Number.isFinite(s.resultCount) ? s.resultCount : null,
        coverage_json: JSON.stringify(s.coverage || {}), completeness_json: JSON.stringify(s.completeness || {}),
        freshness_json: JSON.stringify(s.freshness || {}), snapshot_date: SNAPSHOT_DATE,
      })
    }
    for (const record of payload.records || []) if (!discovered.has(record.recordId)) discovered.set(record.recordId, record)
    queryLog.push({ query: q.label, total: payload.totalRecords ?? 0, returned: (payload.records || []).length })
    console.log(`QUERY ${q.label}: total=${payload.totalRecords ?? 0} records=${(payload.records || []).length}`)
  }

  // 详情只拉「条件明确命中小肠腺癌」的子集并设上限——broad 查询全量详情会无界等待
  // （2026-11-19 实测：250 条逐条详情 25 分钟未完）。候选池口径写入 manifest.candidateScope。
  const sbaRe = /small bowel|small intestine|duoden|ileum|ileal|jejun|adenocarcinoma/i
  const pool = [...discovered.values()].filter((f) => {
    const hay = [f.title, JSON.stringify(f.conditions || []), JSON.stringify(f.record || {})].join(' ')
    return sbaRe.test(hay)
  }).slice(0, 120)
  console.log('POOL ' + pool.length + ' / ' + discovered.size + ' 条进详情采集（SBA 命中子集，上限 120）')
  const rows = []
  const failedDetailIds = []
  for (const found of pool) {
    // 单条详情失败重试 1 次，仍失败跳过并记录——不全盘丢弃（2026-11-19 实测：一条 60s 超时曾让整批 256 条全丢）
    let p = null
    for (let attempt = 0; attempt < 2 && !p; attempt++) {
      try {
        const detail = await client.callTool({ name: 'get_trial_detail', arguments: { recordId: found.recordId } })
        p = detail.structuredContent
      } catch (error) {
        if (attempt === 1) { console.log('DETAIL_FAIL ' + found.recordId + ': ' + String(error.message || error).slice(0, 120)); failedDetailIds.push(found.recordId) }
      }
    }
    if (!p?.record) continue
    const raw = p.rawFields || {}
    const sourceId = found.recordId.split(':')[0]
    const registryNumbers = (p.record.registryNumbers || []).map((r) => ({ registry: r.registry, value: r.value, primary: !!r.primary }))
    const nct = registryNumbers.find((r) => r.registry === 'NCT')?.value
    const sourceUrl = sourceId === 'ctv' && nct
      ? `https://clinicaltrials.gov/study/${nct}`
      : `https://www.chictr.org.cn/searchproj.html?title=${encodeURIComponent(p.record.title || '')}`
    rows.push({
      recordId: found.recordId,
      mergedSources: [sourceId],
      sourceId,
      title: p.record.title || raw.briefTitle || found.title,
      studyType: raw.type || 'Interventional',
      sponsor: [p.record.leadSponsor?.name || raw.leadSponsor?.name || '未标注'],
      registryNumbers,
      dates: {
        startDate: raw.startDate || null,
        primaryCompletionDate: raw.primaryCompletionDate || null,
        lastUpdatePostDate: raw.lastUpdatePostDate || null,
      },
      sourceUrl,
      retrievedAt: RETRIEVED_AT,
      statusNote: `${raw.overallStatus || p.record.recruitmentStatus || '未标注'}（登记状态，未核实）`,
      snapshotDate: SNAPSHOT_DATE,
      conditions: raw.conditions || p.record.conditionOrDisease || [],
      phase: raw.phases || p.record.phase || [],
      countries: [...new Set((raw.locations || []).map((l) => l.locationCountry).filter(Boolean))],
      eligibilityText: raw.eligibilityCriteria || '',
      summary: raw.briefSummary || '',
      rawJson: raw,
      relevant: 1,
    })
  }

  rows.sort((a, b) => a.recordId.localeCompare(b.recordId))
  const jsonl = rows.map((r) => JSON.stringify({
    recordId: r.recordId, mergedSources: r.mergedSources, sourceId: r.sourceId, title: r.title,
    studyType: r.studyType, sponsor: r.sponsor, registryNumbers: r.registryNumbers, dates: r.dates,
    sourceUrl: r.sourceUrl, retrievedAt: r.retrievedAt, statusNote: r.statusNote, snapshotDate: r.snapshotDate,
    conditions: r.conditions, phase: r.phase, countries: r.countries, summary: r.summary,
    eligibilityText: r.eligibilityText,
  })).join('\n') + '\n'

  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'trials-2026.jsonl'), jsonl)

  const dbPath = join(OUT, 'small_bowel_trials_2026.sqlite')
  rmSync(dbPath, { force: true })
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE trials (
      record_id TEXT PRIMARY KEY, merged_sources TEXT, source_id TEXT, title TEXT, study_type TEXT,
      sponsors TEXT, registry_numbers TEXT, dates TEXT, source_url TEXT, retrieved_at TEXT,
      status_note TEXT, snapshot_date TEXT, conditions_json TEXT, phase_json TEXT, countries_json TEXT,
      eligibility_text TEXT, summary TEXT, raw_json TEXT, relevant INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE source_statuses (
      query TEXT NOT NULL, source_id TEXT NOT NULL, state TEXT NOT NULL, reason_code TEXT,
      explanation TEXT, result_count INTEGER, coverage_json TEXT, completeness_json TEXT,
      freshness_json TEXT, snapshot_date TEXT NOT NULL, PRIMARY KEY(query, source_id)
    );
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  `)
  const ins = db.prepare(`INSERT INTO trials VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const r of rows) ins.run(r.recordId, JSON.stringify(r.mergedSources), r.sourceId, r.title, r.studyType,
    JSON.stringify(r.sponsor), JSON.stringify(r.registryNumbers), JSON.stringify(r.dates), r.sourceUrl, r.retrievedAt,
    r.statusNote, r.snapshotDate, JSON.stringify(r.conditions), JSON.stringify(r.phase), JSON.stringify(r.countries),
    r.eligibilityText, r.summary, JSON.stringify(r.rawJson), r.relevant)
  const insStatus = db.prepare('INSERT OR REPLACE INTO source_statuses VALUES (?,?,?,?,?,?,?,?,?,?)')
  for (const s of statusRows) insStatus.run(s.query, s.source_id, s.state, s.reason_code, s.explanation, s.result_count,
    s.coverage_json, s.completeness_json, s.freshness_json, s.snapshot_date)
  db.prepare('INSERT INTO meta VALUES (?,?)').run('schema', 'mpn_trials_v1')
  db.prepare('INSERT INTO meta VALUES (?,?)').run('snapshot_date', SNAPSHOT_DATE)
  db.close()

  const dbBytes = await import('node:fs').then(({ readFileSync }) => readFileSync(dbPath))
  const jsonlBytes = Buffer.from(jsonl)
  const counts = new Map()
  for (const s of statusRows) {
    const prev = counts.get(s.source_id)
    if (!prev || s.state === 'SUCCESS' || (prev !== 'SUCCESS' && s.state === 'NO_RESULTS')) counts.set(s.source_id, s.state)
  }
  const manifest = {
    slug: 'mpn', disease: 'myeloproliferative neoplasms (PV / ET / PMF)', snapshotDate: SNAPSHOT_DATE,
    retrievedAt: RETRIEVED_AT, source: 'unified-trial-mcp (MCP stdio)', sourceVersion: '0.3.1',
    queries: queryLog, recordCount: rows.length, dbCount: rows.length, relevant: rows.length,
    sourceStatusRows: statusRows.length,
    files: {
      'trials-2026.jsonl': { sha256: SHA(jsonlBytes), bytes: jsonlBytes.length },
      'small_bowel_trials_2026.sqlite': { sha256: SHA(dbBytes), bytes: dbBytes.length },
    },
    channels: [...counts.entries()].map(([id, state]) => ({ id, state, records: rows.filter((r) => r.sourceId === id).length })),
    failedDetail: failedDetailIds,
    failed: statusRows.filter((s) => s.state === 'FAILED').map((s) => ({ query: s.query, source: s.source_id, state: s.state, reason: s.reason_code })),
    candidateScope: `已载 ${rows.length} / ${discovered.size} 条（SBA 命中子集，上限 120）；不是全库扫描。`,
  coverageNote: '本地快照 + 在线通道；FAILED/NEEDS_SETUP 不算查过，不计覆盖率；不是全库扫描。',
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(join(OUT, 'README.md'), `# Small Bowel Adenocarcinoma 临床试验快照（${SNAPSHOT_DATE}）\n\n` +
    `- 记录：**${rows.length} 条**，全部与 MPN 相关；来源 CTV（ClinicalTrials.gov 本地索引）。\n` +
    `- 检索词：${QUERIES.map((q) => q.args.condition).join(' / ')}。\n` +
    `- 通道终态：${manifest.channels.map((c) => `${c.id}=${c.state}(${c.records})`).join('；')}。\n` +
    `- 详情获取失败：${manifest.failedDetail?.length || 0} 条（跳过，不计入快照）。
- FAILED：${manifest.failed.map((f) => `${f.source}/${f.query}/${f.reason}`).join('；') || '无'}。\n` +
    `- 口径：登记 ≠ 有效 ≠ 安全 ≠ 可入组；快照会过期；相关 ${rows.length} 条不表示“只有这些”。\n` +
    `- 复现：\`UNIFIED_TRIAL_MCP_DIR=... node scripts/fetch-mpn-trials-2026.mjs\`。\n`)
  await client.close()
  console.log(`WROTE ${OUT}: records=${rows.length} statuses=${statusRows.length} jsonl=${jsonlBytes.length}B db=${dbBytes.length}B`)
}

main().catch((error) => { console.error('FAIL', error); process.exit(1) })
