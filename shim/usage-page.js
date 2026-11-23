// 「用量与余额」页面：侧栏底部入口，全屏覆盖在聊天界面之上。
// - 账户余额：GET https://api.deepseek.com/user/balance（DeepSeek 唯一开放的账户接口）
// - API Key：读取 chat-demo 保存在 localStorage 的值，默认遮挡显示
// - 本机用量估算：读取 chat-demo 的 IndexedDB 会话，按每条回复记录的 token 用量与官方价目估算
// 只读取上游数据，不写入；上游源码不做修改。
;(() => {
  const API_ORIGIN = 'https://api.deepseek.com'
  const KEY_STORAGE = 'chat-demo:api-key'
  const DB_NAME = 'chat-demo'
  const BILLING_URL = 'https://platform.deepseek.com/usage'
  const TOP_UP_URL = 'https://platform.deepseek.com/top_up'

  // 官方价目（人民币 / 百万 tokens，高峰价；空闲时段半价）。核对于 2026-11-24：
  // https://api-docs.deepseek.com/zh-cn/quick_start/pricing
  const PRICES = {
    'deepseek-flash': { hit: 0.04, miss: 2, out: 8 },
    'deepseek-v4-pro': { hit: 0.3, miss: 9, out: 27 },
  }
  const PRICE_DATE = '2026-11-24'

  // ---------- 文案 ----------
  const TEXT = {
    zh: {
      entry: '用量与余额',
      title: '用量与余额',
      back: '返回',
      refresh: '刷新',
      balance: '账户余额',
      balanceHint: '实时查询 DeepSeek 账户',
      toppedUp: '充值',
      granted: '赠送',
      available: '可用',
      unavailable: '余额不足',
      queriedAt: (t) => `查询于 ${t}`,
      loading: '正在查询…',
      noKey: '还没有填写 API Key',
      noKeyAction: '去填写',
      badKey: 'API Key 无效或已被删除，请在设置里更换',
      netError: '查询失败，请检查网络后重试',
      httpError: (s) => `查询失败（HTTP ${s}），请稍后重试`,
      topUp: '充值',
      apiKey: 'API Key',
      show: '显示',
      hide: '隐藏',
      copy: '复制',
      copied: '已复制',
      change: '更换',
      keyNote: '只保存在本机，不会上传到 DeepSeek 以外的地方',
      usage: '本机用量估算',
      usageHint: '按本机聊天记录里的 token 用量和官方价目估算',
      periods: [
        ['today', '今天'],
        ['7d', '近 7 天'],
        ['30d', '近 30 天'],
        ['all', '全部'],
      ],
      cost: '估算花费',
      requests: '请求',
      input: '输入',
      output: '输出',
      cacheHit: (p) => `缓存命中 ${p}`,
      daily: '近 14 天每日估算',
      models: '按模型',
      empty: '这段时间还没有对话记录',
      scope: [
        '只统计这台设备上保存的回复；删除的对话、其他设备和其他应用的调用不计入。',
        `按北京时间工作日 9:00–12:00、14:00–18:00 为高峰价，其余半价；法定节假日按工作日估算。价格核对于 ${PRICE_DATE}，以官网为准。`,
        '实际扣费以 DeepSeek 开放平台账单为准。',
      ],
      billing: '查看官方账单',
      tokens: 'tokens',
    },
    en: {
      entry: 'Usage & balance',
      title: 'Usage & balance',
      back: 'Back',
      refresh: 'Refresh',
      balance: 'Account balance',
      balanceHint: 'Live from your DeepSeek account',
      toppedUp: 'Topped up',
      granted: 'Granted',
      available: 'Available',
      unavailable: 'Insufficient',
      queriedAt: (t) => `Updated ${t}`,
      loading: 'Loading…',
      noKey: 'No API key yet',
      noKeyAction: 'Add key',
      badKey: 'This API key is invalid or deleted. Change it in Settings.',
      netError: 'Request failed. Check your network and try again.',
      httpError: (s) => `Request failed (HTTP ${s}). Try again later.`,
      topUp: 'Top up',
      apiKey: 'API key',
      show: 'Show',
      hide: 'Hide',
      copy: 'Copy',
      copied: 'Copied',
      change: 'Change',
      keyNote: 'Stored on this device only, sent to DeepSeek and nowhere else',
      usage: 'Estimated usage on this device',
      usageHint: 'Estimated from token usage in local chats and official prices',
      periods: [
        ['today', 'Today'],
        ['7d', '7 days'],
        ['30d', '30 days'],
        ['all', 'All'],
      ],
      cost: 'Estimated cost',
      requests: 'Requests',
      input: 'Input',
      output: 'Output',
      cacheHit: (p) => `${p} cache hit`,
      daily: 'Daily estimate, last 14 days',
      models: 'By model',
      empty: 'No chats in this period',
      scope: [
        'Counts only replies saved on this device. Deleted chats and calls from other devices or apps are not included.',
        `Peak price applies on weekdays 9:00–12:00 and 14:00–18:00 Beijing time; other times are half price. Public holidays are treated as weekdays. Prices checked on ${PRICE_DATE}; the official site is authoritative.`,
        'Your DeepSeek platform bill is the source of truth.',
      ],
      billing: 'Open official bill',
      tokens: 'tokens',
    },
  }
  const lang = () =>
    String(document.documentElement.lang || navigator.language || '')
      .toLowerCase()
      .startsWith('zh')
      ? 'zh'
      : 'en'
  const t = () => TEXT[lang()]

  // ---------- 格式化 ----------
  const fmtTokens = (n) => {
    if (lang() === 'zh') {
      if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`
      if (n >= 1e4) return `${(n / 1e4).toFixed(n >= 1e6 ? 0 : 1)} 万`
      return String(n)
    }
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
    return String(n)
  }
  const fmtMoney = (value, currency = 'CNY') => {
    const symbol = currency === 'USD' ? '$' : '¥'
    if (value > 0 && value < 0.01) return `${symbol}${value.toFixed(4)}`
    return `${symbol}${value.toFixed(2)}`
  }
  const fmtTime = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  // ---------- 数据 ----------
  const readKey = () => {
    try {
      return localStorage.getItem(KEY_STORAGE) || ''
    } catch {
      return ''
    }
  }

  const fetchBalance = async (key) => {
    let response
    try {
      response = await fetch(`${API_ORIGIN}/user/balance`, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        cache: 'no-store',
      })
    } catch {
      return { error: 'network' }
    }
    if (response.status === 401) return { error: 'auth' }
    if (!response.ok) return { error: 'http', status: response.status }
    try {
      const body = await response.json()
      return { data: body, at: new Date() }
    } catch {
      return { error: 'http', status: response.status }
    }
  }

  /** 只读打开 chat-demo 的数据库；数据库不存在时放弃，不创建空库。 */
  const readSessions = () =>
    new Promise((resolve) => {
      let request
      try {
        request = indexedDB.open(DB_NAME)
      } catch {
        resolve([])
        return
      }
      request.onupgradeneeded = () => request.transaction.abort()
      request.onerror = () => resolve([])
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('sessions')) {
          db.close()
          resolve([])
          return
        }
        const all = db.transaction('sessions', 'readonly').objectStore('sessions').getAll()
        all.onsuccess = () => {
          db.close()
          resolve(all.result || [])
        }
        all.onerror = () => {
          db.close()
          resolve([])
        }
      }
    })

  /** 北京时间工作日 9–12、14–18 点为高峰。 */
  const isPeak = (time) => {
    const d = new Date(time + 8 * 3600 * 1000)
    const day = d.getUTCDay()
    const hour = d.getUTCHours()
    return day >= 1 && day <= 5 && ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18))
  }

  const collectRecords = (sessions) => {
    const records = []
    for (const session of sessions) {
      for (const message of session?.messages || []) {
        const usage = message?.role === 'assistant' ? message.usage : null
        if (!usage || typeof message.createdAt !== 'number') continue
        const model = PRICES[message.model] ? message.model : 'deepseek-flash'
        const price = PRICES[model]
        const miss = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
        const hit = usage.cache_read_input_tokens || 0
        const out = usage.output_tokens || 0
        const factor = isPeak(message.createdAt) ? 1 : 0.5
        const cost = ((miss * price.miss + hit * price.hit + out * price.out) / 1e6) * factor
        records.push({ time: message.createdAt, model, miss, hit, out, cost })
      }
    }
    return records
  }

  const startOfDay = (time) => {
    const d = new Date(time)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const DAY = 86400000
  const periodStart = (period, now) => {
    const today = startOfDay(now)
    if (period === 'today') return today
    if (period === '7d') return today - 6 * DAY
    if (period === '30d') return today - 29 * DAY
    return -Infinity
  }
  const summarize = (records) => {
    const sum = { count: 0, miss: 0, hit: 0, out: 0, cost: 0, models: {} }
    for (const r of records) {
      sum.count += 1
      sum.miss += r.miss
      sum.hit += r.hit
      sum.out += r.out
      sum.cost += r.cost
      const m = (sum.models[r.model] ||= { count: 0, cost: 0 })
      m.count += 1
      m.cost += r.cost
    }
    return sum
  }

  // ---------- 样式 ----------
  const STYLE = `
.rs-page{position:fixed;inset:0;z-index:1500;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#111);font-size:14px;line-height:22px;animation:rs-in .22s cubic-bezier(.4,0,.2,1)}
.rs-page.rs-out{animation:rs-out .18s ease-in forwards}
@keyframes rs-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
@keyframes rs-out{to{opacity:0;transform:translateX(24px)}}
.rs-head{display:flex;align-items:center;gap:4px;height:56px;padding:0 8px;flex-shrink:0}
.rs-head h1{flex:1;margin:0;font-size:17px;font-weight:600;line-height:24px}
.rs-icon{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:0;border-radius:12px;background:none;color:inherit;cursor:pointer}
.rs-icon:active{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.rs-icon.rs-spin svg{animation:rs-spin .8s linear infinite}
@keyframes rs-spin{to{transform:rotate(360deg)}}
.rs-body{flex:1;overflow-y:auto;padding:4px 16px 32px;-webkit-overflow-scrolling:touch}
.rs-wrap{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.rs-card{padding:16px;border-radius:20px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2,rgba(0,0,0,.1))}
.rs-label{font-size:13px;color:var(--dsw-alias-label-tertiary,#888)}
.rs-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.rs-big{margin:6px 0 2px;font-size:34px;line-height:42px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.rs-sub{display:flex;flex-wrap:wrap;gap:4px 16px;color:var(--dsw-alias-label-secondary,#555);font-variant-numeric:tabular-nums}
.rs-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:999px;font-size:12px;line-height:20px;background:rgba(34,197,94,.12);color:rgb(22,150,72)}
.rs-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.rs-chip.rs-bad{background:rgba(236,19,19,.1);color:rgb(214,38,38)}
[data-ds-dark-theme] .rs-chip{color:rgb(78,209,126)}
[data-ds-dark-theme] .rs-chip.rs-bad{color:rgb(255,110,110)}
.rs-meta{margin-top:10px;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}
.rs-msg{padding:6px 0 2px;color:var(--dsw-alias-label-secondary,#555)}
.rs-msg.rs-err{color:rgb(214,38,38)}
[data-ds-dark-theme] .rs-msg.rs-err{color:rgb(255,110,110)}
.rs-btns{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.rs-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border:0;border-radius:12px;font:inherit;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary,#111);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.rs-btn.rs-primary{color:#fff;background:var(--dsw-alias-brand-primary,#3964fe)}
.rs-key{margin-top:6px;font-family:var(--ds-font-family-code,monospace);font-size:15px;letter-spacing:.02em;word-break:break-all;user-select:text}
.rs-seg{display:flex;gap:4px;margin:12px 0 4px;padding:3px;border-radius:12px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.rs-seg button{flex:1;height:30px;border:0;border-radius:9px;background:none;color:var(--dsw-alias-label-secondary,#555);font:inherit;font-size:13px;cursor:pointer}
.rs-seg button[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#111);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.rs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.rs-stat{padding:10px 12px;border-radius:14px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.rs-stat b{display:block;font-size:17px;line-height:24px;font-weight:600;font-variant-numeric:tabular-nums}
.rs-stat span{font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}
.rs-bars{display:flex;align-items:flex-end;gap:4px;height:84px;margin-top:10px}
.rs-bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%}
.rs-bar i{display:block;min-height:2px;border-radius:4px 4px 2px 2px;background:var(--dsw-alias-brand-primary,#3964fe);opacity:.85}
.rs-bar.rs-zero i{background:var(--dsw-alias-border-l3,rgba(0,0,0,.12));opacity:1}
.rs-axis{display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--dsw-alias-label-tertiary,#888)}
.rs-models{margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--dsw-alias-label-secondary,#555);font-variant-numeric:tabular-nums}
.rs-note{margin:4px 4px 0;padding:0;list-style:none;font-size:12px;line-height:19px;color:var(--dsw-alias-label-tertiary,#888)}
.rs-note li+li{margin-top:4px}
.rs-link{display:flex;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:14px;color:var(--dsw-alias-brand-text,#3964fe);font-weight:500;cursor:pointer;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2,rgba(0,0,0,.1));border:0;font:inherit;font-size:14px;width:100%}
.rs-skeleton{height:42px;margin:6px 0 2px;width:55%;border-radius:10px;background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.05))}
.ds-usage-entry{flex-shrink:0}
`
  const ICONS = {
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    refresh:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    entry:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
    external:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  }

  // ---------- 页面 ----------
  const h = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v
      else if (k === 'html') el.innerHTML = v
      else if (k === 'text') el.textContent = v
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
      else el.setAttribute(k, v)
    }
    for (const c of [].concat(children)) if (c) el.append(c)
    return el
  }

  /** 侧栏底部原生的「设置」按钮。入口复用了它的 class，必须排除入口自己，否则会无限插入。 */
  const findSettingsButton = () =>
    document.querySelector('[class*="bottom-"]:not(.ds-usage-entry) > button[class*="settings-"]')

  let page = null
  const state = { period: '7d', reveal: false, balance: null, records: null, loading: false }

  /** 关掉本页，打开设置里的「数据管理」去填写或更换 API Key。 */
  const openKeySettings = () => {
    close()
    const button = findSettingsButton()
    if (button instanceof HTMLElement) {
      button.click()
      setTimeout(() => {
        const tabs = document.querySelectorAll('[role="dialog"] [role="tab"]')
        if (tabs[1] instanceof HTMLElement) tabs[1].click()
      }, 60)
    }
  }

  const renderBalance = () => {
    const tx = t()
    const card = h('section', { class: 'rs-card' })
    const head = h('div', { class: 'rs-row' }, [h('div', { class: 'rs-label', text: tx.balance })])
    card.append(head)
    const key = readKey()
    if (!key) {
      card.append(
        h('div', { class: 'rs-msg', text: tx.noKey }),
        h('div', { class: 'rs-btns' }, [
          h('button', { class: 'rs-btn rs-primary', type: 'button', text: tx.noKeyAction, onclick: openKeySettings }),
        ])
      )
      return card
    }
    const result = state.balance
    if (!result) {
      card.append(h('div', { class: 'rs-skeleton' }), h('div', { class: 'rs-meta', text: tx.loading }))
      return card
    }
    if (result.error) {
      const message =
        result.error === 'auth' ? tx.badKey : result.error === 'network' ? tx.netError : tx.httpError(result.status)
      card.append(h('div', { class: 'rs-msg rs-err', text: message }))
      if (result.error === 'auth') {
        card.append(
          h('div', { class: 'rs-btns' }, [
            h('button', { class: 'rs-btn', type: 'button', text: tx.change, onclick: openKeySettings }),
          ])
        )
      }
      return card
    }
    const infos = Array.isArray(result.data.balance_infos) ? result.data.balance_infos : []
    head.append(
      h('span', {
        class: `rs-chip${result.data.is_available ? '' : ' rs-bad'}`,
        text: result.data.is_available ? tx.available : tx.unavailable,
      })
    )
    if (!infos.length) {
      card.append(h('div', { class: 'rs-big', text: fmtMoney(0) }))
    }
    infos.forEach((info, i) => {
      const cur = info.currency
      card.append(
        h('div', { class: 'rs-big', style: i ? 'font-size:24px;line-height:32px;margin-top:12px' : '', text: fmtMoney(Number(info.total_balance) || 0, cur) }),
        h('div', { class: 'rs-sub' }, [
          h('span', { text: `${tx.toppedUp} ${fmtMoney(Number(info.topped_up_balance) || 0, cur)}` }),
          h('span', { text: `${tx.granted} ${fmtMoney(Number(info.granted_balance) || 0, cur)}` }),
        ])
      )
    })
    card.append(
      h('div', { class: 'rs-btns' }, [
        h('button', { class: 'rs-btn rs-primary', type: 'button', text: tx.topUp, onclick: () => window.open(TOP_UP_URL) }),
      ]),
      h('div', { class: 'rs-meta', text: `${tx.balanceHint} · ${tx.queriedAt(fmtTime(result.at))}` })
    )
    return card
  }

  const renderKey = () => {
    const tx = t()
    const key = readKey()
    if (!key) return null
    const masked = key.length > 10 ? `${key.slice(0, 3)}${'•'.repeat(12)}${key.slice(-4)}` : '•'.repeat(key.length)
    const copyBtn = h('button', { class: 'rs-btn', type: 'button', text: tx.copy })
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(key)
        copyBtn.textContent = tx.copied
        setTimeout(() => (copyBtn.textContent = tx.copy), 1500)
      } catch {
        /* 复制失败时保持原文案 */
      }
    })
    return h('section', { class: 'rs-card' }, [
      h('div', { class: 'rs-label', text: tx.apiKey }),
      h('div', { class: 'rs-key', text: state.reveal ? key : masked }),
      h('div', { class: 'rs-btns' }, [
        h('button', {
          class: 'rs-btn',
          type: 'button',
          text: state.reveal ? tx.hide : tx.show,
          onclick: () => {
            state.reveal = !state.reveal
            render()
          },
        }),
        copyBtn,
        h('button', { class: 'rs-btn', type: 'button', text: tx.change, onclick: openKeySettings }),
      ]),
      h('div', { class: 'rs-meta', text: tx.keyNote }),
    ])
  }

  const renderUsage = () => {
    const tx = t()
    const card = h('section', { class: 'rs-card' }, [
      h('div', { class: 'rs-label', text: tx.usage }),
    ])
    const seg = h(
      'div',
      { class: 'rs-seg', role: 'group' },
      tx.periods.map(([value, label]) =>
        h('button', {
          type: 'button',
          'aria-pressed': String(state.period === value),
          text: label,
          onclick: () => {
            state.period = value
            render()
          },
        })
      )
    )
    card.append(seg)
    if (!state.records) {
      card.append(h('div', { class: 'rs-skeleton' }))
      return card
    }
    const now = Date.now()
    const from = periodStart(state.period, now)
    const sum = summarize(state.records.filter((r) => r.time >= from))
    card.append(
      h('div', { class: 'rs-big', text: fmtMoney(sum.cost) }),
      h('div', { class: 'rs-sub', text: tx.cost })
    )
    if (!sum.count) {
      card.append(h('div', { class: 'rs-msg', text: tx.empty }))
    } else {
      const totalIn = sum.miss + sum.hit
      const hitRate = totalIn ? `${Math.round((sum.hit / totalIn) * 100)}%` : '0%'
      card.append(
        h('div', { class: 'rs-grid' }, [
          h('div', { class: 'rs-stat' }, [h('b', { text: String(sum.count) }), h('span', { text: tx.requests })]),
          h('div', { class: 'rs-stat' }, [h('b', { text: fmtTokens(totalIn) }), h('span', { text: tx.input }), h('span', { style: 'display:block', text: tx.cacheHit(hitRate) })]),
          h('div', { class: 'rs-stat' }, [h('b', { text: fmtTokens(sum.out) }), h('span', { text: tx.output })]),
        ])
      )
      const models = Object.entries(sum.models)
      if (models.length > 1) {
        card.append(
          h(
            'div',
            { class: 'rs-models' },
            [h('div', { class: 'rs-label', text: tx.models })].concat(
              models.map(([name, m]) =>
                h('div', { class: 'rs-row' }, [
                  h('span', { text: name }),
                  h('span', { text: `${m.count} · ${fmtMoney(m.cost)}` }),
                ])
              )
            )
          )
        )
      }
    }
    // 近 14 天每日估算
    const today = startOfDay(now)
    const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY)
    const totals = days.map((d) => state.records.filter((r) => r.time >= d && r.time < d + DAY).reduce((a, r) => a + r.cost, 0))
    const max = Math.max(...totals)
    const label = (d) => {
      const x = new Date(d)
      return `${x.getMonth() + 1}/${x.getDate()}`
    }
    card.append(
      h('div', { class: 'rs-label', style: 'margin-top:16px', text: tx.daily }),
      h(
        'div',
        { class: 'rs-bars', role: 'img', 'aria-label': tx.daily },
        totals.map((v, i) =>
          h('div', { class: `rs-bar${v ? '' : ' rs-zero'}`, title: `${label(days[i])} ${fmtMoney(v)}` }, [
            h('i', { style: `height:${max ? Math.max(3, (v / max) * 100) : 3}%` }),
          ])
        )
      ),
      h('div', { class: 'rs-axis' }, [h('span', { text: label(days[0]) }), h('span', { text: label(days[13]) })])
    )
    return card
  }

  const render = () => {
    if (!page) return
    const tx = t()
    const body = page.querySelector('.rs-wrap')
    page.querySelector('h1').textContent = tx.title
    page.querySelector('.rs-back').setAttribute('aria-label', tx.back)
    const refresh = page.querySelector('.rs-refresh')
    refresh.setAttribute('aria-label', tx.refresh)
    refresh.classList.toggle('rs-spin', state.loading)
    const top = page.querySelector('.rs-body').scrollTop
    body.replaceChildren(
      ...[
        renderBalance(),
        renderKey(),
        renderUsage(),
        h('button', { class: 'rs-link', type: 'button', html: `${tx.billing}${ICONS.external}`, onclick: () => window.open(BILLING_URL) }),
        h('ul', { class: 'rs-note' }, tx.scope.map((line) => h('li', { text: line }))),
      ].filter(Boolean)
    )
    page.querySelector('.rs-body').scrollTop = top
  }

  const load = async () => {
    if (state.loading) return
    state.loading = true
    state.balance = null
    render()
    const key = readKey()
    const [balance, sessions] = await Promise.all([key ? fetchBalance(key) : null, readSessions()])
    state.balance = balance
    state.records = collectRecords(sessions)
    state.loading = false
    render()
  }

  const open = () => {
    if (page) return
    if (!document.getElementById('rs-style')) {
      document.head.append(h('style', { id: 'rs-style', text: STYLE }))
    }
    page = h('div', { class: 'rs-page', role: 'region' }, [
      h('header', { class: 'rs-head' }, [
        h('button', { class: 'rs-icon rs-back', type: 'button', html: ICONS.back, onclick: () => close() }),
        h('h1'),
        h('button', { class: 'rs-icon rs-refresh', type: 'button', html: ICONS.refresh, onclick: () => load() }),
      ]),
      h('div', { class: 'rs-body' }, [h('div', { class: 'rs-wrap' })]),
    ])
    document.body.append(page)
    state.reveal = false
    void load()
  }

  const close = () => {
    if (!page) return false
    const leaving = page
    page = null
    leaving.classList.add('rs-out')
    setTimeout(() => leaving.remove(), 180)
    return true
  }

  // 返回键：本页开着时先关本页
  window.__rosieUsageBack = close
  // 界面语言切换时重画
  new MutationObserver(() => render()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang'],
  })

  // ---------- 侧栏入口 ----------
  const injectEntry = () => {
    const settings = findSettingsButton()
    if (!settings) return
    const bottom = settings.parentElement
    const existing = document.querySelector('.ds-usage-entry')
    if (existing && existing.nextElementSibling === bottom) {
      const label = existing.querySelector('.ds-usage-label')
      if (label && label.textContent !== t().entry) label.textContent = t().entry
      return
    }
    const iconClass = settings.querySelector('[class*="settingsIcon-"]')?.className || ''
    const labelClass = settings.querySelector('[class*="settingsLabel-"]')?.className || ''
    existing?.remove()
    const button = h('button', { type: 'button', class: settings.className, onclick: open }, [
      h('span', { class: iconClass, html: ICONS.entry }),
      h('span', { class: `${labelClass} ds-usage-label`, text: t().entry }),
    ])
    const wrap = h('div', { class: `${bottom.className} ds-usage-entry`, style: 'height:auto;padding-bottom:0' }, [button])
    bottom.before(wrap)
  }
  const start = () => {
    injectEntry()
    new MutationObserver(injectEntry).observe(document.body, { childList: true, subtree: true })
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
})()
