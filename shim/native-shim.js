// 安卓外壳脚本：在 chat-demo 应用脚本之前运行，补齐 WebView 缺少的浏览器能力。
// - blob: 下载（历史导出）→ 系统「保存到」对话框
// - blob: 打开（附件原件）→ 系统应用打开
// - window.open 外部链接 → 系统浏览器
// - 返回键 → 先关弹窗、再关侧边栏，最后退到后台
// - 主题色 → 同步状态栏与导航栏
;(() => {
  const cap = window.Capacitor
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) {
    return
  }
  const native = (method, options) => cap.nativePromise('AppShell', method, options)

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result)
        resolve(result.slice(result.indexOf(',') + 1))
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })

  const handleBlob = async (url, name, download) => {
    try {
      const blob = await (await fetch(url)).blob()
      const data = await blobToBase64(blob)
      await native(download ? 'saveFile' : 'openFile', {
        data,
        name: name || '',
        mimeType: (blob.type || 'application/octet-stream').split(';')[0].trim(),
      })
    } catch (error) {
      console.error('[native-shim] blob 处理失败', error)
    }
  }

  const isBlob = (href) => typeof href === 'string' && href.startsWith('blob:')

  const handleAnchor = (anchor) => {
    const href = anchor.href
    if (!isBlob(href)) {
      return false
    }
    const download = anchor.hasAttribute('download')
    const name = anchor.getAttribute('download') || anchor.title || ''
    void handleBlob(href, name, download)
    return true
  }

  // 程序化 link.click()（元素可能未挂到文档上，事件不会冒泡到 document）
  const nativeClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function click() {
    if (!this.isConnected && handleAnchor(this)) {
      return
    }
    nativeClick.call(this)
  }

  // 用户点击页面上的 blob: 链接
  document.addEventListener(
    'click',
    (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (anchor && handleAnchor(anchor)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    },
    true
  )

  window.open = (url) => {
    const href = url == null ? '' : String(url)
    if (isBlob(href)) {
      void handleBlob(href, '', false)
    } else if (/^https?:/i.test(href)) {
      void native('openExternal', { url: href })
    }
    return null
  }

  // 返回键：返回 true 表示页面已处理
  const escape = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
    )
  window.__chatShellBack = () => {
    if (document.querySelector('[role="dialog"]')) {
      escape()
      return true
    }
    const mask = document.querySelector('[class*="drawerMask-"]')
    if (mask instanceof HTMLElement) {
      mask.click()
      return true
    }
    return false
  }

  // 主题色：应用写入 <meta name="theme-color">，同步给系统栏
  let lastColor = ''
  const syncBars = () => {
    const color = document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    if (!color || color === lastColor) {
      return
    }
    // 应用写入的是 getComputedStyle 结果（rgb()/rgba()），也兼容 #rrggbb
    const rgb = color.match(/\d+(\.\d+)?/g)
    const hex = /^#([0-9a-f]{6})$/i.exec(color)
    const [r, g, b] = hex
      ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16))
      : (rgb ?? []).slice(0, 3).map(Number)
    if ([r, g, b].some((value) => !Number.isFinite(value))) {
      return
    }
    lastColor = color
    void native('setBarColor', { r, g, b }).catch(() => {})
  }
  const watch = () => {
    syncBars()
    new MutationObserver(syncBars).observe(document.head, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['content'],
    })
  }
  if (document.head) {
    watch()
  } else {
    document.addEventListener('DOMContentLoaded', watch, { once: true })
  }

  // 首屏真正画出来（#root 有内容）后再通知原生收起启动画面，避免中间夹一段空白页
  const signalReady = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => void native('contentReady').catch(() => {})))
  }
  const waitForFirstPaint = () => {
    const startedAt = performance.now()
    const painted = () => {
      const root = document.getElementById('root')
      return !!root && root.childElementCount > 0
    }
    const tick = () => {
      // 页面本身没内容（离线、加载失败）时也別一直挂着，交给原生侧兜底
      if (painted() || performance.now() - startedAt > 1500) {
        signalReady()
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  }
  if (document.readyState === 'complete') {
    waitForFirstPaint()
  } else {
    window.addEventListener('load', waitForFirstPaint, { once: true })
  }

  // 设置面板底部显示应用名与版本号
  const metaText = (version) => {
    const lang = String(document.documentElement.lang || navigator.language || '').toLowerCase()
    return lang.startsWith('zh')
      ? `Rosie · v${version} · 非官方 DeepSeek 客户端`
      : `Rosie · v${version} · unofficial DeepSeek client`
  }
  const injectAppMeta = (version) => {
    const panels = document.querySelectorAll('[role="tabpanel"]')
    panels.forEach((panel) => {
      const existing = panel.querySelector(':scope > .ds-app-meta')
      if (existing) {
        // 切换界面语言后跟着改文案
        const text = metaText(version)
        if (existing.textContent !== text) {
          existing.textContent = text
        }
        return
      }
      const dialog = panel.closest('[role="dialog"]')
      if (!dialog || !dialog.querySelector('[role="tablist"]')) {
        return
      }
      const meta = document.createElement('div')
      meta.className = 'ds-app-meta'
      meta.textContent = metaText(version)
      meta.style.cssText = [
        'margin:18px 0 2px',
        'padding-top:14px',
        'border-top:1px solid currentColor',
        'border-color:color-mix(in srgb, currentColor 12%, transparent)',
        'font-size:12px',
        'line-height:1.5',
        'letter-spacing:.02em',
        'text-align:center',
        'color:inherit',
        'opacity:.45',
        'user-select:text',
      ].join(';')
      panel.appendChild(meta)
    })
  }
  const watchAppMeta = () => {
    void native('getAppInfo')
      .then((info) => {
        const version = (info && info.versionName) || ''
        if (!version) {
          return
        }
        injectAppMeta(version)
        // 切换设置分组时 React 会重建面板，重新补上
        const observer = new MutationObserver(() => injectAppMeta(version))
        observer.observe(document.body, { childList: true, subtree: true })
        new MutationObserver(() => injectAppMeta(version)).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['lang'],
        })
      })
      .catch(() => {})
  }
  if (document.readyState === 'complete') {
    watchAppMeta()
  } else {
    window.addEventListener('load', watchAppMeta, { once: true })
  }
})()
