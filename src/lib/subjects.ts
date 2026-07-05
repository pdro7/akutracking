export const SUBJECTS = [
  'robotica',
  'python',
  'minecraft',
  'roblox',
  'unity',
  'youtube',
  'ia',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABEL: Record<Subject, string> = {
  robotica: 'Robótica',
  python: 'Python',
  minecraft: 'Minecraft',
  roblox: 'Roblox',
  unity: 'Unity',
  youtube: 'YouTube Creator',
  ia: 'IA',
};

export const MODALITIES = ['virtual', 'presencial'] as const;
export type Modality = (typeof MODALITIES)[number];

export const MODALITY_LABEL: Record<Modality, string> = {
  virtual: 'Virtual',
  presencial: 'Presencial',
};

export const LEAD_MODALITY_OPTIONS = [
  { value: 'virtual', label: 'Virtual' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'any', label: 'Cualquiera' },
] as const;
