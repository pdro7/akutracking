/**
 * Format a number as Colombian Pesos (COP)
 * @param amount - The amount to format
 * @returns Formatted string in COP format (e.g., "$1.000.000")
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
