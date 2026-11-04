export const SORT_ORDER = Object.freeze({
  ASC: "ASC",
  DESC: "DESC",
});
export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER];
