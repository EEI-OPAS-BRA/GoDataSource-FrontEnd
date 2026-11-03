import * as _ from 'lodash';
import { LocalizationHelper } from '../localization-helper';

export class RequestFilterGenerator {
  /**
   * Groups of latin characters considered equivalent for accent-insensitive search.
   * Each group lists the base letter together with its accented variants (lower and upper case),
   * so that searching "sao" matches "São" and searching "São" matches "sao" (bidirectional).
   */
  private static readonly ACCENT_GROUPS: string[] = [
    'aáàâãäåAÁÀÂÃÄÅ',
    'eéèêëEÉÈÊË',
    'iíìîïIÍÌÎÏ',
    'oóòôõöøOÓÒÔÕÖØ',
    'uúùûüUÚÙÛÜ',
    'cçCÇ',
    'nñNÑ',
    'yýÿYÝŸ'
  ];

  /**
   * Lookup map built from ACCENT_GROUPS: every character (base or accented variant)
   * maps to the regex character class that matches the whole equivalence group.
   */
  private static readonly ACCENT_MAP: { [char: string]: string } = RequestFilterGenerator.ACCENT_GROUPS.reduce(
    (map, group) => {
      const charClass = '[' + group + ']';
      for (const char of group) {
        map[char] = charClass;
      }
      return map;
    },
    {} as { [char: string]: string }
  );

  /**
     * Escape string
     * @param value
     */
  static escapeStringForRegex(value: string) {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
  }

  /**
   * Expand each accent-bearing character (and its base letter) into a regex character class
   * covering the whole equivalence group, making the regex accent-insensitive.
   * Must be applied to an already regex-escaped string and BEFORE wildcard/url-encode replacements,
   * so it only touches literal text and never the metacharacters introduced afterwards.
   * @param escapedValue value already passed through escapeStringForRegex
   */
  static expandAccents(escapedValue: string): string {
    let result = '';
    for (let index = 0; index < escapedValue.length; index++) {
      const char = escapedValue[index];

      // preserve escaped sequences ( backslash + next char ) verbatim
      if (
        char === '\\' &&
        index + 1 < escapedValue.length
      ) {
        result += char + escapedValue[index + 1];
        index++;
        continue;
      }

      result += RequestFilterGenerator.ACCENT_MAP[char] || char;
    }
    return result;
  }

  /**
   * Build the body of a search regex from a raw value: escape regex specials,
   * expand accents for accent-insensitive matching, then apply the existing
   * wildcard ( %, ? ) and url-encode replacements.
   * @param value
   */
  private static buildRegexBody(value: string): string {
    return RequestFilterGenerator.expandAccents(
      RequestFilterGenerator.escapeStringForRegex(value)
    )
      .replace(/%/g, '.*')
      .replace(/\\\?/g, '.')
      .replace(/&/g, '%26')
      .replace(/#/g, '%23')
      .replace(/\+/g, '%2B');
  }

  /**
   * Text is exactly the provided value ( case-insensitive )
   */
  static textIs(
    value: string,
    useLike?: boolean
  ): any {
    const body = RequestFilterGenerator.buildRegexBody(value);
    return useLike ?
      {
        like: '^' + body + '$',
        options: 'i'
      } : {
        regexp: '/^' + body + '$/i'
      };
  }

  /**
   * Text contains the provided value ( case-insensitive )
   */
  static textContains(
    value: string,
    useLike?: boolean
  ): any {
    const body = RequestFilterGenerator.buildRegexBody(value);
    return useLike ?
      {
        like: body,
        options: 'i'
      } : {
        regexp: '/' + body + '/i'
      };
  }

  /**
   * Text starts with provided value ( case insensitive )
   */
  static textStartWith(
    value: string,
    useLike?: boolean
  ): any {
    const body = RequestFilterGenerator.buildRegexBody(value);
    return useLike ?
      {
        like: '^' + body,
        options: 'i'
      } : {
        regexp: '/^' + body + '/i'
      };
  }

  /**
     * Compare with range of numbers or iso dates
     * @param value
     * @returns null if invalid data is provided, filter object otherwise
     */
  static rangeCompare(value: {
    from?: number | string,
    to?: number | string
  }) {
    // data
    const fromValue = _.get(value, 'from');
    const toValue = _.get(value, 'to');
    const fromValueIsEmpty: boolean = !_.isNumber(fromValue) && _.isEmpty(fromValue);
    const toValueIsEmpty: boolean = !_.isNumber(toValue) && _.isEmpty(toValue);

    // determine operator & value
    let operator;
    let valueToCompare;
    if (!fromValueIsEmpty && !toValueIsEmpty) {
      operator = 'between';
      valueToCompare = [fromValue, toValue];
    } else if (!fromValueIsEmpty) {
      operator = 'gte';
      valueToCompare = fromValue;
    } else if (!toValueIsEmpty) {
      operator = 'lte';
      valueToCompare = toValue;
    } else {
      return null;
    }

    // filter
    return {
      [operator]: valueToCompare
    };
  }

  /**
     * Compare with range of dates
     * @param value
     */
  static dateRangeCompare(value: {
    startDate?: any,
    endDate?: any
  }) {
    // convert date range to simple range
    const rangeValue: any = {};
    if (value.startDate) {
      rangeValue.from = value.startDate.toISOString ? value.startDate.toISOString() : LocalizationHelper.toMoment(value.startDate).toISOString();
    }
    if (value.endDate) {
      rangeValue.to = value.endDate.toISOString ? value.endDate.toISOString() : LocalizationHelper.toMoment(value.endDate).toISOString();
    }

    // filter
    return this.rangeCompare(
      rangeValue
    );
  }

  /**
   * Check if field has value
   */
  static hasValue(field: string) {
    // since some mongo filters don't work with $neq null / $eq null, we need to find different solution
    return {
      // needs to be an object with just one property otherwise loopback sends to mongo when using find only the first property and its value and ignores all others, this is why we need to use $and
      $and: [
        {
          [field]: {
            $exists: true
          }
        }, {
          [field]: {
            $ne: null
          }
        }, {
          [field]: {
            $ne: ''
          }
        }, {
          [field]: {
            $not: {
              $size: 0
            }
          }
        }
      ]
    };
  }

  /**
   * Check if field doesn't have value
   */
  static doesntHaveValue(
    field: string,
    checkForEmptyString: boolean,
    forMongo: boolean = false
  ) {
    // since some mongo filters don't work with $neq null / $eq null, we need to find different solution
    return forMongo ? {
      $or: [
        {
          [field]: {
            $exists: false
          }
        }, {
          [field]: {
            $eq: null
          }
        },
        ...(
          checkForEmptyString ?
            [{
              [field]: {
                $eq: ''
              }
            }] :
            []
        )
      ]
    } : {
      or: [
        {
          [field]: {
            exists: false
          }
        }, {
          [field]: {
            eq: null
          }
        },
        ...(
          checkForEmptyString ?
            [{
              [field]: {
                eq: ''
              }
            }] :
            []
        )
      ]
    };
  }
}
