export const SUBJECTS = [
  'scratch',
  'arduino',
  'tinkercad',
  'video-edicion',
  'python',
  'minecraft-edu',
  'roblox',
  'ml4k',
  'ia-gen',
  'unity',
  'javascript',
  'godot',
  'vibecoding',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABEL: Record<Subject, string> = {
  scratch: 'Scratch',
  arduino: 'Arduino',
  tinkercad: 'Tinkercad',
  'video-edicion': 'Edición de Video',
  python: 'Python',
  'minecraft-edu': 'Minecraft Education',
  roblox: 'Roblox',
  ml4k: 'ML4K (IA)',
  'ia-gen': 'IA Gen',
  unity: 'Unity',
  javascript: 'JavaScript',
  godot: 'Godot',
  vibecoding: 'Vibecoding',
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
