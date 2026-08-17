import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { fromPromise, ok } from 'neverthrow'
import type { ExpiryEvent } from '#types/events/index.js'
import { chunk } from '#utils/chunk.js'
import { logger } from '#utils/logger.js'
import {
  loadNotificationCursors,
  type NotificationCursors,
  storeNotificationCursors,
} from './cursors.js'
import { fetchExpiringNamesPage } from './indexer.js'
import {
  type ExpiryStageConfig,
  getUpperBoundForStage,
  STAGES,
} from './stages.js'

const QUEUE_BATCH_SIZE = 100

class QueuePublishError extends TaggedError('QUEUE_PUBLISH_ERROR')<{
  stageId: string
}> {}

type StageRunMetrics = {
  stageId: string
  cursorStart: number
  cursorEnd: number
  upperBound: number
  enqueuedCount: number
  pageDomainCount: number
  chunkCount: number
  hasMore: boolean
}

function buildExpiryEvents(
  stage: ExpiryStageConfig,
  domains: { name: string; expiryDate: number; owner?: string }[],
): ExpiryEvent[] {
  return domains.map((domain) => ({
    type: 'name_expiring',
    name: domain.name,
    expiryDate: domain.expiryDate,
    stage: stage.id,
    owner: domain.owner,
    includeFavorites: stage.includeFavorites,
  }))
}

const processStage = ResultFn(async function* (ctx: {
  env: CloudflareBindings
  stage: ExpiryStageConfig
  cursor: number
  nowSec: number
}) {
  const upperBound = getUpperBoundForStage(ctx.stage, ctx.nowSec)
  const lagSec = Math.max(0, upperBound - ctx.cursor)

  // Cursor already caught up with the stage window.
  if (ctx.cursor >= upperBound) {
    logger.debug('Expiry stage skipped (cursor caught up)', {
      stageId: ctx.stage.id,
      cursorStart: ctx.cursor,
      upperBound,
    })
    return ok({
      stageId: ctx.stage.id,
      cursorStart: ctx.cursor,
      cursorEnd: ctx.cursor,
      upperBound,
      enqueuedCount: 0,
      pageDomainCount: 0,
      chunkCount: 0,
      hasMore: false,
    } satisfies StageRunMetrics)
  }

  logger.debug('Processing expiry stage window', {
    stageId: ctx.stage.id,
    cursorStart: ctx.cursor,
    upperBound,
    lagSec,
  })

  const page = yield* fetchExpiringNamesPage({
    env: ctx.env,
    stage: ctx.stage,
    cursor: ctx.cursor,
    upperBound,
  })

  if (page.domains.length === 0) {
    logger.debug('Expiry stage returned no domains', {
      stageId: ctx.stage.id,
      cursorStart: ctx.cursor,
      upperBound,
    })
    return ok({
      stageId: ctx.stage.id,
      cursorStart: ctx.cursor,
      cursorEnd: ctx.cursor,
      upperBound,
      enqueuedCount: 0,
      pageDomainCount: 0,
      chunkCount: 0,
      hasMore: false,
    } satisfies StageRunMetrics)
  }

  const events = buildExpiryEvents(ctx.stage, page.domains)
  const eventChunks = chunk(events, QUEUE_BATCH_SIZE)
  const firstExpiryDate = page.domains[0]?.expiryDate
  const lastExpiryDate = page.domains[page.domains.length - 1]?.expiryDate

  for (const eventChunk of eventChunks) {
    logger.trace('Enqueueing expiry events chunk', {
      stageId: ctx.stage.id,
      chunkSize: eventChunk.length,
    })
    // One sendBatch call counts as one subrequest regardless of chunk size.
    yield* fromPromise(
      ctx.env.EVENT_INGESTION_QUEUE.sendBatch(
        eventChunk.map((event) => ({ body: event })),
      ),
      (error) =>
        new QueuePublishError({
          message: `Failed to enqueue expiry events for stage ${ctx.stage.id}`,
          cause: error,
          stageId: ctx.stage.id,
        }),
    )
  }

  return ok({
    stageId: ctx.stage.id,
    cursorStart: ctx.cursor,
    cursorEnd: lastExpiryDate ?? ctx.cursor,
    upperBound,
    enqueuedCount: events.length,
    pageDomainCount: page.domains.length,
    chunkCount: eventChunks.length,
    hasMore: page.hasMore,
    firstExpiryDate,
    lastExpiryDate,
  } satisfies StageRunMetrics & {
    firstExpiryDate?: number
    lastExpiryDate?: number
  })
})

export const runExpiryDiscoveryCron = ResultFn(async function* (
  env: CloudflareBindings,
) {
  const startedAt = Date.now()
  const nowSec = Math.floor(Date.now() / 1000)
  logger.info('Expiry discovery cron started', {
    nowSec,
    stageCount: STAGES.length,
    stages: STAGES.map((stage) => stage.id),
  })

  const cursors = yield* loadNotificationCursors(env, nowSec)
  logger.debug('Loaded expiry notification cursors', {
    cursors: Object.fromEntries(
      Object.entries(cursors).map(([k, v]) => [k, v.expiry_timestamp]),
    ),
  })

  const stageResults = await Promise.all(
    STAGES.map(async (stage) => {
      const result = await processStage({
        env,
        stage,
        cursor: cursors[stage.id].expiry_timestamp,
        nowSec,
      })

      return {
        stage,
        result,
      }
    }),
  )

  const nextCursors: NotificationCursors = {
    ...cursors,
  }

  let totalEnqueued = 0
  let failedStages = 0
  const stageMetrics: Record<string, StageRunMetrics> = {}

  for (const { stage, result } of stageResults) {
    if (result.isErr()) {
      failedStages += 1
      logger.error('Expiry discovery stage failed', {
        stageId: stage.id,
        cursorStart: cursors[stage.id].expiry_timestamp,
        upperBound: getUpperBoundForStage(stage, nowSec),
        error: result.error,
      })
      continue
    }

    // Per-stage commit policy: successful stages move forward even if others fail.
    nextCursors[stage.id] = {
      expiry_timestamp: result.value.cursorEnd,
    }
    totalEnqueued += result.value.enqueuedCount
    stageMetrics[stage.id] = result.value

    logger.info('Expiry discovery stage completed', {
      stageId: stage.id,
      cursorStart: result.value.cursorStart,
      cursorEnd: result.value.cursorEnd,
      upperBound: result.value.upperBound,
      cursorAdvancedBySec: result.value.cursorEnd - result.value.cursorStart,
      pageDomainCount: result.value.pageDomainCount,
      enqueuedCount: result.value.enqueuedCount,
      chunkCount: result.value.chunkCount,
      hasMore: result.value.hasMore,
    })
  }

  yield* storeNotificationCursors(env, nextCursors)

  const durationMs = Date.now() - startedAt
  const successfulStages = STAGES.length - failedStages
  logger.info('Expiry discovery cron completed', {
    durationMs,
    successfulStages,
    totalEnqueued,
    failedStages,
    stageMetrics,
  })

  return ok({
    totalEnqueued,
    failedStages,
  })
})
