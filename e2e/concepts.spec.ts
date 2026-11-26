import { expect, test } from '@playwright/test'

test('the Concepts list leads through all three Concepts in order, then to the Incident Lab', async ({ page }) => {
  await page.goto('concepts')
  const titles = ['The incident lifecycle', 'Mitigate first, then investigate', 'Investigating by hypothesis']
  await page.getByRole('link', { name: titles[0] }).click()
  for (const [i, title] of titles.entries()) {
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    const next = page.getByRole('navigation', { name: 'Next' }).getByRole('link')
    await expect(next).toContainText(titles[i + 1] ?? 'Work an Incident')
    await next.click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Incident Lab' })).toBeVisible()
})

test('a Concept links to the Incident that practises it and cites its sources', async ({ page }) => {
  await page.goto('concepts/mitigate-then-investigate')
  const sources = page.getByRole('region', { name: 'Resources' })
  await expect(sources.getByRole('link', { name: /Logging Architecture/ })).toHaveAttribute('href', /kubernetes\.io/)
  // Inline citations open the source in a new tab and say so.
  await expect(page.getByRole('link', { name: /Logging Architecture.*opens Kubernetes documentation in a new tab/ }).first()).toHaveAttribute(
    'target',
    '_blank',
  )
  await page.getByRole('region', { name: 'Practise it' }).getByRole('link', { name: 'Bad Deploy' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Bad Deploy' })).toBeVisible()
})

test('the lifecycle example shows each stage as it played out in Bad Deploy', async ({ page }) => {
  await page.goto('concepts/incident-lifecycle')
  const example = page.getByRole('region', { name: /Try it/ })
  await expect(example).toContainText('PantryApiHighErrorRate')
  await example.getByRole('button', { name: /Mitigate/ }).click()
  await expect(example.getByRole('button', { name: /Mitigate/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(example).toContainText('roll back to v2.13.1')
})

test('the mitigate-first example compares the cost of each order', async ({ page }) => {
  await page.goto('concepts/mitigate-then-investigate')
  const example = page.getByRole('region', { name: /Try it/ })
  await example.getByText('Roll back straight away').click()
  await expect(example).toContainText('Evidence: lost')
  await example.getByText('Save the logs, then roll back').click()
  await expect(example).toContainText('Evidence: kept')
  await expect(example).toContainText('6 minutes')
})

test('the hypothesis example rules guesses out by running checks', async ({ page }) => {
  await page.goto('concepts/investigating-by-hypothesis')
  const example = page.getByRole('region', { name: /Try it/ })
  await example.getByRole('button', { name: /Run the check for: The payments service is down/ }).click()
  await expect(example).toContainText('The request was never sent.')
  await expect(example).toContainText('1 ruled out, 0 supported, 2 left to test.')
})

test('an unknown Concept address shows not found', async ({ page }) => {
  await page.goto('concepts/no-such-concept')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})

test('Resources are grouped by subject, each with a reason to read it', async ({ page }) => {
  await page.goto('resources')
  for (const subject of ['Incident response', 'Troubleshooting method', 'Kubernetes', 'Postmortems']) {
    await expect(page.getByRole('heading', { level: 2, name: subject })).toBeVisible()
  }
  const kubernetes = page.getByRole('region', { name: 'Kubernetes' })
  await expect(kubernetes.getByRole('listitem')).toHaveCount(9)
  await expect(kubernetes).toContainText('why they disappear with the pod')
})
