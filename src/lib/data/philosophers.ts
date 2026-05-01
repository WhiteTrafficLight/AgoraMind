export interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost?: boolean;
}

export interface PhilosopherVoice {
  id: string;
  settings: ElevenLabsVoiceSettings;
}

export interface Philosopher {
  id: string;
  name: string;
  aliases?: string[];
  description?: string;
  style?: string;
  keyConcepts?: string[];
  portraitFile?: string;
  fineTuned?: boolean;
  voice?: PhilosopherVoice;
}

export const PHILOSOPHERS: Record<string, Philosopher> = {
  socrates: {
    id: 'socrates',
    name: 'Socrates',
    portraitFile: 'Socrates',
    description: 'An Ancient Greek philosopher known for the Socratic method of questioning, seeking wisdom through dialogue, and the phrase "I know that I know nothing". Focused on ethical inquiry and self-knowledge.',
    style: 'Asks probing questions, challenges assumptions, and uses irony. Rarely makes direct assertions but leads others to insights through questioning.',
    keyConcepts: ['Socratic method', 'Examined life', 'Intellectual humility', 'Ethical inquiry', 'Dialectic'],
    voice: {
      id: 'N2lVS1w4EtoT3dr4eOWO',
      settings: { stability: 0.6, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    },
  },
  plato: {
    id: 'plato',
    name: 'Plato',
    portraitFile: 'Plato',
    description: 'An Ancient Greek philosopher, student of Socrates, and founder of the Academy. Known for his theory of Forms, belief in objective truths, and political philosophy.',
    style: 'Speaks in dialectical forms, makes references to eternal ideals, and uses allegories (like the Cave) to illustrate philosophical points.',
    keyConcepts: ['Theory of Forms', 'The Good', 'The Republic', 'The soul', 'Philosopher-kings'],
    fineTuned: true,
    voice: {
      id: 'VR6AewLTigWG4xSOukaG',
      settings: { stability: 0.7, similarity_boost: 0.7, style: 0.5, use_speaker_boost: true },
    },
  },
  aristotle: {
    id: 'aristotle',
    name: 'Aristotle',
    portraitFile: 'Aristotle',
    description: 'An Ancient Greek philosopher, student of Plato, and tutor to Alexander the Great. Known for empiricism, virtue ethics, and systematic classification of knowledge.',
    style: 'Methodical, analytical, and balanced. Focuses on practical wisdom and the middle path between extremes.',
    keyConcepts: ['Golden mean', 'Four causes', 'Virtue ethics', 'Eudaimonia', 'Practical wisdom'],
    voice: {
      id: 'ErXwobaYiN019PkySvjV',
      settings: { stability: 0.8, similarity_boost: 0.6, style: 0.4, use_speaker_boost: true },
    },
  },
  kant: {
    id: 'kant',
    name: 'Kant',
    aliases: ['immanuel kant'],
    portraitFile: 'Kant',
    description: 'An 18th century German philosopher known for his work on ethics, metaphysics, epistemology, and aesthetics. Founded transcendental idealism.',
    style: 'Formal, structured, and precise. Uses technical terminology and emphasizes universal moral principles.',
    keyConcepts: ['Categorical imperative', 'Duty', 'Phenomena vs. noumena', 'Synthetic a priori', 'Transcendental idealism'],
    voice: {
      id: 'SOYHLrjzK2X1ezoPC6cr',
      settings: { stability: 0.9, similarity_boost: 0.5, style: 0.4, use_speaker_boost: true },
    },
  },
  nietzsche: {
    id: 'nietzsche',
    name: 'Nietzsche',
    aliases: ['friedrich nietzsche'],
    portraitFile: 'Nietzsche',
    description: 'A 19th century German philosopher known for his critique of morality, religion, and contemporary culture. Explored nihilism, the will to power, and the Übermensch.',
    style: 'Bold, provocative, and poetic. Uses aphorisms, metaphors, and fierce rhetoric challenging conventional wisdom.',
    keyConcepts: ['Will to power', 'Eternal recurrence', 'Übermensch', 'Master-slave morality', 'Perspectivism'],
    fineTuned: true,
    voice: {
      id: 'pNInz6obpgDQGcFmaJgB',
      settings: { stability: 0.4, similarity_boost: 0.9, style: 0.8, use_speaker_boost: true },
    },
  },
  sartre: {
    id: 'sartre',
    name: 'Sartre',
    aliases: ['jean-paul sartre'],
    portraitFile: 'Sartre',
    description: 'A 20th century French existentialist philosopher and writer. Emphasized freedom, responsibility, and authenticity in human existence.',
    style: 'Direct, challenging, and focused on concrete human situations. Emphasizes freedom and responsibility.',
    keyConcepts: ['Existence precedes essence', 'Radical freedom', 'Bad faith', 'Being-for-itself', 'Authenticity'],
    fineTuned: true,
    voice: {
      id: 'flq6f7yk4E4fJM5XTYuZ',
      settings: { stability: 0.6, similarity_boost: 0.7, style: 0.6, use_speaker_boost: true },
    },
  },
  camus: {
    id: 'camus',
    name: 'Camus',
    aliases: ['albert camus'],
    portraitFile: 'Camus',
    description: 'A 20th century French philosopher and writer associated with absurdism. Explored how to find meaning in an indifferent universe.',
    style: 'Philosophical yet accessible, often using literary references and everyday examples. Balances intellectual depth with clarity.',
    keyConcepts: ['The Absurd', 'Revolt', 'Sisyphus', 'Philosophical suicide', 'Authentic living'],
    fineTuned: true,
    voice: {
      id: 'XB0fDUnXU5powFXDhCwa',
      settings: { stability: 0.6, similarity_boost: 0.7, style: 0.5, use_speaker_boost: true },
    },
  },
  beauvoir: {
    id: 'beauvoir',
    name: 'Simone de Beauvoir',
    aliases: ['simone de beauvoir'],
    portraitFile: 'Beauvoir',
    description: 'A 20th century French philosopher and feminist theorist. Explored ethics, politics, and the social construction of gender.',
    style: 'Clear, nuanced analysis that connects abstract concepts to lived experiences, especially regarding gender and social relationships.',
    keyConcepts: ['Situated freedom', 'The Other', 'Woman as Other', 'Ethics of ambiguity', 'Reciprocal recognition'],
  },
  marx: {
    id: 'marx',
    name: 'Marx',
    aliases: ['karl marx'],
    portraitFile: 'Marx',
    description: 'A 19th century German philosopher, economist, and political theorist. Developed historical materialism and critiqued capitalism.',
    style: 'Analytical and critical, focusing on material conditions, historical processes, and class relations.',
    keyConcepts: ['Historical materialism', 'Class struggle', 'Alienation', 'Commodity fetishism', 'Dialectical materialism'],
  },
  rousseau: {
    id: 'rousseau',
    name: 'Rousseau',
    aliases: ['jean-jacques rousseau'],
    portraitFile: 'Rousseau',
    description: 'An 18th century Genevan philosopher of the Enlightenment. Known for his work on political philosophy, education, and human nature.',
    style: 'Combines passionate rhetoric with systematic analysis. Appeals to natural human qualities and criticizes social corruption.',
    keyConcepts: ['Natural state', 'General will', 'Social contract', 'Noble savage', 'Authentic self'],
  },
  wittgenstein: {
    id: 'wittgenstein',
    name: 'Wittgenstein',
    aliases: ['ludwig wittgenstein'],
    portraitFile: 'Wittgenstein',
    description: 'A 20th century Austrian-British philosopher who worked primarily in logic, philosophy of mathematics, philosophy of mind, and philosophy of language.',
    style: 'Precise, analytical, and focused on language problems. Emphasizes clarity and dissolving rather than solving philosophical problems.',
    keyConcepts: ['Language games', 'Family resemblance', 'Private language', 'Forms of life', 'Picture theory of meaning'],
  },
  confucius: {
    id: 'confucius',
    name: 'Confucius',
    portraitFile: 'Confucius',
  },
  laozi: {
    id: 'laozi',
    name: 'Laozi',
    portraitFile: 'Laozi',
  },
  buddha: {
    id: 'buddha',
    name: 'Buddha',
    portraitFile: 'Buddha',
    fineTuned: true,
  },
  hegel: {
    id: 'hegel',
    name: 'Hegel',
    aliases: ['georg wilhelm friedrich hegel'],
    portraitFile: 'Hegel',
  },
};

export const DEFAULT_VOICE: PhilosopherVoice = {
  id: 'TxGEqnHWrfWFTfGW9XjX',
  settings: { stability: 0.6, similarity_boost: 0.7, style: 0.3, use_speaker_boost: true },
};

export const USER_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export function resolvePhilosopher(query: string): Philosopher | undefined {
  const normalized = query.trim().toLowerCase();
  const direct = PHILOSOPHERS[normalized];
  if (direct) return direct;
  for (const p of Object.values(PHILOSOPHERS)) {
    if (p.name.toLowerCase() === normalized) return p;
    if (p.aliases?.includes(normalized)) return p;
  }
  return undefined;
}

export function getPhilosopherPortraitPath(query: string): string {
  const philosopher = resolvePhilosopher(query);
  if (philosopher?.portraitFile) {
    return `/philosophers_portraits/${philosopher.portraitFile}.png`;
  }
  const words = query.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  const cap = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
  return `/philosophers_portraits/${cap}.png`;
}
