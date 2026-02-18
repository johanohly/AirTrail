export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select';

export type DefinitionItem = {
  id: number;
  entityType: 'flight';
  key: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  required: boolean;
  active: boolean;
  order: number;
  options: unknown;
  defaultValue: unknown;
  validationJson: unknown;
};

export type Validation = {
  regex?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
};

export type EditingState = {
  id?: number;
  key: string;
  label: string;
  description: string;
  fieldType: FieldType;
  required: boolean;
  active: boolean;
  order: number;
  optionsText: string;
  defaultText: string;
  defaultNumber: string;
  defaultBoolean: boolean;
  defaultDate: string;
  defaultSelect: string;
  validationRegex: string;
  validationMin: string;
  validationMax: string;
  validationMinLength: string;
  validationMaxLength: string;
};
