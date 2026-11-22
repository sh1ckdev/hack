import { z } from 'zod'

export const conversationRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  focusId: z.string().max(100).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(500),
      })
    )
    .max(4),
})

export const conversationAnswerSchema = z.object({
  text: z.string().min(1).max(1800),
  runId: z.string(),
  version: z.number(),
  incidentIds: z.array(z.string()).max(4),
  focusId: z.string().optional(),
})

export type ConversationRequest = z.infer<typeof conversationRequestSchema>
export type ConversationAnswer = z.infer<typeof conversationAnswerSchema>
