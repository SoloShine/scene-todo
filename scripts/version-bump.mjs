import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const FILES = {
  'package.json': {
    path: resolve(root, 'package.json'),
    replace: (content, version) => content.replace(
      /"version"\s*:\s*"[^"]+"/,
      `"version": "${version}"`
    ),
  },
  'src-tauri/Cargo.toml': {
    path: resolve(root, 'src-tauri', 'Cargo.toml'),
    replace: (content, version) => content.replace(
      /^(version\s*=\s*)"[^"]+"/m,
      `$1"${version}"`
    ),
  },
  'src-tauri/tauri.conf.json': {
    path: resolve(root, 'src-tauri', 'tauri.conf.json'),
    replace: (content, version) => content.replace(
      /"version"\s*:\s*"[^"]+"/,
      `"version": "${version}"`
    ),
  },
}

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(FILES['package.json'].path, 'utf-8'))
  return pkg.version
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(Number)
  if (type === 'major') return `${parts[0] + 1}.0.0`
  if (type === 'minor') return `${parts[0]}.${parts[1] + 1}.0`
  if (type === 'patch') return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  if (/^\d+\.\d+\.\d+$/.test(type)) return type
  throw new Error(`Invalid version bump: ${type}`)
}

function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.log('Usage: node scripts/version-bump.mjs <patch|minor|major|x.y.z>')
    console.log(`  Current version: ${getCurrentVersion()}`)
    process.exit(1)
  }

  const current = getCurrentVersion()
  const next = bumpVersion(current, arg)

  console.log(`Bumping version: ${current} → ${next}\n`)

  for (const [name, file] of Object.entries(FILES)) {
    const content = readFileSync(file.path, 'utf-8')
    const updated = file.replace(content, next)
    writeFileSync(file.path, updated, 'utf-8')
    console.log(`  ✓ ${name}`)
  }

  console.log(`\nDone! Version updated to ${next}`)
}

main()
