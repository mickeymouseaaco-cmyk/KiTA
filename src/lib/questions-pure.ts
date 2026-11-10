/**
 * Question of the day: one gentle question a day, the same for both of you.
 * Pure (no Firebase), so it's easy to test.
 */

export const QUESTIONS: readonly string[] = [
  'What’s one small thing I did recently that made you smile?',
  'What would your perfect slow Sunday look like?',
  'Which memory of us do you replay most often?',
  'What’s something you’re looking forward to this month?',
  'What song reminds you of us, and why?',
  'What’s one thing you’d love us to try together this year?',
  'When do you feel most loved by me?',
  'What’s a food that tastes like home to you?',
  'What made you laugh the hardest this week?',
  'If we had a free day tomorrow, where would we go?',
  'What’s a little habit of mine you secretly love?',
  'What’s one worry you could hand to me today?',
  'What did you need more of this week: rest, fun, or a hug?',
  'Which place would you love to see with me one day?',
  'What’s your favourite way to spend a rainy evening together?',
  'What’s something you’re proud of yourself for lately?',
  'What’s a kind thing someone did for you recently?',
  'If you could relive one day with me, which would it be?',
  'What’s a dish you’d like us to learn to cook together?',
  'What makes you feel calm after a long day?',
  'What’s one thing about our first meeting you still remember?',
  'What tradition would you like us to start?',
  'What’s a small luxury that makes your day better?',
  'Which of our photos is your favourite, and why?',
  'What’s something new you learned about me this year?',
  'What’s one goal you’d like my help with?',
  'What do you appreciate most about our home?',
  'Which childhood memory still makes you happy?',
  'What’s a movie or series you’d love us to watch together?',
  'What does a really good weekend look like to you right now?',
  'What’s one thing I could do this week to make your life easier?',
  'What’s a compliment you’ve never told me but always thought?',
  'If we wrote a book about us, what would the title be?',
  'Which season of the year feels most like “us”?',
  'What’s something you’d like to stop worrying about?',
  'What’s your favourite thing we do without planning it?',
  'What’s a skill you’d love to learn this year?',
  'What’s one thing that always cheers you up?',
  'Which trip, big or small, would you happily repeat?',
  'What’s the best advice you’ve ever been given?',
  'What do you want our life to feel like in five years?',
  'What’s a tiny moment from today you want to remember?',
  'What’s your favourite thing about mornings with me?',
  'What makes you feel at home, wherever we are?',
  'What’s something you’re grateful for that we rarely talk about?',
  'Which of your friends would you love me to know better?',
  'What’s a dream you’ve had for a long time?',
  'What’s your favourite way to say sorry, or to hear it?',
  'What’s one thing we do as a team that you’re proud of?',
  'If today had a colour, what would it be?',
  'What’s the most comforting thing I’ve ever said to you?',
  'What’s something you’d love to do more often, just the two of us?',
  'Which small surprise would make your week?',
  'What’s a place near home you’d like us to explore?',
  'What helps you feel close to me when we’re apart?',
  'What’s one word you’d use to describe us this month?',
  'What would you tell the version of you from five years ago?',
  'What’s a gentle reminder you’d like from me this week?',
  'What’s your favourite smell, and what does it remind you of?',
  'What’s one thing you’d like us to celebrate soon?',
];

/** Same question for both partners on the same day; couples get different orders. */
export function questionFor(date: string, cid: string): { id: number; text: string } {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  let h = 0;
  for (let i = 0; i < cid.length; i++) h = (h * 31 + cid.charCodeAt(i)) >>> 0;
  const id = (((day + h) % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length;
  return { id, text: QUESTIONS[id] };
}

export const ANSWER_MAX = 500;

/** Where the day stands for me. */
export type QuestionStatus = 'answer-first' | 'partner-waiting' | 'waiting-for-partner' | 'both';

export function questionStatus(mine: boolean, partnerAnswered: boolean): QuestionStatus {
  if (mine && partnerAnswered) return 'both';
  if (mine) return 'waiting-for-partner';
  return partnerAnswered ? 'partner-waiting' : 'answer-first';
}
