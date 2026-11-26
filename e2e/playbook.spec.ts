import { expect, test } from '@playwright/test'

test('the Playbook groups its Entries by layer, showing only layers that have some', async ({ page }) => {
  await page.goto('playbook')
  for (const layer of ['Cluster', 'Container', 'Database', 'Application']) {
    await expect(page.getByRole('heading', { level: 2, name: layer })).toBeVisible()
  }
  await expect(page.getByRole('heading', { level: 2, name: 'Network' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Cluster' }).getByRole('link')).toHaveCount(3)
  await expect(page.getByRole('region', { name: 'Database' }).getByRole('link')).toHaveCount(4)
})

test('searching by command finds the Entry, and opening it shows its parts', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('playbook')
  await page.getByRole('searchbox', { name: 'Search the Playbook' }).fill('rollout undo')
  const results = page.getByRole('main').getByRole('link')
  await expect(results).toHaveCount(1)
  await results.first().click()

  await expect(page.getByRole('heading', { level: 1, name: 'How do I roll back a Deployment?' })).toBeVisible()
  const command = page.getByRole('listitem').filter({ hasText: 'kubectl rollout undo deployment/pantry-api --to-revision=41' })
  await expect(command).toContainText('Changes the system')
  await command.getByRole('button', { name: /Copy/ }).click()
  await expect(command.getByRole('button', { name: /Copied/ })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('kubectl rollout undo deployment/pantry-api --to-revision=41')
  await expect(page.getByRole('listitem').filter({ hasText: 'kubectl rollout status' })).toContainText('Read-only')

  await expect(page.getByRole('region', { name: 'Rolled back' })).toContainText('successfully rolled out')
  await expect(page.getByRole('region', { name: 'Stuck' })).toContainText('exceeded its progress deadline')
  await page.getByRole('region', { name: 'What to ask next' }).getByRole('link', { name: 'Are the pods running, and since when?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Are the pods running, and since when?' })).toBeVisible()
})

test('searching by question or by another spelling of a term finds the Entry', async ({ page }) => {
  await page.goto('playbook')
  const search = page.getByRole('searchbox', { name: 'Search the Playbook' })
  await search.fill('keep the Evidence')
  await expect(page.getByRole('main').getByRole('link')).toHaveText(['How do I keep the Evidence before changing anything?'])
  // printenv is another name for env, which the configuration Entry uses.
  await search.fill('printenv')
  await expect(page.getByRole('main').getByRole('link')).toHaveText(['What configuration is a container running with?'])
  await search.fill('nothing matches this')
  await expect(page.getByRole('main')).toContainText('No Playbook Entry matches')
})

test('a search survives a reload, and an Entry deep link loads directly', async ({ page }) => {
  await page.goto('playbook?q=logs')
  await expect(page.getByRole('searchbox', { name: 'Search the Playbook' })).toHaveValue('logs')
  await page.goto('playbook/how-do-i-keep-the-evidence')
  await expect(page.getByRole('heading', { level: 1, name: 'How do I keep the Evidence before changing anything?' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Used in' }).getByRole('link', { name: 'Bad Deploy' })).toBeVisible()
  await page.goto('playbook/no-such-entry')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})
