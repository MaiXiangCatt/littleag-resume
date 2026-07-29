import { expect, test } from '@playwright/test';

test('guest resume persists locally, refreshes PDF preview and downloads the current PDF', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '进入游客模式' }).click();

  await expect(page).toHaveURL(/\/guest\/edit$/);
  await expect(page.getByText('游客模式')).toBeVisible();
  await expect(page.getByText('仅存此浏览器')).toBeVisible();

  const title = page.getByLabel('简历标题');
  await expect(title).toHaveValue('未命名简历');
  const initialPreview = page.locator('iframe[title^="游客 PDF 预览"]:visible');
  await expect(initialPreview).toBeVisible({ timeout: 30_000 });
  const initialSource = await initialPreview.getAttribute('src');

  await title.fill('游客前端简历');
  await page.getByLabel('姓名').fill('测试名字');
  await page.getByLabel('目标岗位').fill('全站开发工程师');
  await page.getByLabel('手机号').fill('12345');
  await page.getByLabel('邮箱').fill('guest@example.com');
  await expect
    .poll(async () => page.locator('iframe[title^="游客 PDF 预览"]:visible').getAttribute('src'), {
      timeout: 30_000,
    })
    .not.toBe(initialSource);

  await page.reload();
  await expect(page.getByLabel('简历标题')).toHaveValue('游客前端简历');
  await expect(page.getByLabel('姓名')).toHaveValue('测试名字');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('游客前端简历.pdf');
  await download.saveAs('test-results/guest-resume-current.pdf');

  const sansPreviewSource = await page
    .locator('iframe[title^="游客 PDF 预览"]:visible')
    .getAttribute('src');
  await page
    .locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles('src/pages/home/assets/hero.png');
  const cropDialog = page.getByRole('dialog', { name: '裁剪简历头像' });
  await expect(cropDialog).toBeVisible();
  await cropDialog.getByRole('button', { name: '确认头像' }).click();
  await expect(cropDialog).not.toBeVisible();

  await page.getByRole('button', { name: '排版设置' }).click();
  await page.getByRole('combobox', { name: '模板' }).click();
  await page.getByRole('option', { name: '经典专业' }).click();
  await page.getByRole('combobox', { name: '字体' }).click();
  await page.getByRole('option', { name: '思源宋体' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await expect
    .poll(async () => page.locator('iframe[title^="游客 PDF 预览"]:visible').getAttribute('src'), {
      timeout: 30_000,
    })
    .not.toBe(sansPreviewSource);

  const serifDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF' }).click();
  await (await serifDownloadPromise).saveAs('test-results/guest-resume-serif.pdf');
});

test('guest resume falls back to a temporary session when IndexedDB is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('blocked for test', 'InvalidStateError');
      },
    });
  });

  await page.goto('/guest/edit');

  await expect(page.getByRole('alert')).toContainText('当前是临时会话');
  await expect(page.getByText('仅本次会话')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试保存' })).toBeVisible();
});
