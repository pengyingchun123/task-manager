import 'dotenv/config'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './store.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = Number(process.env.PORT) || 3000
const PRIORITIES = new Set(['high', 'medium', 'low'])
const MAX_TITLE_LENGTH = 200

const app = express()
const store = createStore()

app.use(express.json({ limit: '100kb' }))

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next)
}

function normalizeTitle(value) {
  if (typeof value !== 'string') return null
  const title = value.trim().replace(/\s+/g, ' ')
  if (!title || title.length > MAX_TITLE_LENGTH) return null
  return title
}

app.get('/api/tasks', asyncRoute(async (_req, res) => {
  const tasks = await store.list()
  res.json(tasks)
}))

app.post('/api/tasks', asyncRoute(async (req, res) => {
  const title = normalizeTitle(req.body?.title)
  if (!title) {
    return res.status(400).json({ error: `任务标题不能为空，且不超过 ${MAX_TITLE_LENGTH} 个字符` })
  }
  const priority = req.body?.priority ?? 'medium'
  if (!PRIORITIES.has(priority)) {
    return res.status(400).json({ error: '优先级只能是 high / medium / low' })
  }
  const task = await store.create({ title, priority })
  res.status(201).json(task)
}))

app.patch('/api/tasks/:id', asyncRoute(async (req, res) => {
  if (typeof req.body?.completed !== 'boolean') {
    return res.status(400).json({ error: 'completed 必须是布尔值' })
  }
  const task = await store.update(req.params.id, { completed: req.body.completed })
  if (!task) return res.status(404).json({ error: '任务不存在' })
  res.json(task)
}))

app.delete('/api/tasks/:id', asyncRoute(async (req, res) => {
  const deleted = await store.remove(req.params.id)
  if (!deleted) return res.status(404).json({ error: '任务不存在' })
  res.json({ ok: true })
}))

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

const distDir = path.join(ROOT, 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

app.use((err, _req, res, _next) => {
  console.error('[server]', err)
  res.status(500).json({ error: '服务器开小差了，请稍后重试' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server listening on http://0.0.0.0:${PORT}`)
})
