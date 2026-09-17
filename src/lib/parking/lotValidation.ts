/**
 * Reserved parking lots are numeric, optionally with a trailing zone letter
 * (for example, 12 or 12A). Vehicle plates must never be accepted as a lot.
 */
export function isValidLotNumber(value: string | null | undefined) {
  return /^\d+[A-Z]?$/i.test(value?.trim() || '');
}
