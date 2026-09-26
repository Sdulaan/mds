/** Name-matching key that ignores case, spacing and punctuation ("Life Connect " == "LifeConnect"). */
export const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
