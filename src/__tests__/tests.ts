import * as fs from 'fs'
import ts from 'typescript'
import { softMerge } from '..'

describe('soft-merge', () => {
  for (let d of fs.readdirSync(__dirname + '/cases')) {
    d = __dirname + '/cases/' + d
    if (!fs.statSync(d).isDirectory()) continue
    for (let entry of fs.readdirSync(d)) {
      const m = entry.match(/^((.*)\.1\.(tsx?))\.txt$/)
      if (!m) continue

      const [, srcName, baseName, ext] = m

      test(baseName, () => {
        const input1Fn = `${d}/${baseName}.1.${ext}.txt`
        const input2Fn = `${d}/${baseName}.2.${ext}.txt`
        const approvedFn = `${d}/${baseName}.m.${ext}.approved.txt`
        const receivedFn = `${d}/${baseName}.m.${ext}.received.txt`

        const input1 = fs.readFileSync(input1Fn).toString().trimEnd()
        const input2 = fs.readFileSync(input2Fn).toString().trimEnd()
        const approved =
          fs.existsSync(approvedFn) && fs.readFileSync(approvedFn).toString()

        let output: string
        try {
          output = softMerge(srcName, input1, input2)
        } catch (e) {
          output = e.stack
        }

        const received = `${input1}\n+++ (2)\n${input2}\n===\n${output}`

        if (received !== approved) {
          fs.writeFileSync(receivedFn, received)
          throw 'Please approve'
        } else {
          if (fs.existsSync(receivedFn)) fs.unlinkSync(receivedFn)
        }
      })
    }
  }
})
