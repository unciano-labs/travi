// Serialize structured data for a <script type="application/ld+json"> tag.
// JSON.stringify does not escape "<", so user text such as "</script><script>..." would end the tag
// and run as HTML. Escaping these characters (plus the JS line/paragraph separators U+2028/U+2029)
// as \uXXXX keeps the JSON identical once parsed.
const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, 'g');

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
