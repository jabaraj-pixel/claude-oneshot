import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const outHtmlPath = path.resolve(__dirname, '../../docs/nam-payanam-film-single.html')

let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

// Inline <link rel="stylesheet" ... href="./assets/...">
html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, (_m, href) => {
  const cssPath = path.resolve(distDir, href)
  const css = fs.readFileSync(cssPath, 'utf8')
  return `<style>\n${css}\n</style>`
})

// Inline <script type="module" ... src="./assets/...">
html = html.replace(/<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g, (_m, src) => {
  const jsPath = path.resolve(distDir, src)
  const js = fs.readFileSync(jsPath, 'utf8')
  // Safely escape any accidental </script> inside string literals
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>')
  return `<script type="module">\n${safeJs}\n</script>`
})

fs.mkdirSync(path.dirname(outHtmlPath), { recursive: true })
fs.writeFileSync(outHtmlPath, html, 'utf8')

const kb = Math.round(fs.statSync(outHtmlPath).size / 1024)
console.log(`Built standalone single-file film: ${outHtmlPath} (${kb} KB)`)
