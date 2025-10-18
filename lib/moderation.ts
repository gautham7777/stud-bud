// A simple client-side moderation utility.
// NOTE: This is a basic implementation for demonstration purposes and can be bypassed.
// For robust moderation, a server-side or dedicated third-party service is recommended.

const blocklist = [
  'hate',
  'stupid',
  'idiot',
  'dumb',
  'ugly',
  // Add more words as needed, keeping them lowercase.
];

// Generates a regex that matches any of the blocklist words, ignoring case.
const blocklistRegex = new RegExp(blocklist.join('|'), 'i');

// A map for reversing common "leetspeak" substitutions.
const leetMap: { [key: string]: string } = {
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '0': 'o',
  '@': 'a',
  '$': 's',
};

/**
 * Replaces leetspeak characters in a string with their standard alphabet equivalents.
 * @param text The input string.
 * @returns The "de-leeted" string.
 */
const deLeet = (text: string): string => {
  return text.split('').map(char => leetMap[char] || char).join('');
};

/**
 * Removes all characters that are not letters or numbers.
 * @param text The input string.
 * @returns The cleaned string.
 */
const removeSpecialCharsAndSpaces = (text: string): string => {
  return text.replace(/[^a-zA-Z0-9]/g, '');
};

/**
 * Checks if a message contains inappropriate content based on a blocklist and common bypass techniques.
 * @param text The message text to check.
 * @returns `true` if the message is deemed inappropriate, `false` otherwise.
 */
export const isMessageInappropriate = (text: string): boolean => {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  // 1. Direct match check on the original text.
  if (blocklistRegex.test(lowerText)) {
    return true;
  }

  // 2. Prepare variations of the text for more robust checking.
  const noSpacesText = removeSpecialCharsAndSpaces(lowerText);
  const deLeetedText = deLeet(noSpacesText);

  // 3. Check text with spaces and special characters removed.
  // Catches "h a t e" or "h.a.t.e".
  if (blocklistRegex.test(noSpacesText)) {
    return true;
  }

  // 4. Check "de-leeted" text.
  // Catches "h4t3" or "st*p1d".
  if (blocklistRegex.test(deLeetedText)) {
    return true;
  }

  return false;
};
