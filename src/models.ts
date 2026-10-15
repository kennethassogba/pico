export const DECIDER = 'inception/mercury-decide:free';
export const GENERATION_MODELS = [
  'nvidia/nemotron-3.5-lightning:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
] as const;
export const GENERATOR = GENERATION_MODELS[0];
export const QUALITY_MODEL = GENERATION_MODELS[2];
