import { DomSanitizer } from '@angular/platform-browser';
import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { HtmlUtils } from '../../utils/html';

@Pipe({
  name: 'safeHtml'
})
export class SafeHtmlPipe implements PipeTransform {
  /**
     * Constructor
     */
  constructor(
    private sanitized: DomSanitizer
  ) {}

  /**
     * Sanitize
     */
  transform(value: string) {
    if (typeof value !== 'string') {
      return '';
    }

    const content = new DOMParser().parseFromString(value, 'text/html');
    content.body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
      const url = HtmlUtils.safeUrl(link.getAttribute('href'));
      if (url) {
        link.setAttribute('href', url);
      } else {
        link.removeAttribute('href');
      }
      if (link.target === '_blank') {
        link.rel = 'noopener noreferrer';
      }
    });
    content.body.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
      const url = HtmlUtils.safeUrl(image.getAttribute('src'), true);
      if (url) {
        image.setAttribute('src', url);
      } else {
        image.removeAttribute('src');
      }
    });
    content.body.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
      if (element.style.fontWeight === 'bold' || element.style.fontWeight === '700') {
        element.classList.add('gd-rich-text-bold');
      }
      if (element.style.fontStyle === 'italic') {
        element.classList.add('gd-rich-text-italic');
      }
      if (element.style.textDecoration.includes('underline')) {
        element.classList.add('gd-rich-text-underline');
      }
      if (element.style.color === 'var(--gd-danger)') {
        element.classList.add('gd-rich-text-danger');
      } else if (element.style.color === 'var(--gd-success)') {
        element.classList.add('gd-rich-text-success');
      }
    });

    return this.sanitized.sanitize(SecurityContext.HTML, content.body.innerHTML) || '';
  }
}
