import crossBorderMarkdown from '../../../../../../docs/legal/cross-border-processing-notice.zh-CN.md?raw';
import privacyMarkdown from '../../../../../../docs/legal/privacy-policy.zh-CN.md?raw';
import termsMarkdown from '../../../../../../docs/legal/terms-and-content-rules.zh-CN.md?raw';

import type { LegalDocumentKey } from './legal-routes';

type LegalDocument = {
  content: string;
  description: string;
  title: string;
};

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  crossBorder: {
    content: crossBorderMarkdown,
    description: '说明账号、简历、头像及验证邮件在境外处理的范围、接收方和权利。',
    title: '个人信息跨境处理说明',
  },
  privacy: {
    content: privacyMarkdown,
    description: '了解 LittleAgResume 收集哪些信息、如何使用，以及你可以如何管理这些信息。',
    title: '隐私政策',
  },
  terms: {
    content: termsMarkdown,
    description: '了解账号、简历内容、邀请码和服务使用过程中双方的权利与义务。',
    title: '用户服务协议及内容规则',
  },
};
