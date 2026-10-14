// Categories that are shared with a linked partner by default (must match the SQL policy).
export const DEFAULT_SHARED_CATEGORIES = ['preferences', 'dislikes']
export const isDefaultShared = (category: string) => DEFAULT_SHARED_CATEGORIES.includes(category)

export const STARTER_PROMPTS = [
  { label: 'Things I love', text: 'Some things I really love: ' },
  { label: "Things I can't stand", text: "Things I really can't stand: " },
  { label: 'What makes me feel appreciated', text: 'I feel most appreciated when ' },
  { label: 'My favourite food & places', text: 'My favourite food and places are ' },
  { label: 'A date that matters to me', text: 'A date that matters a lot to me is ' },
  { label: 'How I like to be comforted', text: "When I'm having a hard day, what helps me most is " },
]
