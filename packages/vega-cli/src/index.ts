#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runVega } from './cli'

export { runVega }

export function isDirectRun(importMetaUrl: string, argvEntry: string | undefined): boolean {
  if (!argvEntry) {
    return false
  }

  try {
    return realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(argvEntry)
  } catch {
    return importMetaUrl === pathToFileURL(argvEntry).href
  }
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  runVega(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode
  })
}
