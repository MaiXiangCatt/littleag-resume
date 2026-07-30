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
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            username: 'zhangsan',
            email: 'user@example.com',
          },
        },
      }),
    });
  });
  await page.route('**/api/resumes/stats', (route) =>
    route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        code: 0,
        message: '',
        data: { total: 0, draft: 0, completed: 0, exported: 0 },
      }),
    }),
  );
  await page.route('**/api/resumes?**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        code: 0,
        message: '',
        data: { items: [], page: 1, pageSize: 6, total: 0 },
      }),
    }),
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /LittleAgResume/ })).toBeVisible();
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByLabel('邮箱').fill('user@example.com');
  await page.getByLabel('密码', { exact: true }).fill('password1');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page.getByText('zhangsan')).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
});

test('silver challenge issues a one-time invitation for registration', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:5173',
  });
  const invitationCode = 'ABCD-EFGH-JKLM-NPQR';
  let invitationConsumed = false;

  async function configurePage(targetPage: typeof page) {
    await targetPage.route('**/api/auth/refresh', (route) =>
      route.fulfill({
        contentType: 'application/json',
        status: 401,
        body: JSON.stringify({ code: 101010, message: 'invalid', data: null }),
      }),
    );
    await targetPage.route('**/api/auth/registration-policy', (route) =>
      route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: '',
          data: { mode: 'invite', challengeAvailable: true },
        }),
      }),
    );
    await targetPage.route('**/api/auth/invitation-challenge', (route) =>
      route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: '',
          data: { challengeId: 'yi-ci-lin-qing', prompt: '异次临倾，' },
        }),
      }),
    );
    await targetPage.route('**/api/auth/invitation-challenge/answer', (route) =>
      route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: '',
          data: { invitationCode, expiresInSeconds: 1800 },
        }),
      }),
    );
    await targetPage.route('**/api/auth/registration-email-verification', async (route) => {
      const request = route.request().postDataJSON() as {
        email: string;
        invitationCode?: string;
      };
      expect(request.invitationCode).toBe(invitationCode);
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: '',
          data: {
            email: request.email,
            expiresInSeconds: 600,
            resendAfterSeconds: 60,
          },
        }),
      });
    });
    await targetPage.route('**/api/auth/register', async (route) => {
      const request = route.request().postDataJSON() as {
        invitationCode?: string;
        verificationCode: string;
      };
      expect(request.invitationCode).toBe(invitationCode);
      expect(request.verificationCode).toBe('123456');
      if (invitationConsumed) {
        await route.fulfill({
          contentType: 'application/json',
          status: 400,
          body: JSON.stringify({ code: 101014, message: '邀请码无效或已过期', data: null }),
        });
        return;
      }
      invitationConsumed = true;
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: '',
          data: {
            accessToken: 'access-token',
            user: {
              id: '00000000-0000-0000-0000-000000000001',
              username: 'first-user',
              email: 'first@example.com',
              emailVerified: true,
            },
          },
        }),
      });
    });
    await targetPage.route('**/api/resumes/stats', (route) =>
      route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: '',
          data: { total: 0, draft: 0, completed: 0, exported: 0 },
        }),
      }),
    );
    await targetPage.route('**/api/resumes?**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: '',
          data: { items: [], page: 1, pageSize: 6, total: 0 },
        }),
      }),
    );
  }

  await configurePage(page);
  await page.goto('/');
  const agTrigger = page.getByRole('button', { name: 'Ag' });
  for (let click = 0; click < 9; click += 1) {
    await agTrigger.click();
  }
  await expect(page.getByText('异次临倾，')).toBeVisible();
  await page.getByLabel('接下一句').fill('步步唯银');
  await page.getByRole('button', { name: '对暗号' }).click();
  await expect(page.getByLabel('一次性邀请码')).toHaveValue(invitationCode);
  await page.getByRole('button', { name: '复制邀请码' }).click();
  await page.getByRole('button', { name: '去注册' }).click();
  const pastedInvitation = await page.evaluate(() => navigator.clipboard.readText());
  expect(pastedInvitation).toBe(invitationCode);
  await completeInvitationRegistration(page, {
    email: 'first@example.com',
    invitationCode: pastedInvitation,
    username: 'first-user',
  });
  await expect(page).toHaveURL(/\/console$/);

  const secondPage = await context.newPage();
  await configurePage(secondPage);
  await secondPage.goto('/');
  await secondPage.getByRole('button', { name: '免费开始', exact: true }).click();
  await completeInvitationRegistration(secondPage, {
    email: 'second@example.com',
    invitationCode,
    username: 'second-user',
  });
  await expect(secondPage.getByText('邀请码无效或已过期')).toBeVisible();
  await expect(secondPage).toHaveURL(/\/$/);
});

async function completeInvitationRegistration(
  page: import('@playwright/test').Page,
  values: { email: string; invitationCode: string; username: string },
) {
  await page.getByLabel('邀请码').fill(values.invitationCode);
  await page.getByLabel('邮箱').fill(values.email);
  await page.getByRole('checkbox', { name: '同意用户服务协议及内容规则和隐私政策' }).check();
  await page.getByRole('checkbox', { name: '单独同意个人信息跨境处理说明' }).check();
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await page.getByLabel('用户名').fill(values.username);
  await page.getByLabel('密码', { exact: true }).fill('password1');
  await page.getByLabel('确认密码').fill('password1');
  await page.getByLabel('邮箱验证码').fill('123456');
  await page.getByRole('button', { name: '验证并创建账号' }).click();
}
