// shared/dateUtils.ts

/**
 * Converts a Date object or string to a "YYYY-MM-DD" string key.
 * Useful for comparing dates ignoring time.
 */
export const toDateKey = (date: Date | string | null | undefined): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Checks if the given date matches the target date key (YYYY-MM-DD).
 */
export const isSameDateKey = (date: Date | string | null | undefined, targetKey: string): boolean => {
    return toDateKey(date) === targetKey;
};

/**
 * Checks if the given date is strictly before the target date key.
 */
export const isBeforeDateKey = (date: Date | string | null | undefined, targetKey: string): boolean => {
    const key = toDateKey(date);
    return key !== "" && key < targetKey;
};

/**
 * Checks if the given date is strictly after the target date key.
 */
export const isAfterDateKey = (date: Date | string | null | undefined, targetKey: string): boolean => {
    const key = toDateKey(date);
    return key !== "" && key > targetKey;
};