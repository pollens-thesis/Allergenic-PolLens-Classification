// ---------------------------------------------------------------------------
// ACCOUNT — who the console says you are.
//
// PolLens is opened by an institution rather than by a person: a department or
// laboratory mailbox signs in, and the reports saved from it belong to that
// institution. So the profile is not typed in. The signed-in address is the
// only thing stored, and the name shown everywhere is read off it.
//
// That keeps one fact in one place. A name typed into a settings form can
// disagree with the account that saved the report; a name derived from the
// credential cannot.
//
// TODO(backend): when Google sign-in is real, the address comes from the ID
// token and `hd` (hosted domain) gives the institution directly. Everything
// below still applies to accounts on a plain domain.
// ---------------------------------------------------------------------------

/** Mail hosts that say nothing about where someone works. */
const PUBLIC_MAIL_HOSTS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.com.ph",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "mail.com",
]);

/**
 * Domain endings that carry no institution name — the label in front of them
 * does. Longest first, so "edu.ph" is matched before "ph".
 */
const PUBLIC_SUFFIXES = [
  "edu.ph", "gov.ph", "com.ph", "org.ph", "net.ph", "ac.uk", "edu.au", "ac.jp",
  "edu.sg", "com.au", "co.uk",
  "edu", "gov", "org", "com", "net", "ac", "int", "mil",
  "ph", "sg", "au", "uk", "jp", "us", "io", "co", "dev", "app",
];

export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

function titleCase(word: string): string {
  return word
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join("-");
}

/**
 * An acronym stays an acronym.
 *
 * Philippine universities are known by their initials far more than by the
 * spelled-out name — "MSEUF", "UP", "DLSU" — and those are exactly the short
 * all-letter labels a domain uses. Anything longer reads as a word.
 */
function formatLabel(label: string): string {
  return label.length <= 5 && /^[a-z]+$/.test(label) ? label.toUpperCase() : titleCase(label);
}

/**
 * "bio.research@mseuf.edu.ph" → "MSEUF". Null for a personal mailbox, which has
 * no institution to speak of.
 */
export function institutionFromEmail(email: string): string | null {
  const domain = domainOf(email);
  if (!domain || !domain.includes(".")) return null;
  if (PUBLIC_MAIL_HOSTS.has(domain)) return null;

  let labels = domain.split(".").filter(Boolean);
  // Strip the public ending one label at a time — "research.mseuf.edu.ph" has
  // two of them — but never strip the whole domain away.
  while (labels.length > 1 && PUBLIC_SUFFIXES.includes(labels[labels.length - 1])) {
    labels = labels.slice(0, -1);
  }
  const label = labels[labels.length - 1];
  return label ? formatLabel(label) : null;
}

/** "bio.research@mseuf.edu.ph" → "Bio Research". */
export function personFromEmail(email: string): string {
  const at = email.lastIndexOf("@");
  const local = (at === -1 ? email : email.slice(0, at)).trim().toLowerCase();
  return local
    // A trailing year or student number is not part of anyone's name.
    .replace(/\d+$/, "")
    .split(/[._+]+/)
    .filter(Boolean)
    .map(titleCase)
    .join(" ")
    .trim();
}

/**
 * What the console calls this account: the institution where there is one, the
 * mailbox's own name otherwise.
 */
export function accountName(email: string, fallback = "Researcher"): string {
  if (!email.includes("@")) return fallback;
  return institutionFromEmail(email) || personFromEmail(email) || fallback;
}

/** "MSEUF" → "MS"; falls back to the first two characters. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
