import { getDependers } from './helpers/getDependers'
import { DIR_SRC, DIR_ROOT } from './helpers/locations'
import { runCommand } from './helpers/runCommand'
import { relative } from 'path'
const yarnBin = require.resolve(`${DIR_ROOT}/node_modules/.bin/yarn`)

export { link }

async function link(pkg: 'vite-plugin-ssr' | 'telefunc' | 'vite') {
  await runCommand(yarnBin, ['link'], { cwd: DIR_SRC, silent: true })
  const dependers = getDependers()
  for (const cwd of dependers) {
    await runCommand(yarnBin, ['link', pkg], {
      cwd,
      silent: true
    })
    /*
    await runCommand(yarnBin, ['link', 'vite'], {
      cwd,
      silent: true
    })
    //*/
    console.log(`symlink: /${relative(DIR_ROOT, cwd)}/node_modules/${pkg}`)
  }
}
