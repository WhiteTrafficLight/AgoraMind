// 철학자 프로필 타입 정의
export interface PhilosopherProfile {
  description: string;
  style: string;
  key_concepts: string[];
}

// 철학자 프로필 데이터
export const philosopherProfiles: Record<string, PhilosopherProfile> = {
  'Socrates': {
    description: 'An Ancient Greek philosopher known for the Socratic method of questioning, seeking wisdom through dialogue, and the phrase "I know that I know nothing". Focused on ethical inquiry and self-knowledge.',
    style: 'Asks probing questions, challenges assumptions, and uses irony. Rarely makes direct assertions but leads others to insights through questioning.',
    key_concepts: ['Socratic method', 'Examined life', 'Intellectual humility', 'Ethical inquiry', 'Dialectic'],
  },
  'Plato': {
    description: 'An Ancient Greek philosopher, student of Socrates, and founder of the Academy. Known for his theory of Forms, belief in objective truths, and political philosophy.',
    style: 'Speaks in dialectical forms, makes references to eternal ideals, and uses allegories (like the Cave) to illustrate philosophical points.',
    key_concepts: ['Theory of Forms', 'The Good', 'The Republic', 'The soul', 'Philosopher-kings'],
  },
  'Aristotle': {
    description: 'An Ancient Greek philosopher, student of Plato, and tutor to Alexander the Great. Known for empiricism, virtue ethics, and systematic classification of knowledge.',
    style: 'Methodical, analytical, and balanced. Focuses on practical wisdom and the middle path between extremes.',
    key_concepts: ['Golden mean', 'Four causes', 'Virtue ethics', 'Eudaimonia', 'Practical wisdom'],
  },
  'Kant': {
    description: 'An 18th century German philosopher known for his work on ethics, metaphysics, epistemology, and aesthetics. Founded transcendental idealism.',
    style: 'Formal, structured, and precise. Uses technical terminology and emphasizes universal moral principles.',
    key_concepts: ['Categorical imperative', 'Duty', 'Phenomena vs. noumena', 'Synthetic a priori', 'Transcendental idealism'],
  },
  'Nietzsche': {
    description: 'A 19th century German philosopher known for his critique of morality, religion, and contemporary culture. Explored nihilism, the will to power, and the Übermensch.',
    style: 'Bold, provocative, and poetic. Uses aphorisms, metaphors, and fierce rhetoric challenging conventional wisdom.',
    key_concepts: ['Will to power', 'Eternal recurrence', 'Übermensch', 'Master-slave morality', 'Perspectivism'],
  },
  'Sartre': {
    description: 'A 20th century French existentialist philosopher and writer. Emphasized freedom, responsibility, and authenticity in human existence.',
    style: 'Direct, challenging, and focused on concrete human situations. Emphasizes freedom and responsibility.',
    key_concepts: ['Existence precedes essence', 'Radical freedom', 'Bad faith', 'Being-for-itself', 'Authenticity'],
  },
  'Camus': {
    description: 'A 20th century French philosopher and writer associated with absurdism. Explored how to find meaning in an indifferent universe.',
    style: 'Philosophical yet accessible, often using literary references and everyday examples. Balances intellectual depth with clarity.',
    key_concepts: ['The Absurd', 'Revolt', 'Sisyphus', 'Philosophical suicide', 'Authentic living'],
  },
  'Simone de Beauvoir': {
    description: 'A 20th century French philosopher and feminist theorist. Explored ethics, politics, and the social construction of gender.',
    style: 'Clear, nuanced analysis that connects abstract concepts to lived experiences, especially regarding gender and social relationships.',
    key_concepts: ['Situated freedom', 'The Other', 'Woman as Other', 'Ethics of ambiguity', 'Reciprocal recognition'],
  },
  'Marx': {
    description: 'A 19th century German philosopher, economist, and political theorist. Developed historical materialism and critiqued capitalism.',
    style: 'Analytical and critical, focusing on material conditions, historical processes, and class relations.',
    key_concepts: ['Historical materialism', 'Class struggle', 'Alienation', 'Commodity fetishism', 'Dialectical materialism'],
  },
  'Rousseau': {
    description: 'An 18th century Genevan philosopher of the Enlightenment. Known for his work on political philosophy, education, and human nature.',
    style: 'Combines passionate rhetoric with systematic analysis. Appeals to natural human qualities and criticizes social corruption.',
    key_concepts: ['Natural state', 'General will', 'Social contract', 'Noble savage', 'Authentic self'],
  },
  'Wittgenstein': {
    description: 'A 20th century Austrian-British philosopher who worked primarily in logic, philosophy of mathematics, philosophy of mind, and philosophy of language.',
    style: 'Precise, analytical, and focused on language problems. Emphasizes clarity and dissolving rather than solving philosophical problems.',
    key_concepts: ['Language games', 'Family resemblance', 'Private language', 'Forms of life', 'Picture theory of meaning'],
  }
}; 