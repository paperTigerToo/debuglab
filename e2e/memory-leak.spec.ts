import { expect, test } from '@playwright/test'
import { finish, output, type } from './lab'

test('a Learner opens Memory Leak and sees the restart alert and a memory graph', async ({ page }) => {
  await page.goto('lab')
  await page.getByRole('link', { name: /Memory Leak/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Memory Leak' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Alert' })).toContainText('PantryApiRestarting')
  await expect(page.getByRole('figure', { name: /Saturation \(API memory of limit/ })).toBeVisible()
})

test('completing Memory Leak by its Expert Path keeps the evidence and reaches a clean Debrief', async ({ page }) => {
  await page.goto('lab/memory-leak')
  const alert = page.getByRole('region', { name: 'Alert' })

  await type(page, 'kubectl get pods')
  await expect(output(page)).toContainText('5 (6m ago)')

  await type(page, 'kubectl describe pod pantry-api-7f9c6d5b48-n2x8v')
  await expect(output(page)).toContainText('OOMKilled')

  await type(page, 'kubectl top pods')
  await expect(output(page)).toContainText('487Mi')

  await type(page, 'kubectl rollout history deploy/pantry-api')
  await expect(output(page)).toContainText('cache product search results')

  await type(page, 'kubectl exec pantry-api-7f9c6d5b48-n2x8v -- curl -s localhost:8080/metrics > pantry-api-metrics.txt')
  await expect(page.getByRole('complementary', { name: 'Evidence' })).toContainText('saved pantry-api-metrics.txt')

  await expect(alert).toContainText('firing')
  await type(page, 'kubectl rollout undo deployment/pantry-api')
  await type(page, 'y')
  await expect(alert).toContainText('resolved')

  await type(page, 'grep search_cache pantry-api-metrics.txt')
  await expect(output(page)).toContainText('pantry_search_cache_evictions_total 0')
  await expect(page.getByRole('complementary', { name: 'Findings' })).toContainText('Findings 5 of 5')

  await finish(page, /no size limit or expiry/, /Roll back pantry-api to v2\.14\.1/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Debrief')
  await expect(page.getByRole('region', { name: 'You stopped the harm' })).toContainText('The right first move')
  await expect(page.getByRole('region', { name: 'You found the Root Cause' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Expert Path' }).getByLabel('missed')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Evidence' })).toContainText('kept')
})

test('restarting stops the kills for now, but throws away the leaking memory', async ({ page }) => {
  await page.goto('lab/memory-leak')
  await type(page, 'kubectl rollout restart deployment/pantry-api')
  await type(page, 'y')
  await expect(output(page)).toContainText('Evidence lost')
  await expect(page.getByRole('region', { name: 'Alert' })).toContainText('for now')
  await type(page, 'kubectl logs pantry-api-6b8d9c4f72-hm4qx --previous')
  await expect(output(page)).toContainText('previous terminated container "api"')
})
