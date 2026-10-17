import { supabase } from './supabase'

export type Question = {
  id: string
  partnerPrompt: string   // asked as a prediction: "What would your partner choose?"
  selfPrompt: string      // asked about yourself
  options: [string, string, string, string]
}

// Every question has exactly four options, so answers are stored as 0 to 3.
export const QUESTIONS: Question[] = [
  { id: 'appreciated', partnerPrompt: 'What makes your partner feel most appreciated?', selfPrompt: 'What makes you feel most appreciated?',
    options: ['A thoughtful text during the day', 'Doing something small without being asked', 'Hearing exactly why they matter', 'Quality time with no phones'] },
  { id: 'unwind', partnerPrompt: 'What helps your partner unwind after a hard day?', selfPrompt: 'What helps you unwind after a hard day?',
    options: ['A cup of tea together', 'Some quiet space to themselves', 'A walk outside', 'Someone to listen without fixing it'] },
  { id: 'saturday', partnerPrompt: 'How does your partner like to spend a free Saturday?', selfPrompt: 'How do you like to spend a free Saturday?',
    options: ['A slow morning at home', 'Exploring somewhere new', 'Seeing friends', 'A cosy film night'] },
  { id: 'stressed', partnerPrompt: 'When your partner is stressed, what do they usually need?', selfPrompt: 'When you are stressed, what do you usually need?',
    options: ['A hug', 'Practical help', 'To talk it through', 'A little time alone'] },
  { id: 'surprise', partnerPrompt: 'What kind of surprise would make your partner smile most?', selfPrompt: 'What kind of surprise would make you smile most?',
    options: ['A handwritten note', 'Their favourite treat', 'A plan for a day out', 'Something they have been wanting'] },
  { id: 'treat', partnerPrompt: 'Which food feels most like a treat to your partner?', selfPrompt: 'Which food feels most like a treat to you?',
    options: ['Something sweet', 'A takeaway from a favourite place', 'A home-cooked meal', 'Street food'] },
  { id: 'celebrate', partnerPrompt: 'How does your partner like to celebrate good news?', selfPrompt: 'How do you like to celebrate good news?',
    options: ['A quiet dinner for two', 'A big night out with friends', 'A small gift', 'A call with family'] },
  { id: 'repair', partnerPrompt: 'After a disagreement, what helps your partner most?', selfPrompt: 'After a disagreement, what helps you most?',
    options: ['A calm talk later', 'A sincere apology', 'Some space first', 'A hug and a fresh start'] },
  { id: 'morning', partnerPrompt: 'What is your partner\'s ideal start to the day?', selfPrompt: 'What is your ideal start to the day?',
    options: ['A slow coffee', 'A workout', 'Quiet time alone', 'Chatting in bed'] },
  { id: 'fun', partnerPrompt: 'What does your partner find most fun?', selfPrompt: 'What do you find most fun?',
    options: ['Games', 'Music', 'Being outdoors', 'Laughing with friends'] },
  { id: 'close', partnerPrompt: 'What helps your partner feel closest to you?', selfPrompt: 'What helps you feel closest to your partner?',
    options: ['Long conversations', 'Physical affection', 'A shared project', 'Time apart, then coming back together'] },
  { id: 'trip', partnerPrompt: 'Which kind of trip would your partner love most?', selfPrompt: 'Which kind of trip would you love most?',
    options: ['A city break', 'A beach', 'A mountain or nature retreat', 'A road trip with no plan'] },
]

export const getQuestion = (id: string) => QUESTIONS.find((q) => q.id === id)
const pickQuestion = () => QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]

export type GuessState = {
  round: { id: string; question_id: string; status: 'open' | 'revealed' } | null
  partner_name: string
  me?: { self: number | null; guess: number | null }
  partner_progress?: { self: boolean; guess: boolean }
  reveal?: { my_guess: number; partner_self: number; partner_guess: number; my_self: number } | null
}

export async function getConnectionId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('couple_connections')
    .select('id')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('invitation_status', 'accepted')
    .maybeSingle()
  return data?.id ?? null
}

const FRIENDLY: Record<string, string> = {
  round_in_progress: 'Your current round is still open. Finish it first.',
  not_connected: 'You are not connected to a partner yet.',
  round_closed: 'This round has already been revealed.',
  invalid_answer: 'That answer did not save. Please try again.',
}

async function call(fn: string, args: Record<string, unknown>): Promise<GuessState> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const key = Object.keys(FRIENDLY).find((k) => error.message.includes(k))
    throw new Error(key ? FRIENDLY[key] : 'Something went wrong. Please try again.')
  }
  return data as GuessState
}

export const guessMeState = (connectionId: string) =>
  call('guess_me_state', { p_connection: connectionId })

export const guessMeBegin = (connectionId: string) =>
  call('guess_me_begin', { p_connection: connectionId, p_question: pickQuestion().id })

export const guessMeAnswer = (connectionId: string, roundId: string, about: 'self' | 'guess', choice: number) =>
  call('guess_me_answer', { p_connection: connectionId, p_round: roundId, p_about: about, p_choice: choice })

export const guessMeClose = (connectionId: string, roundId: string) =>
  call('guess_me_close', { p_connection: connectionId, p_round: roundId })
