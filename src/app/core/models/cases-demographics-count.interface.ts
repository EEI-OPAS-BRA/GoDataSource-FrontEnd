/**
 * Cases demographics count - group
 * - null values mean the information was not provided
 */
export interface ICasesDemographicsCountGroup {
  gender: string | null;
  age: number | null;
  year: number | null;
  count: number;
}

/**
 * Cases demographics count
 * - frequency table of cases grouped by gender, age (completed years) and year of symptom onset
 */
export interface ICasesDemographicsCount {
  total: number;
  groups: ICasesDemographicsCountGroup[];
}