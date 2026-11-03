export class HtmlUtils {
  static safeUrl(value: string, image: boolean = false): string {
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }

    const url = value.trim();
    try {
      const parsed = new URL(url, document.baseURI);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return url;
      }
      if (image && (
        /^data:image\/(png|gif|jpeg|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(url) ||
        (parsed.protocol === 'blob:' && parsed.origin === window.location.origin)
      )) {
        return url;
      }
    } catch {}

    return '';
  }
}
