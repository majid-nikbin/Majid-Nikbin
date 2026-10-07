export function calculateNmeaChecksum(sentence: string): string {
  let str = sentence;
  if (str.startsWith('$') || str.startsWith('!')) {
    str = str.slice(1);
  }
  const astIdx = str.indexOf('*');
  if (astIdx !== -1) {
    str = str.slice(0, astIdx);
  }

  let checksum = 0;
  for (let i = 0; i < str.length; i++) {
    checksum ^= str.charCodeAt(i);
  }
  return checksum.toString(16).toUpperCase().padStart(2, '0');
}

export function formatNmeaSentence(body: string): string {
  const clean = body.startsWith('$') ? body.slice(1) : body;
  const cs = calculateNmeaChecksum(clean);
  return `$${clean}*${cs}\r\n`;
}

export function parseNmeaSentence(raw: string): { talker: string; type: string; fields: string[] } | null {
  const line = raw.trim();
  if (!line.startsWith('$') && !line.startsWith('!')) return null;

  const starIdx = line.indexOf('*');
  const payload = starIdx !== -1 ? line.slice(1, starIdx) : line.slice(1);
  const parts = payload.split(',');
  if (parts.length === 0) return null;

  const header = parts[0];
  const talker = header.length >= 2 ? header.slice(0, 2) : 'II';
  const type = header.length >= 5 ? header.slice(2, 5) : header;

  return {
    talker,
    type,
    fields: parts.slice(1)
  };
}
