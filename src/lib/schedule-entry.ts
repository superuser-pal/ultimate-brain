/** The JSON of a scheduled job's plist `ultimate-brain` key (cli.md §5.21), parsed; null when absent or invalid. */
export function scheduleEntryOf(text: string): unknown {
  const match = /<key>ultimate-brain<\/key>\s*<string>([^<]*)<\/string>/.exec(text);
  if (match === null) return null;
  try {
    return JSON.parse(unxml(match[1]!));
  } catch {
    return null;
  }
}

const unxml = (value: string) => value.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");
