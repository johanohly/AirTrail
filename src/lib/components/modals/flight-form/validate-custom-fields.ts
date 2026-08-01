import {
  type CustomFieldDefinition,
  validateCustomFieldValue,
} from '$lib/utils/custom-fields';

type FieldDef = Pick<
  CustomFieldDefinition,
  'id' | 'label' | 'fieldType' | 'required' | 'options' | 'validationJson'
>;

/**
 * Validate custom field values against their definitions.
 * Returns a map of fieldId → error message. Empty map means valid.
 */
export const validateCustomFields = (
  definitions: FieldDef[],
  values: Record<number, unknown>,
): Record<number, string> => {
  const errors: Record<number, string> = {};
  for (const def of definitions) {
    const error = validateCustomFieldValue(def, values[def.id]);
    if (error) errors[def.id] = error;
  }
  return errors;
};
