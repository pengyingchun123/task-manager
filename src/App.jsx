import { useEffect, useMemo, useState } from 'react'

const PRIORITY_META = {
  high: { label: '高', full: '高优先级' },
  medium: { label: '中', full: '中优先级' },
  low: { label: '低', full: '低优先级' },
}

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '请求失败，请稍后重试')
  return data
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request('/api/tasks')
      .then((data) => {
        if (active) setTasks(data)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(() => {
    const result = { all: tasks.length, high: 0, medium: 0, low: 0 }
    tasks.forEach((task) => {
      result[task.priority] = (result[task.priority] || 0) + 1
    })
    return result
  }, [tasks])

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks],
  )

  const visibleTasks = useMemo(
    () => (filter === 'all' ? tasks : tasks.filter((task) => task.priority === filter)),
    [tasks, filter],
  )

  const setPending = (id, pending) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || adding) return
    setAdding(true)
    setError('')
    try {
      const task = await request('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: trimmed, priority }),
      })
      setTasks((prev) => [task, ...prev])
      setTitle('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (task) => {
    setPending(task.id, true)
    setError('')
    try {
      const updated = await request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed }),
      })
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(task.id, false)
    }
  }

  const handleDelete = async (task) => {
    setPending(task.id, true)
    setError('')
    try {
      await request(`/api/tasks/${task.id}`, { method: 'DELETE' })
      setTasks((prev) => prev.filter((item) => item.id !== task.id))
    } catch (err) {
      setError(err.message)
      setPending(task.id, false)
    }
  }

  return (
    <div className="page">
      <main className="app">
        <header className="app-header">
          <div className="brand">
            <span className="brand-logo" aria-hidden="true">✓</span>
            <div>
              <h1>智能任务管理</h1>
              <p>理清优先级，专注当下最重要的事</p>
            </div>
          </div>
          <div className="stats" aria-label="任务统计">
            <div className="stat">
              <span className="stat-value">{tasks.length}</span>
              <span className="stat-label">全部任务</span>
            </div>
            <div className="stat">
              <span className="stat-value accent">{completedCount}</span>
              <span className="stat-label">已完成</span>
            </div>
          </div>
        </header>

        <form className="add-form" onSubmit={handleAdd}>
          <input
            className="task-input"
            type="text"
            value={title}
            maxLength={200}
            placeholder="输入任务内容，例如：提交季度复盘报告"
            aria-label="任务内容"
            onChange={(event) => setTitle(event.target.value)}
          />
          <select
            className={`priority-select ${priority}`}
            value={priority}
            aria-label="优先级"
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <button className="add-btn" type="submit" disabled={adding || !title.trim()}>
            {adding ? '添加中…' : '添加任务'}
          </button>
        </form>

        <div className="toolbar">
          <div className="filters" role="tablist" aria-label="按优先级筛选">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={filter === item.value}
                className={`filter ${filter === item.value ? 'active' : ''}`}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span className="filter-count">{counts[item.value]}</span>
              </button>
            ))}
          </div>
          <span className="summary">
            待完成 {tasks.length - completedCount} 项
          </span>
        </div>

        {error && (
          <div className="banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="关闭提示">×</button>
          </div>
        )}

        <ul className="task-list">
          {loading && (
            <li className="placeholder">
              <span className="spinner" aria-hidden="true" />
              正在加载任务…
            </li>
          )}

          {!loading && visibleTasks.length === 0 && (
            <li className="placeholder empty">
              <span className="empty-icon" aria-hidden="true">📋</span>
              {tasks.length === 0 ? '还没有任务，先添加第一条吧' : '该优先级下暂无任务'}
            </li>
          )}

          {!loading && visibleTasks.map((task) => {
            const meta = PRIORITY_META[task.priority] ?? PRIORITY_META.medium
            const pending = pendingIds.has(task.id)
            return (
              <li
                key={task.id}
                className={`task ${task.completed ? 'completed' : ''}`}
              >
                <button
                  type="button"
                  className="task-toggle"
                  onClick={() => handleToggle(task)}
                  disabled={pending}
                  aria-label={task.completed ? '标记为未完成' : '标记为完成'}
                  title={task.completed ? '标记为未完成' : '标记为完成'}
                >
                  <span className="toggle-circle" aria-hidden="true">
                    {task.completed ? '✓' : ''}
                  </span>
                </button>

                <div className="task-content">
                  <p className="task-title">{task.title}</p>
                  <div className="task-meta">
                    <span className={`badge ${task.priority}`}>{meta.full}</span>
                    <span className="task-time">{formatTime(task.created_at)}</span>
                  </div>
                </div>

                <div className="task-actions">
                  <button
                    type="button"
                    className="action-btn toggle-text"
                    onClick={() => handleToggle(task)}
                    disabled={pending}
                  >
                    {task.completed ? '未完成' : '完成'}
                  </button>
                  <button
                    type="button"
                    className="action-btn danger"
                    onClick={() => handleDelete(task)}
                    disabled={pending}
                  >
                    删除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </main>
      <footer className="footer">Node.js · Express · Supabase · React</footer>
    </div>
  )
}
