// What a Learner does in the Incident Lab, shared by the browser tests of every Incident.
import type { Page } from '@playwright/test'

/** Type a command into the terminal and run it. */
export async function type(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: 'Command' })
  await input.fill(command)
  await input.press('Enter')
}

export const output = (page: Page) => page.getByRole('log', { name: 'Terminal output' })

/** Declare the Root Cause and the Mitigation, and open the Debrief. */
export async function finish(page: Page, rootCause: RegExp, mitigation: RegExp) {
  await page.getByRole('button', { name: /finish the Incident/ }).click()
  const form = page.getByRole('form', { name: 'Finish the Incident' })
  await form.getByRole('radio', { name: rootCause }).check()
  await form.getByRole('radio', { name: mitigation }).check()
  await form.getByRole('button', { name: 'Finish and see the Debrief' }).click()
}
