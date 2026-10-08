export const MINIMUM_CET_YEAR = 2020

export function isCurrentPaper(slug: string) {
  const year = slug.match(/^cet[46]-(\d{4})-/)?.[1]
  return !year || Number(year) >= MINIMUM_CET_YEAR
}
