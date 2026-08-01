import { TRPCError } from '@trpc/server';
import type { RawBuilder } from 'kysely';
import { sql } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';
import {
  CustomFieldValidationError,
  persistEntityCustomFields,
} from '$lib/server/utils/custom-fields';
import {
  CUSTOM_FIELD_ENTITY_TYPES,
  CUSTOM_FIELD_TYPES,
  type EntityType,
  validateCustomFieldDefinition,
} from '$lib/utils/custom-fields';

const entityTypeSchema = z.enum(CUSTOM_FIELD_ENTITY_TYPES);

/** Convert a JS value to a Kysely `::jsonb` expression, or null. */
const toJsonb = (value: unknown): RawBuilder<unknown> | null =>
  value != null ? sql`${JSON.stringify(value)}::jsonb` : null;
const fieldTypeSchema = z.enum(CUSTOM_FIELD_TYPES);

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

const badRequest = (message: string): never => {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
};

const ensureDefinitionIsValid = (
  input: z.infer<typeof definitionInputSchema>,
) => {
  const message = validateCustomFieldDefinition(input);
  if (message) badRequest(message);
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

    const passenger = await db
      .selectFrom('flightPassenger')
      .select('id')
      .where('flightId', '=', flightId)
      .where('userId', '=', user.id)
      .executeTakeFirst();

    if (!passenger) throw new TRPCError({ code: 'FORBIDDEN' });
    return;
  }

  if (entityType === 'flight_passenger') {
    const passengerId = Number(entityId);
    if (!Number.isFinite(passengerId)) {
      throw new TRPCError({ code: 'BAD_REQUEST' });
    }

    const passenger = await db
      .selectFrom('flightPassenger')
      .select(['id', 'flightId'])
      .where('id', '=', passengerId)
      .executeTakeFirst();

    if (!passenger) throw new TRPCError({ code: 'NOT_FOUND' });
    if (user.role === 'admin' || user.role === 'owner') return;
    const sharedFlightPassenger = await db
      .selectFrom('flightPassenger')
      .select('id')
      .where('flightId', '=', passenger.flightId)
      .where('userId', '=', user.id)
      .executeTakeFirst();
    if (!sharedFlightPassenger) throw new TRPCError({ code: 'FORBIDDEN' });
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
