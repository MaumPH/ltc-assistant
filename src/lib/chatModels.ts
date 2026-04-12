export const CHAT_MODELS = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    description: 'Fast general-purpose model for everyday grounded answers.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    description: 'Higher-depth reasoning model for complex grounded questions.',
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite',
    description: 'Lower-cost fast model for lightweight grounded answers.',
  },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]['id'];

export const MODEL_STORAGE = 'ltc_gemini_model';
