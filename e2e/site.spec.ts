import { expect, test } from '@playwright/test'

test('home page offers the four areas and navigation reaches each', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('debug a live service')
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const name of ['Concepts', 'Playbook', 'Incident Lab', 'Resources']) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
  }
})

test('a deep link loads directly and survives a refresh', async ({ page }) => {
  const response = await page.goto('playbook')
  // GitHub Pages answers unknown paths with 404.html; the app must still render the right page.
  expect([200, 404]).toContain(response?.status())
  await expect(page.getByRole('heading', { level: 1, name: 'Playbook' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Playbook' })).toBeVisible()
})

test('an unknown address shows a not-found page', async ({ page }) => {
  await page.goto('no/such/page')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})

test('theme starts dark, toggles to light and is remembered', async ({ page }) => {
  await page.goto('./')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
})

test('the site works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Concepts' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Concepts' })).toBeVisible()
})
