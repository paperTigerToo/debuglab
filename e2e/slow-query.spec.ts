import { expect, test } from '@playwright/test'
import { finish, output, type } from './lab'

const ACTIVITY = "SELECT pid, now() - query_start AS runtime, wait_event, query FROM pg_stat_activity WHERE state = 'active'"

test('completing Slow Query by its Expert Path keeps the evidence and reaches a clean Debrief', async ({ page }) => {
  await page.goto('lab')
  await page.getByRole('link', { name: /Slow Query/ }).click()
  const alert = page.getByRole('region', { name: 'Alert' })
  await expect(alert).toContainText('PantryApiHighLatency')

  await type(page, 'kubectl top pods')
  await expect(output(page)).toContainText('1987m')

  await type(page, 'kubectl logs postgres-0 --tail=20')
  await expect(output(page)).toContainText('duration:')

  await type(page, `kubectl exec postgres-0 -- psql -U pantry -c "${ACTIVITY}" | tee active-queries.txt`)
  await expect(output(page)).toContainText('(17 rows)')
  await expect(page.getByRole('complementary', { name: 'Evidence' })).toContainText('saved active-queries.txt')

  await type(page, 'kubectl exec postgres-0 -- psql -U pantry -c "\\d orders"')
  await expect(output(page)).toContainText('"orders_created_at_idx" btree (created_at)')

  await type(page, 'kubectl rollout history deployment/pantry-api')
  await expect(output(page)).toContainText('migration 0042 drops unused indexes')

  // Typed with a closing semicolon, as people do.
  await type(page, 'kubectl exec postgres-0 -- psql -U pantry -c "CREATE INDEX CONCURRENTLY orders_customer_id_idx ON orders (customer_id);"')
  await expect(output(page)).toContainText('This changes the Target System.')
  await type(page, 'y')
  await expect(alert).toContainText('resolved')
  await expect(page.getByRole('complementary', { name: 'Findings' })).toContainText('Findings 5 of 5')

  await finish(page, /dropped orders_customer_id_idx/, /CREATE INDEX CONCURRENTLY/)
  await expect(page.getByRole('region', { name: 'You stopped the harm' })).toContainText('The right first move')
  await expect(page.getByRole('region', { name: 'You found the Root Cause' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Expert Path' }).getByLabel('missed')).toHaveCount(0)
})

test('rolling back pantry-api does not bring the index back', async ({ page }) => {
  await page.goto('lab/slow-query')
  await type(page, 'kubectl rollout undo deployment/pantry-api')
  await type(page, 'y')
  await expect(output(page)).toContainText('restores the code, not the database')
  await expect(page.getByRole('region', { name: 'Alert' })).toContainText('Still slow after the rollback')
})

test('a shell in postgres-0 runs psql, whatever the flag order', async ({ page }) => {
  await page.goto('lab/slow-query')
  await type(page, 'kubectl exec -it postgres-0 -- sh')
  await type(
    page,
    "psql -c 'EXPLAIN ANALYZE SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = 48213 ORDER BY created_at DESC LIMIT 10' -U pantry",
  )
  await expect(output(page)).toContainText('Parallel Seq Scan on orders')
})
