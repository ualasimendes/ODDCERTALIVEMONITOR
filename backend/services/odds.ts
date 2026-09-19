export class OddsService {
  /**
   * Convert American odds to Decimal representation
   */
  public americanToDecimal(american: number | string): number | null {
    const val = typeof american === 'number' ? american : parseFloat(String(american).replace('+', ''));
    if (isNaN(val)) return null;
    if (val > 0) {
      return parseFloat((1 + val / 100).toFixed(2));
    } else if (val < 0) {
      return parseFloat((1 + 100 / Math.abs(val)).toFixed(2));
    }
    return 1.0;
  }

  /**
   * Format decimal odd display or N/D
   */
  public formatOdd(odd: number | null | undefined): string {
    if (odd === null || odd === undefined || isNaN(odd)) {
      return 'N/D';
    }
    return odd.toFixed(2);
  }

  /**
   * Check if odd satisfies the threshold limit for tab
   */
  public isAboveReference(odd: number | null, reference: number): boolean {
    if (odd === null) return false;
    return odd >= reference;
  }
}

export const oddsService = new OddsService();
