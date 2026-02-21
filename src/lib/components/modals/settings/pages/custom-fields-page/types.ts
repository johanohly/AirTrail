export type {
  FieldType,
  CustomFieldDefinition as DefinitionItem,
} from '$lib/utils/custom-fields';
export { FIELD_TYPE_LABELS } from '$lib/utils/custom-fields';

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
  fieldType: import('$lib/utils/custom-fields').FieldType;
  required: boolean;
  active: boolean;
  order: number;
  optionsText: string;
  defaultValue: unknown;
  validationRegex: string;
  validationMin: string;
  validationMax: string;
  validationMinLength: string;
  validationMaxLength: string;
};
