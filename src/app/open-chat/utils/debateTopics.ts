import debateTopicsData from '../../../../data/debate_topics.json';

export interface DebateContext {
  type: 'text' | 'url' | 'pdf' | '';
  content: string;
}

export interface DebateTopic {
  title: string;
  context: DebateContext;
  moderator_style: number;
  pro_philosophers: string[];
  con_philosophers: string[];
}

export interface DebateCategory {
  name: string;
  topics: DebateTopic[];
}

export interface DebateTopicsData {
  categories: {
    [key: string]: DebateCategory;
  };
}

// Type assertion for the imported JSON
const typedDebateTopicsData = debateTopicsData as DebateTopicsData;

export const getDebateCategories = (): { key: string; category: DebateCategory }[] => {
  return Object.entries(typedDebateTopicsData.categories).map(([key, category]) => ({
    key,
    category
  }));
};

export const getCategoryByKey = (key: string): DebateCategory | null => {
  return typedDebateTopicsData.categories[key] || null;
};

export const getTopicsByCategory = (categoryKey: string): DebateTopic[] => {
  const category = getCategoryByKey(categoryKey);
  return category ? category.topics : [];
};

// Category display configurations
export const categoryDisplayConfig = {
  dilemma_challenge: {
    title: 'Dilemma Challenge',
    color: 'bg-red-50 border-red-200',
    description: 'Ethical dilemmas that challenge your moral compass',
    image: '/topic_categories/Dilemma.png'
  },
  self_and_philosophy: {
    title: 'Self & Philosophy',
    color: 'bg-blue-50 border-blue-200',
    description: 'Deep questions about existence and identity',
    image: '/topic_categories/Philosophy.png'
  },
  global_and_current_affairs: {
    title: 'Global & Current Affairs',
    color: 'bg-green-50 border-green-200',
    description: 'Contemporary issues shaping our world',
    image: '/topic_categories/Global.png'
  },
  science_and_technology: {
    title: 'Science & Technology',
    color: 'bg-purple-50 border-purple-200',
    description: 'The ethical implications of scientific progress',
    image: '/topic_categories/Tech.png'
  }
}; 