import { TRPCError } from '@trpc/server';
import { sql } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';

type EntityType = 'flight';
const entityTypeSchema = z.enum(['flight']);
const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'select',
  'airport',
  'airline',
  'aircraft',
]);

/** Field types that store string values and share text validation rules. */
const TEXT_LIKE_TYPES = new Set(['text', 'textarea']);

/** Field types that store a numeric entity ID (foreign key). */
const ENTITY_TYPES = new Set(['airport', 'airline', 'aircraft']);

const validationSchema = z
  .object({
    regex: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().optional(),
    maxLength: z.number().int().optional(),
  })
  .partial();

const definitionInputSchema = z.object({
  entityType: entityTypeSchema,
  key: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(80),
  description: z.string().max(200).nullable().optional(),
  fieldType: fieldTypeSchema,
  required: z.boolean().default(false),
  active: z.boolean().default(true),
  order: z.number().int().default(0),
  options: z.array(z.string().min(1)).optional(),
  defaultValue: z.any().optional(),
  validationJson: validationSchema.nullable().optional(),
});

const valueInputSchema = z.object({
  fieldId: z.number().int(),
  value: z.any().nullable(),
});

const ensureDefinitionIsValid = (
  input: z.infer<typeof definitionInputSchema>,
) => {
  const options = input.options ?? [];

  if (input.fieldType === 'select' && options.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Select fields require at least one option',
    });
  }

  if (input.defaultValue != null) {
    if (
      TEXT_LIKE_TYPES.has(input.fieldType) &&
      typeof input.defaultValue !== 'string'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Default value must be a string for text fields',
      });
    }

    if (
      input.fieldType === 'number' &&
      typeof input.defaultValue !== 'number'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Default value must be a number for number fields',
      });
    }

    if (
      input.fieldType === 'boolean' &&
      typeof input.defaultValue !== 'boolean'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Default value must be a boolean for boolean fields',
      });
    }

    if (input.fieldType === 'date' && typeof input.defaultValue !== 'string') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Default value must be a string for date fields',
      });
    }

    if (input.fieldType === 'select') {
      if (typeof input.defaultValue !== 'string') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Default value must be a string for select fields',
        });
      }

      if (!options.includes(input.defaultValue)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Default value must be one of the select options',
        });
      }
    }

    if (
      ENTITY_TYPES.has(input.fieldType) &&
      typeof input.defaultValue !== 'number'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Default value must be a numeric ID for entity fields',
      });
    }
  }
};

async function assertEntityAccess(
  entityType: EntityType,
  entityId: string,
  user: { id: string; role: string },
) {
  if (entityType === 'flight') {
    const flightId = Number(entityId);
    if (!Number.isFinite(flightId)) {
      throw new TRPCError({ code: 'BAD_REQUEST' });
    }

    const flight = await db
      .selectFrom('flight')
      .select('id')
      .where('id', '=', flightId)
      .executeTakeFirst();

    if (!flight) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (user.role === 'admin' || user.role === 'owner') {
      return;
    }

    const seat = await db
      .selectFrom('seat')
      .select('id')
      .where('flightId', '=', flightId)
      .where('userId', '=', user.id)
      .executeTakeFirst();

    if (!seat) throw new TRPCError({ code: 'FORBIDDEN' });
    return;
  }

  throw new TRPCError({ code: 'BAD_REQUEST' });
}

