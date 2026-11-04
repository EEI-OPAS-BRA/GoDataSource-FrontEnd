import { Pipe, PipeTransform } from '@angular/core';
import * as _ from 'lodash';

@Pipe({
  name: 'highlight'
})
export class HighlightSearchPipe implements PipeTransform {
  /**
   * Highlight text
   */
  static highlight(
    value: string,
    searchValue
  ): string {
    const text = value === undefined || value === null ? '' : String(value);
    if (!searchValue) {
      return _.escape(text);
    }

    const re = new RegExp(`(${_.escapeRegExp(String(searchValue))})`, 'gi');
    return text.split(re)
      .map((part, index) => index % 2 ? `<mark>${_.escape(part)}</mark>` : _.escape(part))
      .join('');
  }

  /**
   * Transform
   */
  transform(
    value: string,
    searchValue: string
  ): string {
    return HighlightSearchPipe.highlight(
      value,
      searchValue
    );
  }
}
