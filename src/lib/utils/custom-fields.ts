export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'airport'
  | 'airline'
  | 'aircraft';

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  boolean: 'Boolean',
  date: 'Date',
  select: 'Select',
  'multi-select': 'Multi-select',
  airport: 'Airport',
  airline: 'Airline',
  aircraft: 'Aircraft',
};

/** Shape returned by `listDefinitions` query — shared across all custom field UI. */
export type CustomFieldDefinition = {
  id: number;
  entityType: EntityType;
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

export type EntityType = 'flight' | 'flight_passenger';

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  flight: 'Flight fields',
  flight_passenger: 'Passenger fields',
};

export const isTextLike = (fieldType: string) =>
  fieldType === 'text' || fieldType === 'textarea';

export const isEntityType = (fieldType: string) =>
  fieldType === 'airport' ||
  fieldType === 'airline' ||
  fieldType === 'aircraft';

/** Extract a string[] from an unknown options value (typically JSON from DB). */
export const normalizeOptions = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === 'string')
    : [];
