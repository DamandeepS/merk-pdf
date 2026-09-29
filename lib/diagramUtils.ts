/**
 * Utilities for detecting and formatting ASCII/Unicode box-drawing diagrams.
 */

export function isAsciiDiagram(text: string, language?: string): boolean {
  if (language) {
    const lang = language.toLowerCase().trim();
    if (['diagram', 'ascii', 'box', 'art', 'flowchart', 'architecture'].includes(lang)) {
      return true;
    }
  }

  if (!text) return false;

  // 1. Unicode box-drawing and block characters (U+2500 - U+259F)
  if (/[┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬─│═║╭╮╯╰╒╓╕╖╘╙╛╜╞╟╡╢╤╥╧╨╪╫▀▄█▌▐░▒▓]/.test(text)) {
    return true;
  }

  // 2. ASCII box borders (+---+, |   |)
  const lines = text.split('\n');
  const boxBorderCount = lines.filter(
    (l) => /^\s*\+[-=]{3,}\+/.test(l) || /^\s*\|.*\|\s*$/.test(l)
  ).length;
  if (boxBorderCount >= 3) {
    return true;
  }

  return false;
}
