import { TRPCError } from '@trpc/server';
import type { RawBuilder } from 'kysely';
import { sql } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import {
  CustomFieldValidationError,
  persistEntityCustomFields,
} from '$lib/server/utils/custom-fields';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';

type EntityType = 'flight';
const entityTypeSchema = z.enum(['flight']);

/** Convert a JS value to a Kysely `::jsonb` expression, or null. */
const toJsonb = (value: unknown): RawBuilder<unknown> | null =>
  value != null ? sql`${JSON.stringify(value)}::jsonb` : null;
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
  const validation = input.validationJson ?? null;

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

  if (!validation) return;

  if (TEXT_LIKE_TYPES.has(input.fieldType)) {
    if (validation.regex) {
      try {
        // Validate regex at definition-save time to avoid blocking future flight saves.
        // eslint-disable-next-line no-new
        new RegExp(validation.regex);
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Regex pattern is invalid',
        });
      }
    }

    if (
      typeof validation.minLength === 'number' &&
      typeof validation.maxLength === 'number' &&
      validation.minLength > validation.maxLength
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Min length cannot be greater than max length',
      });
    }
  }

  if (
    input.fieldType === 'number' &&
    typeof validation.min === 'number' &&
    typeof validation.max === 'number' &&
    validation.min > validation.max
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Min value cannot be greater than max value',
    });
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
          options: toJsonb(input.options),
          defaultValue: toJsonb(input.defaultValue),
          validationJson: toJsonb(input.validationJson),
          updatedAt: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }),

  updateDefinition: adminProcedure
    .input(definitionInputSchema.extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      ensureDefinitionIsValid(input);

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
          options: toJsonb(input.options),
          defaultValue: toJsonb(input.defaultValue),
          validationJson: toJsonb(input.validationJson),
          updatedAt: new Date(),
        })
        .where('id', '=', input.id)
        .where('entityType', '=', input.entityType)
        .returningAll()
        .executeTakeFirstOrThrow();
    }),

  reorderDefinitions: adminProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        orderedIds: z.array(z.number().int()).max(100),
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
    .input(z.object({ id: z.number().int(), entityType: entityTypeSchema }))
    .mutation(async ({ input }) => {
      await db
        .deleteFrom('customFieldDefinition')
        .where('id', '=', input.id)
        .where('entityType', '=', input.entityType)
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
      try {
        await db.transaction().execute(async (trx) => {
          await persistEntityCustomFields(trx, {
            entityType: input.entityType,
            entityId: input.entityId,
            values: input.values,
          });
        });
      } catch (e) {
        if (e instanceof CustomFieldValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e.message,
          });
        }
        throw e;
      }
      return true;
    }),
});
