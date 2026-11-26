import { expect, test } from '@playwright/test'

test('the Concepts list leads through all eight Concepts in order, then to the Incident Lab', async ({ page }) => {
  await page.goto('concepts')
  const titles = [
    'The incident lifecycle',
    'Mitigate first, then investigate',
    'Observability: logs, metrics and traces',
    'Golden signals, SLOs and alerting',
    'Investigating by hypothesis',
    'Working safely in production',
    'Prevention: catching failures before users do',
    'Blameless postmortems',
  ]
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

test('the observability example asks which signal answers each question', async ({ page }) => {
  await page.goto('concepts/observability')
  const example = page.getByRole('region', { name: /Try it/ })
  const question = example.getByRole('group', { name: 'Why did this checkout fail?' })
  await question.getByRole('button', { name: 'Metrics' }).click()
  await expect(question).toContainText('Not quite')
  await question.getByRole('button', { name: 'Logs' }).click()
  await expect(question.getByRole('button', { name: 'Logs' })).toHaveAttribute('aria-pressed', 'true')
  await expect(question).toContainText('Right')
  await expect(example).toContainText('1 of 4 right')
})

test('the alerting example shows what a rule would have paged for', async ({ page }) => {
  await page.goto('concepts/golden-signals-and-alerting')
  const example = page.getByRole('region', { name: /Try it/ })
  await example.getByText('above 5%').click()
  await example.getByText('for 1 minute').click()
  await expect(example).toContainText('2 pages')
  await expect(example).toContainText('false page')
  await example.getByText('for 5 minutes').click()
  await expect(example.getByRole('radio', { name: 'for 5 minutes' })).toBeChecked()
  await expect(example).toContainText('1 page')
  await expect(example.getByRole('img', { name: /error rate/i })).toBeVisible()
})

test('the working-safely example sorts commands by what they can break', async ({ page }) => {
  await page.goto('concepts/working-safely-in-production')
  const example = page.getByRole('region', { name: /Try it/ })
  const item = example.getByRole('group', { name: /EXPLAIN ANALYZE DELETE/ })
  await item.getByRole('button', { name: 'Only reads' }).click()
  await expect(item).toContainText('really runs')
  await item.getByRole('button', { name: 'Destroys data' }).click()
  await expect(item).toContainText('Right')
})

test('the prevention example matches each Incident with the safeguard that would have caught it', async ({ page }) => {
  await page.goto('concepts/prevention')
  const example = page.getByRole('region', { name: /Try it/ })
  const badDeploy = example.getByRole('group', { name: 'Bad Deploy' })
  await badDeploy.getByRole('button', { name: 'Canary release' }).click()
  await expect(badDeploy).toContainText('synthetic checkout')
})

test('the postmortem example turns blame into a finding about the system', async ({ page }) => {
  await page.goto('concepts/blameless-postmortems')
  const example = page.getByRole('region', { name: /Try it/ })
  const sentence = example.getByRole('group', { name: /forgot to turn debug logging off/ })
  await sentence.getByRole('button', { name: 'Blames a person' }).click()
  await expect(sentence).toContainText('no owner or end time')
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
  await expect(kubernetes.getByRole('listitem')).toHaveCount(12)
  await expect(kubernetes).toContainText('why they disappear with the pod')
})
