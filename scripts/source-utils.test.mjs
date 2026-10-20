import { describe, expect, it } from 'vitest';
import { decodePage, pageTitle, usableSource } from './source-utils.mjs';

describe('source evidence parsing', () => {
  it('reads legacy Chinese encodings declared in headers or HTML', () => {
    const bytes = Buffer.concat([Buffer.from('<meta charset="gb2312"><title>'), Buffer.from([0xd6, 0xd0, 0xce, 0xc4]), Buffer.from('</title>')]);
    expect(pageTitle(decodePage(bytes))).toBe('中文');
    expect(pageTitle(decodePage(bytes, 'text/html; charset=gbk'))).toBe('中文');
  });
  it('decodes UTF-8 titles and entities without accepting challenge pages', () => {
    expect(pageTitle(decodePage(Buffer.from('<title>官网 &#x4e2d;&#25991; &amp; FAQ</title>')))).toBe('官网 中文 & FAQ');
    for (const title of ['Just a moment...', 'Sina Visitor System', '安全验证', '乱码�']) {
      expect(usableSource({ status: 200, title })).toBe(false);
    }
    expect(usableSource({ status: 403, title: '官网' })).toBe(false);
    expect(usableSource({ status: 200, title: '官网' })).toBe(true);
  });
});
