import { expect, test } from '@playwright/test'
import { finish, output, type } from './lab'

const DATA = '/var/lib/postgresql/data'

test('completing Full Disk by its Expert Path keeps the evidence and reaches a clean Debrief', async ({ page }) => {
  await page.goto('lab')
  await page.getByRole('link', { name: /Full Disk/ }).click()
  const alert = page.getByRole('region', { name: 'Alert' })
  await expect(alert).toContainText('about 11% of requests')
  await expect(page.getByRole('figure', { name: /Saturation \(database disk used\)/ })).toBeVisible()

  await type(page, 'kubectl logs deployment/pantry-api --tail=20')
  await expect(output(page)).toContainText('No space left on device')

  await type(page, 'kubectl exec postgres-0 -- df -h')
  await expect(output(page)).toContainText(`100% ${DATA}`)

  await type(page, `kubectl exec postgres-0 -- sh -c 'du -sh ${DATA}/*'`)
  await expect(output(page)).toContainText(`${DATA}/log`)

  await type(page, `kubectl exec postgres-0 -- ls -lh ${DATA}/log | tee postgres-log-files.txt`)
  await expect(page.getByRole('complementary', { name: 'Evidence' })).toContainText('saved postgres-log-files.txt')

  await type(page, `kubectl exec postgres-0 -- cat ${DATA}/postgresql.auto.conf`)
  await expect(output(page)).toContainText("log_min_duration_statement = '0'")

  await type(page, `kubectl exec postgres-0 -- sh -c 'rm ${DATA}/log/*.log'`)
  await type(page, 'y')
  await expect(alert).toContainText('resolved')
  await expect(page.getByRole('complementary', { name: 'Findings' })).toContainText('Findings 5 of 5')

  await finish(page, /log_min_duration_statement was set to 0/, /Delete the old PostgreSQL log files/)
  await expect(page.getByRole('region', { name: 'You stopped the harm' })).toContainText('The right first move')
  await expect(page.getByRole('region', { name: 'You found the Root Cause' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Expert Path' }).getByLabel('missed')).toHaveCount(0)
})

test('deleting pg_wal to free space takes PostgreSQL down', async ({ page }) => {
  await page.goto('lab/full-disk')
  await type(page, 'kubectl exec -it postgres-0 -- sh')
  await type(page, `rm -rf ${DATA}/pg_wal/*`)
  await expect(output(page)).toContainText('This changes the Target System.')
  await type(page, 'y')
  await expect(output(page)).toContainText('renamed')
  await expect(page.getByRole('region', { name: 'Alert' })).toContainText('PostgreSQL is down')
})
