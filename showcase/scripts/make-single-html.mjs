import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const docsDir = path.resolve(__dirname, '../../docs')
const outHtmlPath = path.join(docsDir, 'nam-payanam-film-single.html')
const outIndexPath = path.join(docsDir, 'index.html')
const noJekyllPath = path.join(docsDir, '.nojekyll')

let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

// Inline <link rel="stylesheet" ... href="./assets/..."> in <head>
html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, (_m, href) => {
  const cssPath = path.resolve(distDir, href)
  const css = fs.readFileSync(cssPath, 'utf8')
  return `<style>\n${css}\n</style>`
})

// Extract <script type="module" ... src="./assets/..."> and place inline right before </body>
let inlinedScript = ''
html = html.replace(/<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>\s*/g, (_m, src) => {
  const jsPath = path.resolve(distDir, src)
  const js = fs.readFileSync(jsPath, 'utf8')
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>')
  inlinedScript = `<script type="module">\n${safeJs}\n</script>`
  return ''
})

if (inlinedScript) {
  html = html.replace('</body>', `  ${inlinedScript}\n  </body>`)
}

fs.mkdirSync(docsDir, { recursive: true })
fs.writeFileSync(outHtmlPath, html, 'utf8')
fs.writeFileSync(outIndexPath, html, 'utf8')
fs.writeFileSync(noJekyllPath, '', 'utf8')

const kb = Math.round(fs.statSync(outHtmlPath).size / 1024)
console.log(`Built standalone single-file film: ${outHtmlPath} & index.html (${kb} KB)`)
