import { LocalizationHelper, Moment } from '../../../core/helperClasses/localization-helper';
import { Constants } from '../../../core/models/constants';
import { OutbreakModel } from '../../../core/models/outbreak.model';
import { ILabelValuePairModel } from '../../../shared/forms-v2/core/label-value-pair.model';

/**
 * Epi curve helpers (period labels / year interval / axis labels)
 * - "epi" (CDC / MMWR, same rule as the Brazilian "semana epidemiológica") and "sunday" weeks start on Sunday
 * - "iso" weeks start on Monday
 * - week 1 is the first week with at least 4 days in the year (the week that contains January 4)
 */
export class EpiCurveHelper {

    // "all years" option value
  static readonly ALL_YEARS: string = 'ALL';

  /**
   * Year options: from the outbreak start year until the current year (most recent first) + "all years"
   */
  static getYearOptions(outbreak: OutbreakModel): ILabelValuePairModel[] {
    // determine interval
    const currentYear: number = LocalizationHelper.now().year();
    const outbreakStart: Moment = outbreak?.startDate ?
      LocalizationHelper.toMoment(outbreak.startDate) :
      null;
    const startYear: number = outbreakStart && outbreakStart.isValid() && outbreakStart.year() <= currentYear ?
      outbreakStart.year() :
      currentYear;

    // years
    const options: ILabelValuePairModel[] = [];
    for (let year = currentYear; year >= startYear; year--) {
      options.push({
        label: year.toString(),
        value: year
      });
    }

    // all years
    options.push({
      label: 'LNG_PAGE_DASHBOARD_OVERVIEW_ALL_YEARS_LABEL',
      value: EpiCurveHelper.ALL_YEARS
    });

    // finished
    return options;
  }
  /**
   * First day of week (0 = Sunday, 1 = Monday)
   */
  private static firstDayOfWeek(weekType: string): number {
    return weekType === Constants.EPI_CURVE_WEEK_TYPES.ISO.value ? 1 : 0;
  }

  /**
   * Start of the week that contains the date
   */
  private static startOfWeek(date: Moment, weekType: string): Moment {
    const firstDow: number = EpiCurveHelper.firstDayOfWeek(weekType);
    const day: Moment = date.clone().startOf('day');
    return day.subtract((day.day() - firstDow + 7) % 7, 'days');
  }

  /**
   * Start of week 1 of a year
   */
  private static startOfFirstWeek(reference: Moment, year: number, weekType: string): Moment {
    const jan4: Moment = reference.clone().startOf('year').year(year).date(4);
    return EpiCurveHelper.startOfWeek(jan4, weekType);
  }

  /**
   * Week number and week year of a date
   */
  static getWeek(date: Moment, weekType: string): { week: number, year: number } {
    const weekStart: Moment = EpiCurveHelper.startOfWeek(date, weekType);
    const year: number = weekStart.clone().add(3, 'days').year();
    const firstWeekStart: Moment = EpiCurveHelper.startOfFirstWeek(weekStart, year, weekType);
    return {
      week: Math.round(weekStart.diff(firstWeekStart, 'days') / 7) + 1,
      year
    };
  }

  /**
   * Interval of a year
   * - weeks => epidemiological year (from week 1 to the last week of the year)
   * - months / days => calendar year
   */
  static getYearInterval(
    reference: Moment,
    year: number,
    viewType: string,
    weekType: string
  ): { start: Moment, end: Moment } {
    // weeks
    if (viewType === Constants.EPI_CURVE_VIEW_TYPE.WEEK.value) {
      return {
        start: EpiCurveHelper.startOfFirstWeek(reference, year, weekType),
        end: EpiCurveHelper.startOfFirstWeek(reference, year + 1, weekType).subtract(1, 'millisecond')
      };
    }

    // months / days
    const start: Moment = reference.clone().startOf('year').year(year);
    return {
      start,
      end: start.clone().endOf('year')
    };
  }

  /**
   * Label of a period (x axis)
   * - weeks => "EW 22" (or "EW 22/2026" when more than one year is displayed)
   * - months => "08/2026"
   * - days => date
   */
  static getPeriodLabel(
    start: Moment,
    viewType: string,
    weekType: string,
    weekPrefix: string,
    showYear: boolean
  ): string {
    // weeks
    if (viewType === Constants.EPI_CURVE_VIEW_TYPE.WEEK.value) {
      const week = EpiCurveHelper.getWeek(start, weekType);
      return showYear ?
        `${weekPrefix} ${week.week}/${week.year}` :
        `${weekPrefix} ${week.week}`;
    }

    // months
    if (viewType === Constants.EPI_CURVE_VIEW_TYPE.MONTH.value) {
      return start.format('MM/YYYY');
    }

    // days
    return LocalizationHelper.displayDate(start);
  }

  /**
   * Token of the x axis period (week / month / day)
   */
  static getAxisPeriodToken(viewType: string): string {
    if (viewType === Constants.EPI_CURVE_VIEW_TYPE.WEEK.value) {
      return 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_WEEK';
    }
    if (viewType === Constants.EPI_CURVE_VIEW_TYPE.MONTH.value) {
      return 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_MONTH';
    }
    return 'LNG_PAGE_DASHBOARD_EPI_CURVE_TABS_AXIS_DAY';
  }
}