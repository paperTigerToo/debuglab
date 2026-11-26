import { expect, test } from '@playwright/test'
import { finish, output, type } from './lab'

const STUCK = "SELECT pid, client_addr, now() - xact_start AS in_transaction, query FROM pg_stat_activity WHERE state = 'idle in transaction'"

test('completing Connection Pool Exhaustion by its Expert Path keeps the evidence and reaches a clean Debrief', async ({ page }) => {
  await page.goto('lab')
  await page.getByRole('link', { name: /Connection Pool Exhaustion/ }).click()
  const alert = page.getByRole('region', { name: 'Alert' })
  await expect(alert).toContainText('about 41% of requests')
  await expect(page.getByRole('figure', { name: /Saturation \(API database connections in use\)/ })).toBeVisible()

  await type(page, 'kubectl top pods')
  await expect(output(page)).toContainText('27m')

  await type(page, 'kubectl logs deployment/pantry-api --tail=20')
  await expect(output(page)).toContainText('timed out waiting for a database connection')

  // Typed in lower case with a closing semicolon, as people do.
  await type(page, `kubectl exec postgres-0 -- psql -U pantry -c "${STUCK.replace('SELECT', 'select')};" | tee stuck-transactions.txt`)
  await expect(output(page)).toContainText('(30 rows)')
  await expect(page.getByRole('complementary', { name: 'Evidence' })).toContainText('saved stuck-transactions.txt')

  await type(page, 'kubectl logs deployment/pantry-api | grep payments')
  await expect(output(page)).toContainText('payments request slow')

  await type(page, 'kubectl describe deployment pantry-api')
  await expect(output(page)).toContainText('PAYMENTS_TIMEOUT_MS:')

  await type(page, 'kubectl set env deployment/pantry-api PAYMENTS_TIMEOUT_MS=2000')
  await type(page, 'y')
  await expect(alert).toContainText('resolved')
  await expect(page.getByRole('complementary', { name: 'Findings' })).toContainText('Findings 5 of 5')

  await finish(page, /holds a database connection in an open transaction/, /Lower the payments timeout/)
  await expect(page.getByRole('region', { name: 'You stopped the harm' })).toContainText('The right first move')
  await expect(page.getByRole('region', { name: 'You found the Root Cause' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Expert Path' }).getByLabel('missed')).toHaveCount(0)
})

test('the dashboard shows nothing was deployed, and the health check still passes', async ({ page }) => {
  await page.goto('lab/connection-pool-exhaustion')
  await expect(page.getByRole('region', { name: 'Deploy history, pantry-api' })).toContainText('Tue 24 Nov')
  await type(page, 'curl https://pantry.example.com/healthz')
  await expect(output(page)).toContainText('"status":"ok"')
  await type(page, 'curl https://pantry.example.com/api/products?category=bakery')
  await expect(output(page)).toContainText('POOL_TIMEOUT')
})
