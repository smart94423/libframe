import * as execa from 'execa'
import { readdirSync, writeFileSync, readFileSync, lstatSync } from 'fs'
import * as assert from 'assert'
import { DIR_BOILERPLATES, DIR_EXAMPLES, DIR_SRC, DIR_ROOT, VITE_PLUGIN_SSR_VERSION_FILES, getNpmName } from './helpers/locations'
import * as semver from 'semver'

release()

async function release() {
  const { versionOld, versionNew } = getVersion()
  updateVersionMacro(versionOld, versionNew)
  updatePackageJsonVersion(versionNew)
  await updateDependencies(versionNew, versionOld)
  bumpBoilerplateVersion()
  await updateLockFile()
  await changelog()
  const tag = `v${versionNew}`
  await commit(tag)
  await commitTag(tag)
  // Ensure a fresh build to have a correct `dist/package.json#version`.
  await build()
  await publish()
  await publishBoilerplates()
  await gitPush()

  // Test & commit lock file changes
  await testRelease()
  await commitLockfileChanges()
  await gitPush()

  await link()
}

async function publish() {
  await run('npm', ['publish'], { cwd: DIR_SRC })
}

async function publishBoilerplates() {
  await run('npm', ['publish'], { cwd: DIR_BOILERPLATES })
}

async function gitPush() {
  await run('git', ['push'])
  await run('git', ['push', '--tags'])
}

async function link() {
  await run('npm', ['run', 'link'])
}

async function changelog() {
  // npx conventional-changelog -p angular -i CHANGELOG.md -s --pkg src/
  await run('npx', ['conventional-changelog', '-p', 'angular', '-i', 'CHANGELOG.md', '-s', '--pkg', DIR_SRC])
}
async function commit(tag: string) {
  assert(tag.startsWith('v0'))
  await run('git', ['commit', '-am', `release: ${tag}`])
}
async function commitTag(tag: string) {
  assert(tag.startsWith('v0'))
  await run('git', ['tag', tag])
}
async function build() {
  await run('npm', ['run', 'build'])
}

async function testRelease() {
  await run('npm', ['run', 'release:test-post-release'])
}
async function commitLockfileChanges() {
  await run('git', ['commit', '-am', `chore: update lockfiles`])
}

function getVersion(): { versionNew: string; versionOld: string } {
  const pkg = require(`${DIR_SRC}/package.json`) as PackageJson
  const versionOld = pkg.version
  assert(versionOld)
  const cliArgs = getCliArgs()
  let versionNew = cliArgs[0]
  if (!versionNew) {
    versionNew = semver.inc(versionOld, 'patch')
  }
  assert(versionNew.startsWith('0.'))
  assert(versionOld.startsWith('0.'))
  return { versionNew, versionOld }
}
function updateVersionMacro(versionOld: string, versionNew: string) {
  VITE_PLUGIN_SSR_VERSION_FILES.forEach((filePath) => {
    const getCodeSnippet = (version: string) => `const VITE_PLUGIN_SSR_VERSION = '${version}'`
    const codeSnippetOld = getCodeSnippet(versionOld)
    const codeSnippetNew = getCodeSnippet(versionNew)
    const contentOld = readFileSync(filePath, 'utf8')
    assert(contentOld.includes(codeSnippetOld))
    const contentNew = contentOld.replace(codeSnippetOld, codeSnippetNew)
    assert(contentNew !== contentOld)
    writeFileSync(filePath, contentNew)
  })
}
function updatePackageJsonVersion(versionNew: string) {
  updatePkg(`${DIR_SRC}/package.json`, (pkg) => {
    pkg.version = versionNew
  })
}

function bumpBoilerplateVersion() {
  const pkgPath = require.resolve(`${DIR_BOILERPLATES}/package.json`)
  const pkg = require(pkgPath)
  assert(pkg.version.startsWith('0.0.'))
  const versionParts = pkg.version.split('.')
  assert(versionParts.length === 3)
  const newPatch = parseInt(versionParts[2], 10) + 1
  pkg.version = `0.0.${newPatch}`
  writePackageJson(pkgPath, pkg)
}

async function updateDependencies(versionNew: string, versionOld: string) {
  const pkgPaths = [...retrievePkgPaths(DIR_BOILERPLATES), ...retrievePkgPaths(DIR_EXAMPLES)]
  for (const pkgPath of pkgPaths) {
    updatePkg(pkgPath, (pkg) => {
      const version = pkg.dependencies[getNpmName()]
      assert(version)
      let versionCurrentSemver = versionOld
      let versionNewSemver = versionNew
      if (pkgPath.includes('boilerplates/boilerplate-')) {
        versionCurrentSemver = '^' + versionCurrentSemver
        versionNewSemver = '^' + versionNewSemver
      }
      assert.strictEqual(version, versionCurrentSemver)
      pkg.dependencies[getNpmName()] = versionNewSemver
    })
    // Update package-json.lock
    // await run('npm', ['install'])
  }
}

function retrievePkgPaths(rootDir: string): string[] {
  const directories = readdirSync(rootDir)
    .map((file) => `${rootDir}/${file}`)
    .filter((filePath) => !filePath.includes('node_modules'))
    .filter((filePath) => lstatSync(filePath).isDirectory())
  const pkgPaths = []
  for (const dir of directories) {
    const pkgPath = require.resolve(`${dir}/package.json`)
    pkgPaths.push(pkgPath)
  }
  return pkgPaths
}

function updatePkg(pkgPath: string, updater: (pkg: PackageJson) => void) {
  const pkg = require(pkgPath) as PackageJson
  updater(pkg)
  writePackageJson(pkgPath, pkg)
}

function writePackageJson(pkgPath: string, pkg: object) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

async function updateLockFile() {
  await run('npm', ['install'])
}

type PackageJson = {
  version: string
  dependencies: Record<string, string>
}

async function run(cmd: string, args: string[], { cwd = DIR_ROOT } = {}): Promise<void> {
  const stdio = 'inherit'
  await execa(cmd, args, { cwd, stdio })
}

function getCliArgs(): string[] {
  return process.argv.slice(2)
}
