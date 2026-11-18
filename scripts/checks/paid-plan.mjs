// Added `paid-plan` marks cite a decision (ADR-0056), with the format of `pnpm debt`.
import { findMarks } from '../debt/debt.mjs'

export const name = 'paid-plan marks'

// Same exclusions as `pnpm debt`: docs show the mark with placeholders, scripts/debt/ holds bad samples.
const isSkipped = (file) => /\.(md|html)$/.test(file) || file.startsWith('scripts/debt/')

export function paidPlanErrors(addedLines) {
  return addedLines
    .filter(({ file }) => !isSkipped(file))
    .flatMap(({ file, line, text }) =>
      findMarks(text)
        .filter((mark) => !mark.valid)
        .map(({ mark }) => `${file}:${line}: malformed ${mark}, expected ADR-NNNN or DNN inside`),
    )
}

export function check(ctx) {
  return { errors: paidPlanErrors(ctx.addedLines()) }
}
