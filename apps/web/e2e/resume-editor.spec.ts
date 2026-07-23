import { expect, test } from '@playwright/test';

test.use({ viewport: { height: 1000, width: 1440 } });

test('edits and auto-saves a dynamic desktop resume', async ({ page }) => {
  const resumeId = '00000000-0000-0000-0000-000000000101';
  let revision = 1;
  let content = {
    profile: { fullName: '', targetRole: '', phone: '', email: '', location: '', links: [] },
    sections: [
      { id: 'summary', type: 'summary', title: '个人简介', enabled: true, text: '' },
      { id: 'work', type: 'work', title: '工作经历', enabled: true, items: [] },
      { id: 'education', type: 'education', title: '教育背景', enabled: true, items: [] },
      { id: 'project', type: 'project', title: '项目经历', enabled: true, items: [] },
      { id: 'skills', type: 'skills', title: '技能', enabled: true, items: [] },
      { id: 'awards', type: 'awards', title: '奖项荣誉', enabled: false, items: [] },
    ],
    formatting: {
      fontSize: 'standard',
      lineHeight: 'standard',
      pageMargin: 'standard',
      sectionGap: 'standard',
      accentColor: 'plum',
    },
  };
  let title = '产品设计师简历';
  let templateId = 'modern-editorial';

  const detail = () => ({
    id: resumeId,
    title,
    status: 'draft',
    revision,
    hasAvatar: false,
    templateId,
    exportCount: 0,
    contentVersion: 1,
    content,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
  });
  const ok = (data: unknown) => JSON.stringify({ code: 0, message: '', data });

  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: ok({
        accessToken: 'access-token',
        user: { id: 'user-1', username: 'qingqing', email: 'qingqing@example.com' },
      }),
    }),
  );
  await page.route(`**/api/resumes/${resumeId}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as {
        content: typeof content;
        expectedRevision: number;
        templateId: string;
        title: string;
      };
      expect(body.expectedRevision).toBe(revision);
      content = body.content;
      templateId = body.templateId;
      title = body.title;
      revision += 1;
    }
    await route.fulfill({ contentType: 'application/json', status: 200, body: ok(detail()) });
  });
  await page.route(`**/api/resumes/${resumeId}/exports`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: ok({ ...detail(), exportCount: 1 }),
    });
  });

  await page.goto(`/resumes/${resumeId}/edit`);
  await expect(page.getByRole('heading', { name: '基本信息' })).toBeVisible();
  const preview = page.getByLabel('产品设计师简历 A4 实时预览');
  await expect(preview).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);

  await page.getByLabel('姓名').fill('林清清');
  await page.getByLabel('目标岗位').fill('产品设计师');
  await expect(preview.getByRole('heading', { name: '林清清' })).toBeVisible();
  await expect(preview.getByText('产品设计师')).toBeVisible();
  await expect.poll(() => revision, { timeout: 5000 }).toBeGreaterThan(1);
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '添加板块' }).click();
  await page.getByLabel('自定义板块').fill('志愿经历');
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page.getByRole('heading', { name: '志愿经历' })).toBeVisible();
  await page.getByLabel('标题', { exact: true }).fill('开源社区设计志愿者');
  await page.getByRole('button', { name: '开始时间' }).click();
  const currentYear = new Date().getFullYear();
  await page.screenshot({ path: 'test-results/resume-month-picker.png', fullPage: true });
  await page.getByRole('button', { name: `${currentYear} 年 1 月` }).click();
  await expect(page.getByRole('button', { name: '开始时间' })).toContainText(
    `${currentYear} 年 01 月`,
  );
  await expect
    .poll(() => content.sections.some((section) => section.type === 'custom'), { timeout: 5000 })
    .toBe(true);

  await page.screenshot({ path: 'test-results/resume-editor-desktop.png', fullPage: true });

  const modernDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF' }).click();
  await (await modernDownload).saveAs('test-results/resume-modern-editorial.pdf');

  await page.getByRole('button', { name: '排版设置' }).click();
  await page.getByRole('combobox', { name: '模板' }).click();
  await page.getByRole('option', { name: '经典专业' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await expect.poll(() => templateId, { timeout: 5000 }).toBe('classic-professional');
  await expect(preview).toHaveAttribute('data-template', 'classic-professional');
  await page.screenshot({ path: 'test-results/resume-editor-classic-desktop.png', fullPage: true });

  const classicDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF' }).click();
  await (await classicDownload).saveAs('test-results/resume-classic-professional.pdf');
});
