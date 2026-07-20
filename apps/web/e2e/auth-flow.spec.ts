import { expect, test } from '@playwright/test';

test('unauthenticated home and login to console', async ({ page }) => {
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 401,
      body: JSON.stringify({ code: 101010, message: 'invalid', data: null }),
    });
  });
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        code: 0,
        message: '',
        data: {
          accessToken: 'access-token',
          user: { id: '00000000-0000-0000-0000-000000000001', username: 'zhangsan', email: 'user@example.com' },
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /VegaResume/ })).toBeVisible();
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByLabel('邮箱').fill('user@example.com');
  await page.getByLabel('密码').fill('password1');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page.getByText('zhangsan')).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
});
