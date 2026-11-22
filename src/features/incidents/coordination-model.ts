import { z } from 'zod'

export const operatorSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  name: z.string().trim().min(1).max(64),
})

const markSchema = z.object({
  operator: operatorSchema,
  at: z.number().int().nonnegative(),
})

export const coordinationEntrySchema = z.object({
  incidentId: z.string(),
  seen: markSchema.optional(),
  claimed: markSchema.optional(),
})

export const coordinationCommandSchema = z.object({
  incidentId: z.string().min(1).max(100),
  operator: operatorSchema,
  action: z.enum(['see', 'claim', 'release']),
})

export const coordinationStateSchema = z.array(coordinationEntrySchema)
const publicMarkSchema = z.object({
  name: z.string(),
  at: z.number(),
  mine: z.boolean(),
})
export const coordinationViewSchema = z.array(
  z.object({
    incidentId: z.string(),
    seen: publicMarkSchema.optional(),
    claimed: publicMarkSchema.optional(),
  })
)
export type CoordinationEntry = z.infer<typeof coordinationEntrySchema>
export type CoordinationCommand = z.infer<typeof coordinationCommandSchema>
export type Operator = z.infer<typeof operatorSchema>
