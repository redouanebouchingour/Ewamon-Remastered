/** The opposing side index, typed so tuple access stays narrow (`1 - side` widens to `number`). */
export function otherSide(side: 0 | 1): 0 | 1 {
  return side === 0 ? 1 : 0;
}
