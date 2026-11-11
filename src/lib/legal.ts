/**
 * KiTA's privacy policy and terms, in plain words. Shown at /privacy-policy
 * and /terms (readable without signing in, as the app stores require).
 *
 * Keep these true: when a feature starts collecting something new, or a new
 * outside service is used, update the matching section and LEGAL_UPDATED.
 */

export const LEGAL_UPDATED = '11 November 2026';
export const CONTACT_EMAIL = 'mickeymouseaaco@gmail.com';

export type LegalSection = { title: string; body: string[] };

export const PRIVACY_POLICY: LegalSection[] = [
  {
    title: 'In short',
    body: [
      'KiTA is a private space for two people in a relationship. What you write, log and share is stored so the app works for you and your partner. We don’t sell it, we don’t show ads, and we don’t track you around the internet.',
      'Most of what you log is private to you. Your partner only sees what you choose to share in Settings → What your partner can see.',
    ],
  },
  {
    title: 'What we keep',
    body: [
      'Your account: your first name, email address, and (if you add one) a profile photo. Your password is handled by Firebase Authentication; we never see it.',
      'What you log: steps, moods, meals, evening check-ins, cycle days (only if you turn cycle tracking on), gratitude, to-dos, answers to the question of the day, trips, itineraries, journal entries and saved flight numbers.',
      'What you send: surat cinta, hugs, photos, videos and voice notes, and their transcripts if you turn transcription on.',
      'Your location, only if you turn on Find my partner. We keep only your latest location (never a history), and delete it as soon as you turn sharing off.',
      'Notification tokens for your devices, so hugs and notes can reach you, and your Look & feel choices.',
      'Error reports: when something breaks, a short technical note (what went wrong, which screen, browser or phone type, app version). It never includes your notes, logs, photos or name.',
    ],
  },
  {
    title: 'What never leaves your phone',
    body: [
      'Names you type into Stress Smash, your chosen weather place, and some display settings stay on your device.',
    ],
  },
  {
    title: 'Where it’s stored',
    body: [
      'With Google Firebase (Google Cloud), in Singapore. Data is encrypted in transit and at rest by Google. Security rules make sure only you, and your partner for what you share, can read your data.',
    ],
  },
  {
    title: 'Services KiTA uses',
    body: [
      'Google Firebase: accounts, database, file storage, server functions and push notifications.',
      'Google Cloud Speech-to-Text: only if you turn on “Transcribe my voice notes”.',
      'Open-Meteo: weather. The place you choose (its coordinates) is sent to get the forecast.',
      'OpenStreetMap (Nominatim and map tiles): turns a location into a place name, and shows maps.',
      'MET Malaysia and JPS via data.gov.my: official weather warnings and river levels for the Malaysian flood watch.',
      'airplanes.live, adsb.fi and adsbdb.com: live flight positions. Our server sends only the flight number you track.',
      'Vercel: hosts the KiTA website, with standard server logs (such as IP addresses) kept for a short time.',
      'Each of these has its own privacy policy. We only send them what the feature needs.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'For as long as you have an account. You can delete single notes, logs and photos any time.',
      'If you and your partner unlink, shared things are kept for 30 days in case you reconnect, then deleted.',
      'Delete your account in Settings → Delete my account: your account and your data are removed. Error reports are kept for up to 90 days.',
    ],
  },
  {
    title: 'Your choices and rights',
    body: [
      'You can see and change what your partner sees, turn location and transcription on or off, and delete your data or your whole account in the app.',
      `To ask for a copy of your data, or anything else about your privacy, email ${CONTACT_EMAIL}. We’ll reply within 30 days.`,
    ],
  },
  {
    title: 'Who KiTA is for',
    body: ['KiTA is for adults aged 18 and over. We don’t knowingly collect information from anyone younger.'],
  },
  {
    title: 'Changes',
    body: ['If this policy changes in a way that matters, we’ll tell you in the app before it takes effect. The date at the top shows the latest version.'],
  },
];

export const TERMS: LegalSection[] = [
  {
    title: 'Using KiTA',
    body: [
      'KiTA is a private app for couples. By creating an account you agree to these terms and to the privacy policy.',
      'You need to be 18 or over, and the account is for you alone. Keep your password private.',
    ],
  },
  {
    title: 'Your content',
    body: [
      'What you write, record and upload stays yours. You let us store it and deliver it to you and, where you choose, your partner, only so KiTA can work.',
      'Only share things you have the right to share, and be kind: don’t use KiTA to harass, threaten or harm anyone, or to share anything illegal.',
    ],
  },
  {
    title: 'A gentle guide, not professional advice',
    body: [
      'Weather, flood warnings and river levels come from public sources and can be late or wrong. Always follow the official authorities, and in an emergency call your local emergency number (999 in Malaysia).',
      'Flight tracking uses free community data. It can be missing or delayed, and it’s for keeping each other company, never for safety decisions.',
      'Mood, cycle, stress and wellbeing features are not medical advice. If you’re struggling, please talk to a doctor or someone you trust.',
    ],
  },
  {
    title: 'Keeping KiTA running',
    body: [
      'We work hard to keep KiTA available and your data safe, but we can’t promise it will always be free of errors or interruptions. Features may change over time.',
      'To the extent the law allows, KiTA is provided “as is”, and we aren’t responsible for indirect losses arising from using it.',
    ],
  },
  {
    title: 'Ending',
    body: [
      'You can stop using KiTA and delete your account at any time in Settings.',
      'We may suspend an account that is used to harm others or to break the law.',
    ],
  },
  {
    title: 'The law',
    body: ['These terms are governed by the laws of Malaysia. Nothing here takes away rights you have under the consumer laws where you live.'],
  },
  {
    title: 'Contact',
    body: [`Questions about these terms: ${CONTACT_EMAIL}.`],
  },
];
