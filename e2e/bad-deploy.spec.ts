import { expect, test, type Page } from '@playwright/test'

async function type(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: 'Command' })
  await input.fill(command)
  await input.press('Enter')
}

const output = (page: Page) => page.getByRole('log', { name: 'Terminal output' })

test('a Learner opens Bad Deploy from the Incident Lab and sees the alert', async ({ page }) => {
  await page.goto('lab')
  await page.getByRole('link', { name: /Bad Deploy/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Bad Deploy' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Alert' })).toContainText('PantryApiHighErrorRate')
})

test('typing the Expert Path captures evidence, mitigates and reaches every key finding', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  const findings = page.getByRole('complementary', { name: 'Findings' })
  const alert = page.getByRole('region', { name: 'Alert' })

  await type(page, 'kubectl get pods')
  await expect(output(page)).toContainText('pantry-api-6d8f9c7b54-7xk2p   1/1     Running')

  await type(page, 'kubectl rollout history deploy/pantry-api')
  await expect(output(page)).toContainText('42        release v2.14.0')

  await type(page, 'kubectl logs deployment/pantry-api --tail=20')
  await expect(output(page)).toContainText('ERR_INVALID_URL')

  await type(page, 'kubectl logs deployment/pantry-api > pantry-api-v2.14.0.log')
  await expect(page.getByRole('complementary', { name: 'Evidence' })).toContainText('saved pantry-api-v2.14.0.log')

  await expect(alert).toContainText('firing')
  await type(page, 'kubectl rollout undo deployment/pantry-api')
  await expect(output(page)).toContainText('This changes the Target System.')
  await expect(page.getByText('Proceed? [y/N]')).toBeVisible()
  await type(page, 'y')
  await expect(output(page)).toContainText('deployment.apps/pantry-api rolled back')
  await expect(alert).toContainText('resolved')
  await expect(page.getByRole('region', { name: 'Deploy history, pantry-api' })).toContainText('kubectl rollout undo')

  await type(page, 'grep -i warn pantry-api-v2.14.0.log')
  await expect(output(page)).toContainText('"key":"PAYMENTS_URL"')

  await type(page, 'kubectl rollout history deployment/pantry-api --revision=42')
  await expect(output(page)).toContainText('PAYMENT_SERVICE_URL:	http://payments')

  await expect(findings).toContainText('Findings 5 of 5')
})

test('rolling back before saving anything loses the evidence', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  await type(page, 'kubectl rollout undo deploy/pantry-api')
  await type(page, 'yes')
  await expect(output(page)).toContainText('Evidence lost')
  await expect(page.getByRole('complementary', { name: 'Evidence' })).toContainText('lost')
  await type(page, 'kubectl logs deploy/pantry-api')
  await expect(output(page)).not.toContainText('ERR_INVALID_URL')
})

test('answering no to a mutating command changes nothing', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  await type(page, 'kubectl delete deployment pantry-api')
  await type(page, 'n')
  await expect(output(page)).toContainText('Cancelled. Nothing was changed.')
  await expect(page.getByRole('region', { name: 'Alert' })).toContainText('about 9% of requests')
})

test('a harmful action takes the site down and restarting brings the Incident back', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  await type(page, 'kubectl delete deployment pantry-api')
  await type(page, 'y')
  const alert = page.getByRole('region', { name: 'Alert' })
  await expect(alert).toContainText('nginx answers every request with 503')
  await expect(output(page)).toContainText('the whole site is down')

  await page.getByRole('button', { name: 'Restart Incident' }).click()
  await page.getByRole('group', { name: 'Confirm restart' }).getByRole('button', { name: 'Restart' }).click()
  await expect(alert).toContainText('about 9% of requests')
  await expect(output(page)).not.toContainText('the whole site is down')
  await type(page, 'kubectl get pods')
  await expect(output(page)).toContainText('pantry-api-6d8f9c7b54-7xk2p')
})

test('a shell inside a container shows where you are and runs Linux tools', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  await type(page, 'kubectl exec -it pantry-api-6d8f9c7b54-7xk2p -- sh')
  await expect(page.getByText('root@pantry-api-6d8f9c7b54-7xk2p:/app#', { exact: true })).toBeVisible()
  await type(page, 'env | grep PAY')
  await expect(output(page)).toContainText('PAYMENT_SERVICE_URL=http://payments.payments.svc.cluster.local')
  await type(page, 'exit')
  await expect(page.getByText('you@laptop:~$', { exact: true }).last()).toBeVisible()
})

test('the dashboard shows the golden signals, deploys and a filterable log', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  const signals = page.getByRole('region', { name: 'Golden signals' })
  for (const title of ['Request rate', 'Error rate (5xx)', 'Latency, 95th percentile', 'Saturation (API CPU of limit)']) {
    await expect(signals.getByRole('figure', { name: new RegExp(title.replace(/[()]/g, '\\$&')) })).toBeVisible()
  }
  await expect(signals.getByRole('img').first()).toHaveAccessibleName(/v2\.14\.0 at 14:02/)

  const log = page.getByRole('region', { name: 'Load balancer access log (nginx)' })
  await log.getByRole('button', { name: '5xx' }).click()
  await expect(log.getByRole('row')).toHaveCount(1 + 6)
  await log.getByRole('button', { name: 'all' }).click()
  await log.getByRole('searchbox', { name: 'Search the access log' }).fill('/api/account')
  await expect(log.getByRole('row')).toHaveCount(1 + 1)
})

test('the terminal forgives typos, completes with Tab and recalls history', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  const input = page.getByRole('textbox', { name: 'Command' })

  await type(page, 'kubeclt get pods')
  await expect(output(page)).toContainText('Did you mean kubectl?')

  await type(page, 'kubectl get secrets')
  await expect(output(page)).toContainText('not simulated here')

  await input.fill('kubectl describe pod pantry-api-6d8f9c7b54-7')
  await input.press('Tab')
  await expect(input).toHaveValue('kubectl describe pod pantry-api-6d8f9c7b54-7xk2p ')

  await input.fill('')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('kubectl get secrets')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('kubeclt get pods')
  await input.press('ArrowDown')
  await expect(input).toHaveValue('kubectl get secrets')
})

test('an unknown Incident address shows not found', async ({ page }) => {
  await page.goto('lab/no-such-incident')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})
