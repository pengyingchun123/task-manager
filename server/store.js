import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'tasks.json')

const TO_DB_PRIORITY = {
  high: '高',
  medium: '中',
  low: '低',
}

const FROM_DB_PRIORITY = {
  '高': 'high',
  '中': 'medium',
  '低': 'low',
}

class SupabaseStore {
  constructor(url, key) {
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
    })
  }

  _mapFromDb(row) {
    if (!row) return null
    return {
      ...row,
      priority: FROM_DB_PRIORITY[row.priority] || 'medium',
    }
  }

  async list() {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => this._mapFromDb(row))
  }

  async create({ title, priority }) {
    const { data, error } = await this.client
      .from('tasks')
      .insert({ title, priority: TO_DB_PRIORITY[priority], completed: false })
      .select('*')
      .single()
    if (error) throw error
    return this._mapFromDb(data)
  }

  async update(id, { completed }) {
    const { data, error } = await this.client
      .from('tasks')
      .update({ completed })
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    return this._mapFromDb(data)
  }

  async remove(id) {
    const { data, error } = await this.client
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) throw error
    return Boolean(data)
  }
}

class LocalStore {
  constructor() {
    this.tasks = null
    this.writeQueue = Promise.resolve()
  }

  async load() {
    if (this.tasks) return this.tasks
    try {
      const raw = await readFile(DATA_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      this.tasks = Array.isArray(parsed) ? parsed : []
    } catch {
      this.tasks = []
    }
    return this.tasks
  }

  persist() {
    const snapshot = JSON.stringify(this.tasks, null, 2)
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(DATA_DIR, { recursive: true })
      await writeFile(DATA_FILE, snapshot, 'utf8')
    }).catch((err) => console.error('[store] 本地数据写入失败', err))
    return this.writeQueue
  }

  async list() {
    const tasks = await this.load()
    return [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  async create({ title, priority }) {
    const tasks = await this.load()
    const task = {
      id: randomUUID(),
      title,
      priority,
      completed: false,
      created_at: new Date().toISOString(),
    }
    tasks.push(task)
    await this.persist()
    return task
  }

  async update(id, { completed }) {
    const tasks = await this.load()
    const task = tasks.find((item) => item.id === id)
    if (!task) return null
    task.completed = completed
    await this.persist()
    return task
  }

  async remove(id) {
    const tasks = await this.load()
    const index = tasks.findIndex((item) => item.id === id)
    if (index === -1) return false
    tasks.splice(index, 1)
    await this.persist()
    return true
  }
}

export function createStore() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (url && key) {
    console.log('[store] 使用 Supabase 数据库:', url)
    return new SupabaseStore(url, key)
  }
  console.warn('[store] 未配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，使用本地 JSON 存储（仅用于预览）')
  return new LocalStore()
}