export const customFieldRouter = router({
  listDefinitions: authedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        includeInactive: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      let q = db
        .selectFrom('customFieldDefinition')
        .selectAll()
        .where('entityType', '=', input.entityType)
        .orderBy('order', 'asc')
        .orderBy('label', 'asc');

      if (!input.includeInactive) {
        q = q.where('active', '=', true);
      }

      return await q.execute();
    }),

  createDefinition: adminProcedure
    .input(definitionInputSchema)
    .mutation(async ({ input }) => {
      ensureDefinitionIsValid(input);

      const defaultValue =
        input.defaultValue != null
          ? sql`${JSON.stringify(input.defaultValue)}::jsonb`
          : null;
      const validationJson =
        input.validationJson != null
          ? sql`${JSON.stringify(input.validationJson)}::jsonb`
          : null;
      const options =
        input.options != null
          ? sql`${JSON.stringify(input.options)}::jsonb`
          : null;

      return await db
        .insertInto('customFieldDefinition')
        .values({
          entityType: input.entityType,
          key: input.key,
          label: input.label,
          description: input.description ?? null,
          fieldType: input.fieldType,
          required: input.required,
          active: input.active,
          order: input.order,
          options,
          defaultValue,
          validationJson,
          updatedAt: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }),

  updateDefinition: adminProcedure
    .input(definitionInputSchema.extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      ensureDefinitionIsValid(input);

      const defaultValue =
        input.defaultValue != null
          ? sql`${JSON.stringify(input.defaultValue)}::jsonb`
          : null;
      const validationJson =
        input.validationJson != null
          ? sql`${JSON.stringify(input.validationJson)}::jsonb`
          : null;
      const options =
        input.options != null
          ? sql`${JSON.stringify(input.options)}::jsonb`
          : null;

      return await db
        .updateTable('customFieldDefinition')
        .set({
          entityType: input.entityType,
          key: input.key,
          label: input.label,
          description: input.description ?? null,
          fieldType: input.fieldType,
          required: input.required,
          active: input.active,
          order: input.order,
          options,
          defaultValue,
          validationJson,
          updatedAt: new Date(),
        })
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }),

  reorderDefinitions: adminProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        orderedIds: z.array(z.number().int()),
      }),
    )
    .mutation(async ({ input }) => {
      await db.transaction().execute(async (trx) => {
        for (let i = 0; i < input.orderedIds.length; i++) {
          await trx
            .updateTable('customFieldDefinition')
            .set({ order: i, updatedAt: new Date() })
            .where('id', '=', input.orderedIds[i]!)
            .where('entityType', '=', input.entityType)
            .execute();
        }
      });
      return true;
    }),

  deleteDefinition: adminProcedure
    .input(z.number().int())
    .mutation(async ({ input }) => {
      await db
        .deleteFrom('customFieldDefinition')
        .where('id', '=', input)
        .execute();
      return true;
    }),

  getEntityValues: authedProcedure
    .input(z.object({ entityType: entityTypeSchema, entityId: z.string() }))
    .query(async ({ ctx: { user }, input }) => {
      await assertEntityAccess(input.entityType, input.entityId, user);

      const rows = await db
        .selectFrom('customFieldValue as v')
        .innerJoin('customFieldDefinition as d', 'd.id', 'v.fieldId')
        .select([
          'v.fieldId',
          'v.value',
          'd.key',
          'd.label',
          'd.fieldType',
          'd.required',
          'd.options',
          'd.defaultValue',
          'd.order',
        ])
        .where('v.entityType', '=', input.entityType)
        .where('v.entityId', '=', input.entityId)
        .where('d.active', '=', true)
        .orderBy('d.order', 'asc')
        .execute();

      return rows;
    }),

  setEntityValues: authedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        values: z.array(valueInputSchema),
      }),
    )
    .mutation(async ({ ctx: { user }, input }) => {
      await assertEntityAccess(input.entityType, input.entityId, user);

      const defs = await db
        .selectFrom('customFieldDefinition')
        .select(['id', 'fieldType', 'required', 'options', 'validationJson'])
        .where('entityType', '=', input.entityType)
        .where('active', '=', true)
        .execute();

      const defsById = new Map(defs.map((d) => [d.id, d]));
      const existing = await db
        .selectFrom('customFieldValue')
        .select(['fieldId', 'value'])
        .where('entityType', '=', input.entityType)
        .where('entityId', '=', input.entityId)
        .execute();

      const mergedValues = new Map<number, unknown>(
        existing.map((row) => [row.fieldId, row.value]),
      );

      for (const item of input.values) {
        if (!defsById.has(item.fieldId)) continue;
        if (item.value === null || item.value === '') {
          mergedValues.delete(item.fieldId);
        } else {
          mergedValues.set(item.fieldId, item.value);
        }
      }

      for (const def of defs) {
        const value = mergedValues.get(def.id);

        if (
          def.required &&
          (value === undefined || value === null || value === '')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Required custom field is missing (fieldId=${def.id})`,
          });
        }

        if (value == null) continue;

        if (TEXT_LIKE_TYPES.has(def.fieldType) && typeof value !== 'string') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Text custom field requires a string value (fieldId=${def.id})`,
          });
        }

        if (def.fieldType === 'number' && typeof value !== 'number') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Number custom field requires a numeric value (fieldId=${def.id})`,
          });
        }

        if (def.fieldType === 'boolean' && typeof value !== 'boolean') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Boolean custom field requires a boolean value (fieldId=${def.id})`,
          });
        }

        if (def.fieldType === 'date' && typeof value !== 'string') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Date custom field requires a string value (fieldId=${def.id})`,
          });
        }

        if (def.fieldType === 'select') {
          if (typeof value !== 'string') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Select custom field requires a string value (fieldId=${def.id})`,
            });
          }

          const options = Array.isArray(def.options)
            ? def.options.filter((x): x is string => typeof x === 'string')
            : [];

          if (!options.includes(value)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Select custom field value must be one of its options (fieldId=${def.id})`,
            });
          }
        }

        if (ENTITY_TYPES.has(def.fieldType) && typeof value !== 'number') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${def.fieldType} custom field requires a numeric ID (fieldId=${def.id})`,
          });
        }

        const validation =
          def.validationJson && typeof def.validationJson === 'object'
            ? (def.validationJson as {
                regex?: string;
                min?: number;
                max?: number;
                minLength?: number;
                maxLength?: number;
              })
            : null;

        if (
          TEXT_LIKE_TYPES.has(def.fieldType) &&
          typeof value === 'string' &&
          validation
        ) {
          if (validation.regex) {
            const re = new RegExp(validation.regex);
            if (!re.test(value)) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Custom field does not match regex (fieldId=${def.id})`,
              });
            }
          }

          if (
            typeof validation.minLength === 'number' &&
            value.length < validation.minLength
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Custom field shorter than minimum length (fieldId=${def.id})`,
            });
          }

          if (
            typeof validation.maxLength === 'number' &&
            value.length > validation.maxLength
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Custom field longer than maximum length (fieldId=${def.id})`,
            });
          }
        }

        if (
          def.fieldType === 'number' &&
          typeof value === 'number' &&
          validation
        ) {
          if (typeof validation.min === 'number' && value < validation.min) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Custom field lower than minimum value (fieldId=${def.id})`,
            });
          }

          if (typeof validation.max === 'number' && value > validation.max) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Custom field higher than maximum value (fieldId=${def.id})`,
            });
          }
        }
      }

      await db.transaction().execute(async (trx) => {
        for (const item of input.values) {
          if (!defsById.has(item.fieldId)) continue;

          if (item.value === null || item.value === '') {
            await trx
              .deleteFrom('customFieldValue')
              .where('fieldId', '=', item.fieldId)
              .where('entityType', '=', input.entityType)
              .where('entityId', '=', input.entityId)
              .execute();
            continue;
          }

          const jsonValue = JSON.stringify(item.value);

          const now = new Date();

          await trx
            .insertInto('customFieldValue')
            .values({
              fieldId: item.fieldId,
              entityType: input.entityType,
              entityId: input.entityId,
              value: sql`${jsonValue}::jsonb`,
              updatedAt: now,
            })
            .onConflict((oc) =>
              oc.columns(['fieldId', 'entityType', 'entityId']).doUpdateSet({
                value: sql`${jsonValue}::jsonb`,
                updatedAt: now,
              }),
            )
            .execute();
        }
      });

      return true;
    }),
});
