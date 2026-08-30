import { readFile, readdir } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(workspaceRoot, 'src')

const allowedDependencies = {
  shared: new Set(['shared']),
  renderer: new Set(['renderer', 'shared']),
  preload: new Set(['preload', 'shared']),
  transport: new Set(['transport', 'service', 'shared']),
  service: new Set(['service', 'repository', 'infra', 'shared']),
  repository: new Set(['repository', 'infra', 'shared']),
  infra: new Set(['infra', 'shared']),
  main: new Set(['main', 'transport', 'service', 'repository', 'infra', 'shared'])
}

const forbiddenPackages = {
  shared: [/^electron$/, /^node:/, /^react(?:\/|$)/],
  renderer: [/^electron$/, /^node:/],
  service: [/^electron$/, /^react(?:\/|$)/],
  repository: [/^electron$/, /^react(?:\/|$)/]
}

function layerOf(path) {
  const normalized = relative(sourceRoot, path).split(sep).join('/')
  if (normalized.startsWith('shared/')) return 'shared'
  if (normalized.startsWith('renderer/')) return 'renderer'
  if (normalized.startsWith('preload/')) return 'preload'
  if (normalized.startsWith('main/transport/')) return 'transport'
  if (normalized.startsWith('main/service/')) return 'service'
  if (normalized.startsWith('main/repository/')) return 'repository'
  if (normalized.startsWith('main/infra/')) return 'infra'
  if (normalized.startsWith('main/')) return 'main'
  return null
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
    })
  )
  return nested.flat()
}

function resolveImport(importer, specifier) {
  if (specifier.startsWith('@/')) {
    return resolve(sourceRoot, 'renderer/src', specifier.slice(2))
  }
  if (specifier.startsWith('.')) return resolve(dirname(importer), specifier)
  return null
}

const violations = []
const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g

for (const file of await sourceFiles(sourceRoot)) {
  const importerLayer = layerOf(file)
  if (!importerLayer) continue
  const source = await readFile(file, 'utf8')
  if (
    (importerLayer === 'service' || importerLayer === 'repository') &&
    /\b(?:window|document)\s*\./.test(source)
  ) {
    violations.push(
      `${relative(workspaceRoot, file)}: ${importerLayer} 不允许访问浏览器全局对象`
    )
  }
  for (const match of source.matchAll(importPattern)) {
    if (forbiddenPackages[importerLayer]?.some((pattern) => pattern.test(match[1]))) {
      violations.push(
        `${relative(workspaceRoot, file)}: ${importerLayer} 不允许导入 ${match[1]}`
      )
      continue
    }
    const importedPath = resolveImport(file, match[1])
    if (!importedPath || !importedPath.startsWith(`${sourceRoot}${sep}`)) continue
    const importedLayer = layerOf(importedPath)
    if (!importedLayer || allowedDependencies[importerLayer].has(importedLayer)) continue
    violations.push(
      `${relative(workspaceRoot, file)}: ${importerLayer} 不允许依赖 ${importedLayer} (${match[1]})`
    )
  }
}

if (violations.length) {
  console.error(['架构依赖检查失败：', ...violations.map((item) => `- ${item}`)].join('\n'))
  process.exitCode = 1
} else {
  console.log('架构依赖检查通过')
}
