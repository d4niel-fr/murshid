import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { linkTarget, safeRedirect } from './safe-redirect';
import { safeNext } from './auth';
import { Markdown } from './markdown';

describe('safeRedirect (?next= after sign-in)', () => {
  it('keeps same-site paths with their query and hash', () => {
    expect(safeRedirect('/app/school?tab=work#due')).toBe('/app/school?tab=work#due');
    expect(safeRedirect('/sign-in?reset=1')).toBe('/sign-in?reset=1');
    expect(safeRedirect('/app/../app/chat')).toBe('/app/chat');
  });
  it('refuses anything that would leave the site', () => {
    for (const bad of ['//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', ' /app', 'https://evil.example/app', 'javascript:alert(1)',
      'evil.example', '\\\\evil.example', '/%0a/evil.example'.replace('%0a', '\n'), '', null, undefined, `/${'a'.repeat(2100)}`]) {
      expect(safeRedirect(bad as string, '/app'), String(bad)).toBe('/app');
    }
  });
  it('is what sign-in uses', () => {
    expect(safeNext('/\t/evil.example')).toBe('/app');
    expect(safeNext('/app/settings')).toBe('/app/settings');
  });
});

describe('links in notes and AI answers', () => {
  it('allows http(s) and mailto (new tab) and same-site paths, nothing else', () => {
    expect(linkTarget('https://example.com/a')).toEqual({ href: 'https://example.com/a', external: true });
    expect(linkTarget('mailto:teacher@school.ae')).toEqual({ href: 'mailto:teacher@school.ae', external: true });
    expect(linkTarget('/app/study')).toEqual({ href: '/app/study', external: false });
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example', '/\\evil.example', 'file:///etc/passwd']) expect(linkTarget(bad), bad).toBeNull();
  });
  it('the Markdown renderer never outputs a script link or raw HTML', () => {
    const html = renderToStaticMarkup(createElement(Markdown, { source: '[a](javascript:alert(1)) [b](//evil.example) [c](https://ok.example) <img src=x onerror=alert(1)> <script>alert(1)</script>' }));
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('href="//evil.example"');
    expect(html).toContain('href="https://ok.example" target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
});
