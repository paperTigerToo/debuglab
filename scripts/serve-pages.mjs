// A tiny static server that behaves like GitHub Pages for a project page:
// files are served from /DebugLab/, and any missing path gets 404.html with status 404.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const port = Number(process.argv[2] ?? 4321)
const base = '/DebugLab/'
const root = join(import.meta.dirname, '..', 'dist')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

async function fileFor(urlPath) {
  if (!urlPath.startsWith(base)) return null
  let rel = normalize(decodeURIComponent(urlPath.slice(base.length)))
  if (rel.startsWith('..')) return null
  let full = join(root, rel)
  try {
    if ((await stat(full)).isDirectory()) full = join(full, 'index.html')
    await stat(full)
    return full
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname
  const file = await fileFor(path)
  if (file) {
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
    return
  }
  res.writeHead(404, { 'content-type': types['.html'] })
  res.end(await readFile(join(root, '404.html')))
}).listen(port, () => console.log(`Serving dist at http://localhost:${port}${base}`))
