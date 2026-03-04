/**
 * Utility function for conditional CSS class names
 * Replaces template literals and ternaries for cleaner conditional classes
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
}
