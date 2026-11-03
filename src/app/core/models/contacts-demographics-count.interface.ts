/**
 * Contacts demographics count - group
 * - null values mean the information was not provided
 */
export interface IContactsDemographicsCountGroup {
  gender: string | null;
  age: number | null;
  year: number | null;
  count: number;
}

/**
 * Contacts demographics count
 * - frequency table of contacts grouped by gender, age (completed years) and year of reporting
 */
export interface IContactsDemographicsCount {
  total: number;
  groups: IContactsDemographicsCountGroup[];
}