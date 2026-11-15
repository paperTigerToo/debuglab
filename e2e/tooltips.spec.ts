import { expect, test } from '@playwright/test'

const tooltip = (page: import('@playwright/test').Page) => page.locator('[role="tooltip"]')

test('hovering a term shows its explanation, and moving away hides it', async ({ page }) => {
  await page.goto('./')
  const term = page.getByRole('button', { name: 'Mitigation' })
  await term.hover()
  await expect(tooltip(page)).toContainText('stops user harm without explaining the failure')
  await page.mouse.move(0, 0)
  await expect(tooltip(page)).toHaveCount(0)
})

test('a term reached by keyboard shows its explanation and announces it', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  const term = page.getByRole('region', { name: 'Alert' }).getByRole('button', { name: '5xx' })
  await term.focus()
  await expect(tooltip(page)).toContainText('HTTP status codes from 500 to 599')
  await expect(term).toHaveAccessibleDescription(/HTTP status codes from 500 to 599/)
  await page.keyboard.press('Escape')
  await expect(tooltip(page)).toHaveCount(0)
})

test('tapping a term keeps it open until tapped again', async ({ page }) => {
  await page.goto('./')
  const term = page.getByRole('button', { name: 'Root Cause' })
  await term.click()
  await page.mouse.move(0, 0)
  await expect(tooltip(page)).toContainText('specific defect or condition')
  await term.click()
  await expect(tooltip(page)).toHaveCount(0)
})

test('terms in simulated terminal output carry the same explanation as everywhere else', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  const input = page.getByRole('textbox', { name: 'Command' })
  await input.fill('kubectl get pods')
  await input.press('Enter')
  const output = page.getByRole('log', { name: 'Terminal output' })
  await output.getByRole('button', { name: 'RESTARTS' }).hover()
  await expect(tooltip(page)).toContainText('crash loop')
  // Clicking a term in the terminal does not steal it away to the command line.
  await output.getByRole('button', { name: 'RESTARTS' }).click()
  await page.mouse.move(0, 0)
  await expect(tooltip(page)).toContainText('crash loop')
  await expect(page.getByRole('textbox', { name: 'Command' })).not.toBeFocused()
})

test('Escape closes a tooltip opened by hovering', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Mitigation' }).hover()
  await expect(tooltip(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tooltip(page)).toHaveCount(0)
})

test('a term is marked once across the whole terminal, not on every line', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  const input = page.getByRole('textbox', { name: 'Command' })
  await input.fill('kubectl get pods')
  await input.press('Enter')
  const output = page.getByRole('log', { name: 'Terminal output' })
  await expect(output.getByRole('button', { name: 'Running' })).toHaveCount(1)
})

test('a tooltip links to the Concept that explains its term, by pointer', async ({ page }) => {
  await page.goto('./')
  const term = page.getByRole('button', { name: 'Mitigation' })
  await term.hover()
  // Moving from the term into the tooltip keeps it open.
  await page.getByRole('link', { name: /Read the Concept: Mitigate first/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mitigate first, then investigate' })).toBeVisible()
})

test('a tooltip link is reachable by keyboard, and Tab moves on past it', async ({ page }) => {
  await page.goto('./')
  const term = page.getByRole('button', { name: 'Mitigation' })
  await expect(term).toHaveAccessibleDescription(/More in the Concept: Mitigate first, then investigate/)
  await term.focus()
  await page.keyboard.press('Enter')
  const link = page.getByRole('link', { name: /Read the Concept: Mitigate first/ })
  await expect(link).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(term).toBeFocused()
  await expect(tooltip(page)).toHaveCount(0)

  await page.keyboard.press('Enter')
  await expect(link).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(tooltip(page)).toHaveCount(0)
  // Focus moves on to what follows the term in the page: the first area card.
  await expect(page.locator(':focus')).toHaveAttribute('href', /\/concepts$/)
})
