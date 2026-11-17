// 构建 chat-demo（git 子模块），把产物复制到 www/，再注入安卓外壳脚本 native-shim.js。
// chat-demo 源码不做任何修改。
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = path.resolve(root, process.env.CHAT_DEMO_DIR ?? 'chat-demo')
const dist = path.join(webRoot, 'dist')
const www = path.join(root, 'www')

const run = (args) => execFileSync('pnpm', args, { cwd: webRoot, stdio: 'inherit' })

if (!existsSync(path.join(webRoot, 'package.json'))) {
  throw new Error(`找不到 chat-demo 源码目录：${webRoot}。请先运行 git submodule update --init`)
}
if (!existsSync(path.join(webRoot, 'node_modules'))) {
  run(['install', '--frozen-lockfile'])
}
run(['build'])

rmSync(www, { recursive: true, force: true })
cpSync(dist, www, { recursive: true })
cpSync(path.join(root, 'shim', 'native-shim.js'), path.join(www, 'native-shim.js'))

// 外壳脚本须先于应用脚本（defer）执行，放在 <head> 开头
const indexPath = path.join(www, 'index.html')
const html = readFileSync(indexPath, 'utf8')
const tag = '<script src="native-shim.js"></script>'
if (!html.includes(tag)) {
  const injected = html.replace(/<head>/i, `<head>${tag}`)
  if (injected === html) {
    throw new Error('index.html 中没有 <head>，无法注入 native-shim.js')
  }
  writeFileSync(indexPath, injected)
}
console.log(`已生成 ${path.relative(process.cwd(), www)}`)
