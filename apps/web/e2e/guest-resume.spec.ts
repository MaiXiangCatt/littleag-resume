import { readFile } from 'node:fs/promises';

import { devices, expect, test, type Locator, type Page } from '@playwright/test';

test('guest resume persists locally, refreshes PDF preview and downloads the current PDF', async ({
  page,
}, testInfo) => {
  const workerRequests: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('pdf.worker')) workerRequests.push(response.url());
  });
  await page.goto('/');
  expect(workerRequests).toHaveLength(0);
  await page.getByRole('button', { name: '进入游客模式' }).click();

  await expect(page).toHaveURL(/\/guest\/edit$/);
  await expect(page.getByText('游客模式')).toBeVisible();
  await expect(page.getByText('仅存此浏览器')).toBeVisible();

  const title = page.getByLabel('简历标题');
  await expect(title).toHaveValue('未命名简历');
  const initialPreview = visibleCanvasPreview(page);
  await expect(initialPreview).toBeVisible({ timeout: 30_000 });
  const initialKey = await initialPreview.getAttribute('data-preview-key');
  await expect(initialPreview.getByRole('img', { name: 'PDF 第 1 页预览' })).toHaveAttribute(
    'data-rendered',
    'true',
    { timeout: 30_000 },
  );
  await expect.poll(() => workerRequests.length).toBeGreaterThan(0);
  await expect(page.locator('iframe, object, embed')).toHaveCount(0);

  await title.fill('游客前端简历');
  await page.getByLabel('姓名').fill('测试名字');
  await page.getByLabel('目标岗位').fill('全站开发工程师');
  await page.getByLabel('手机号').fill('12345');
  await page.getByLabel('邮箱').fill('guest@example.com');
  await expect
    .poll(async () => visibleCanvasPreview(page).getAttribute('data-preview-key'), {
      timeout: 30_000,
    })
    .not.toBe(initialKey);
  await expect
    .poll(() =>
      canvasHasInk(visibleCanvasPreview(page).getByRole('img', { name: 'PDF 第 1 页预览' })),
    )
    .toBe(true);

  await page.reload();
  await expect(page.getByLabel('简历标题')).toHaveValue('游客前端简历');
  await expect(page.getByLabel('姓名')).toHaveValue('测试名字');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('游客前端简历.pdf');
  const currentPdfPath = testInfo.outputPath('guest-resume-current.pdf');
  await download.saveAs(currentPdfPath);
  expect((await readFile(currentPdfPath)).subarray(0, 4).toString()).toBe('%PDF');

  const sansPreviewKey = await visibleCanvasPreview(page).getAttribute('data-preview-key');
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
    .poll(async () => visibleCanvasPreview(page).getAttribute('data-preview-key'), {
      timeout: 30_000,
    })
    .not.toBe(sansPreviewKey);

  const serifDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF' }).click();
  await (await serifDownloadPromise).saveAs(testInfo.outputPath('guest-resume-serif.pdf'));

  await page.getByRole('button', { name: '个人简介', exact: true }).click();
  await page
    .getByRole('textbox', { name: '简介内容' })
    .fill(
      Array.from(
        { length: 90 },
        (_, index) => `- 第 ${index + 1} 项：用于验证游客简历 Canvas 多页预览的长内容。`,
      ).join('\n'),
    );
  await expect
    .poll(async () => visibleCanvasPreview(page).locator('canvas').count(), { timeout: 30_000 })
    .toBeGreaterThan(1);
  const lastCanvas = visibleCanvasPreview(page).locator('canvas').last();
  await lastCanvas.scrollIntoViewIfNeeded();
  await expect(lastCanvas).toHaveAttribute('data-rendered', 'true', { timeout: 30_000 });
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

test.describe('mobile guest PDF canvas', () => {
  test.use({
    deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
    hasTouch: devices['Pixel 7'].hasTouch,
    isMobile: devices['Pixel 7'].isMobile,
    userAgent: devices['Pixel 7'].userAgent,
    viewport: devices['Pixel 7'].viewport,
  });

  test('renders PDF pixels without an Android browser placeholder', async ({ page }) => {
    await page.goto('/guest/edit');
    await page.getByLabel('姓名').fill('移动端测试');

    const preview = visibleCanvasPreview(page);
    const firstCanvas = preview.getByRole('img', { name: 'PDF 第 1 页预览' });
    await expect(firstCanvas).toHaveAttribute('data-rendered', 'true', { timeout: 30_000 });
    await expect.poll(() => canvasHasInk(firstCanvas)).toBe(true);
    await expect(page.locator('iframe, object, embed')).toHaveCount(0);
    await expect(page.getByText('打开', { exact: true })).toHaveCount(0);
  });
});

function visibleCanvasPreview(page: Page) {
  return page.locator('[data-testid="guest-pdf-canvas-preview"]:visible');
}

async function canvasHasInk(canvas: Locator) {
  return canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    const context = target.getContext('2d');
    if (!context || !target.width || !target.height) return false;
    const pixels = context.getImageData(0, 0, target.width, target.height).data;
    for (let index = 0; index < pixels.length; index += 32) {
      if (pixels[index] < 235 || pixels[index + 1] < 235 || pixels[index + 2] < 235) return true;
    }
    return false;
  });
}
