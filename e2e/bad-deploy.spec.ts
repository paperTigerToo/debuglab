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

test('typing the Expert Path reaches every key finding', async ({ page }) => {
  await page.goto('lab/bad-deploy')
  const findings = page.getByRole('complementary', { name: 'Findings' })

  await type(page, 'kubectl get pods')
  await expect(output(page)).toContainText('pantry-api-6d8f9c7b54-7xk2p   1/1     Running')

  await type(page, 'kubectl rollout history deploy/pantry-api')
  await expect(output(page)).toContainText('42        release v2.14.0')

  await type(page, 'kubectl logs deployment/pantry-api --tail=20')
  await expect(output(page)).toContainText('ERR_INVALID_URL')

  await type(page, 'kubectl logs deployment/pantry-api | grep -i warn')
  await expect(output(page)).toContainText('"key":"PAYMENTS_URL"')

  await type(page, 'kubectl describe deployment pantry-api')
  await expect(output(page)).toContainText('PAYMENT_SERVICE_URL:  http://payments')

  await expect(findings).toContainText('Findings 5 of 5')
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
