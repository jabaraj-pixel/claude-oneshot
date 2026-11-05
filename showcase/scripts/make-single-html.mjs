import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const docsDir = path.resolve(__dirname, '../../docs')
const outHtmlPath = path.join(docsDir, 'nam-payanam-film-single.html')
const outIndexPath = path.join(docsDir, 'index.html')
const noJekyllPath = path.join(docsDir, '.nojekyll')

let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

// Inline <link rel="stylesheet" ... href="./assets/..."> using callback so $& / $$ are NEVER interpreted!
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

if (!inlinedScript) {
  throw new Error('Could not find built module script in dist/index.html')
}

// CRITICAL: Use function replacement () => ... so $& inside minified Three.js is NEVER replaced with </body>!
const bodyCloseIdx = html.lastIndexOf('</body>')
if (bodyCloseIdx === -1) throw new Error('Missing </body> tag')
html = html.slice(0, bodyCloseIdx) + `  ${inlinedScript}\n  ` + html.slice(bodyCloseIdx)

// Verify the embedded <script type="module"> in the final HTML parses with ZERO syntax errors!
const scriptMatch = html.match(/<script type="module">\n([\s\S]*?)\n<\/script>/)
if (!scriptMatch) throw new Error('Embedded <script type="module"> block not found in final HTML')
transformSync(scriptMatch[1], { loader: 'js', format: 'esm' })

fs.mkdirSync(docsDir, { recursive: true })
fs.writeFileSync(outHtmlPath, html, 'utf8')
fs.writeFileSync(outIndexPath, html, 'utf8')
fs.writeFileSync(noJekyllPath, '', 'utf8')

const kb = Math.round(fs.statSync(outHtmlPath).size / 1024)
console.log(`Built & syntax-verified standalone film: ${outHtmlPath} & index.html (${kb} KB)`)
