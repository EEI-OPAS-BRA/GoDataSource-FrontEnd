import { ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { TranslateDefaultParser, TranslatePipe, TranslateService } from '@ngx-translate/core';
import * as _ from 'lodash';

class HtmlTranslateParser extends TranslateDefaultParser {
  getValue(target: any, key: string): any {
    const value = super.getValue(target, key);
    return value === undefined || value === null ? value : _.escape(String(value));
  }
}

@Pipe({
  name: 'htmlTranslate',
  pure: false
})
export class HtmlTranslatePipe extends TranslatePipe implements PipeTransform {
  private htmlParser = new HtmlTranslateParser();

  constructor(translate: TranslateService, changeDetectorRef: ChangeDetectorRef) {
    super(translate, changeDetectorRef);
  }

  transform(query: string, params?: any): any {
    return this.htmlParser.interpolate(super.transform(query), params);
  }
}
