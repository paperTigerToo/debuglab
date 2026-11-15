import { devices, expect, test, type Page } from '@playwright/test'

const running = (page: Page) => page.evaluate(() => document.getAnimations().length)

async function runCommand(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: 'Command' })
  await input.fill(command)
  await input.press('Enter')
}

/**
 * Watches what Motion writes. Motion animates on the main thread, so document.getAnimations() cannot
 * see it; instead this records every value each element's style and SVG drawing attributes pass
 * through. An animation steps one attribute through many values; setting a final value once does not.
 */
async function watchMotion(page: Page) {
  await page.addInitScript(() => {
    const seen = new Map<string, Set<string | null>>()
    const ids = new WeakMap<Node, number>()
    let next = 0
    ;(window as unknown as { motionSteps: () => number }).motionSteps = () => Math.max(0, ...[...seen.values()].map((v) => v.size))
    new MutationObserver((records) => {
      for (const r of records) {
        if (!ids.has(r.target)) ids.set(r.target, next++)
        const key = `${ids.get(r.target)}:${r.attributeName}`
        const values = seen.get(key) ?? new Set()
        values.add((r.target as Element).getAttribute(r.attributeName!))
        seen.set(key, values)
      }
    }).observe(document, { subtree: true, attributeFilter: ['style', 'stroke-dasharray', 'stroke-dashoffset', 'd'] })
  })
}
/** The most values any one element's attribute has passed through. */
const motionSteps = (page: Page) => page.evaluate(() => (window as unknown as { motionSteps: () => number }).motionSteps())

async function openLabAndAskForAHint(page: Page) {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Incident Lab' }).click()
  await page.getByRole('link', { name: /Bad Deploy/ }).click()
  await page.getByRole('complementary', { name: 'Hint' }).getByRole('button', { name: 'Ask for a Hint' }).click()
}

test('with motion allowed, pages, graphs, Hints and the alert all animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await watchMotion(page)
  await openLabAndAskForAHint(page)
  // CSS: the Hint rises in, and the firing alert pulses for as long as it fires.
  const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName))
  expect(names).toEqual(expect.arrayContaining(['rise', 'alert-pulse']))
  // Motion: the page transition and the graphs drawing in.
  await expect.poll(() => motionSteps(page)).toBeGreaterThan(5)
})

test('reduced motion switches every animation off, CSS and Motion alike', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await watchMotion(page)
  await openLabAndAskForAHint(page)
  expect(await running(page)).toBe(0)
  await runCommand(page, 'kubectl get pods')
  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('pantry-api-6d8f9c7b54-zr8vn')
  expect(await running(page)).toBe(0)
  // Give any Motion animation time to run. Final values may be set once, but nothing may step through frames.
  await page.waitForTimeout(800)
  expect(await motionSteps(page)).toBeLessThanOrEqual(1)
})

test.describe('on a phone', () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 5']
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch })

  test('the reading pages fit the screen without sideways scrolling', async ({ page }) => {
    for (const path of ['./', 'concepts', 'concepts/investigating-by-hypothesis', 'playbook', 'playbook/what-is-the-application-logging', 'resources']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })

  test('the Incident Lab says it needs a keyboard and a larger screen, and can still be opened', async ({ page }) => {
    await page.goto('lab/bad-deploy')
    const notice = page.getByRole('region', { name: 'Best on a computer' })
    await expect(notice).toContainText('keyboard')
    await expect(page.getByRole('textbox', { name: 'Command' })).toHaveCount(0)
    await expect(notice.getByRole('link', { name: 'Read the Concepts' })).toBeVisible()
    await notice.getByRole('button', { name: 'Open it anyway' }).click()
    await expect(page.getByRole('textbox', { name: 'Command' })).toBeVisible()
  })
})
