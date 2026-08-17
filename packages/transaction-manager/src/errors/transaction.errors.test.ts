/**
 * Tests for orchestrator-error unwrapping on TransactionSubmissionError.
 *
 * The Rhinestone SDK throws plain `Error` instances with extra enumerable
 * fields (`context`, `errorType`, `traceId`, `statusCode`, `simulations`)
 * that don't survive a `.message`-only round-trip. These tests pin down
 * the contract that those fields are both:
 *   1. lifted onto `error.orchestrator` (programmatic access), and
 *   2. summarized into `error.message` (single-line logs / DX).
 */

import { describe, expect, it } from 'vitest'
import type { TransactionRequest } from '../types/transaction.types'
import {
  extractOrchestratorErrorContext,
  TransactionSubmissionError,
} from './transaction.errors'

const dummyRequest = {
  type: 'rhinestone-intent',
} as unknown as TransactionRequest

describe('extractOrchestratorErrorContext', () => {
  it('returns an empty object for non-object inputs', () => {
    expect(extractOrchestratorErrorContext(null)).toEqual({})
    expect(extractOrchestratorErrorContext(undefined)).toEqual({})
    expect(extractOrchestratorErrorContext('boom')).toEqual({})
    expect(extractOrchestratorErrorContext(42)).toEqual({})
  })

  it('returns only `name` for an Error without orchestrator fields', () => {
    // Every Error has a non-empty `name` so the extractor surfaces it
    // (knowing the thrown class is useful even when nothing else is set).
    expect(extractOrchestratorErrorContext(new Error('plain'))).toEqual({
      name: 'Error',
    })
  })

  it('lifts each known field with correct typing', () => {
    const sdkError = Object.assign(new Error('Bundle simulation failed'), {
      errorType: 'Bad Request',
      traceId: '591ce448ed09d2e490181848970c5c2f',
      statusCode: 400,
      context: { detail: 'something' },
      simulations: undefined,
    })

    expect(extractOrchestratorErrorContext(sdkError)).toEqual({
      name: 'Error',
      errorType: 'Bad Request',
      traceId: '591ce448ed09d2e490181848970c5c2f',
      statusCode: 400,
      context: { detail: 'something' },
      // `simulations: undefined` is preserved as `undefined` (the key
      // exists with a non-string value) so callers can distinguish
      // "orchestrator did not run sims" from "no field at all".
      simulations: undefined,
    })
  })

  it('drops fields with wrong types instead of coercing', () => {
    const malformed = Object.assign(new Error('x'), {
      statusCode: '400', // string, not number
      traceId: 12345, // number, not string
    })
    expect(extractOrchestratorErrorContext(malformed)).toEqual({
      name: 'Error',
    })
  })
})

describe('TransactionSubmissionError', () => {
  it('inlines orchestrator fields into the message', () => {
    const sdkError = Object.assign(new Error('Bundle simulation failed'), {
      errorType: 'Bad Request',
      traceId: 'trace-abc',
      statusCode: 400,
      context: { reason: 'nonce mismatch' },
    })

    const err = new TransactionSubmissionError(dummyRequest, sdkError)

    expect(err.message).toContain('Failed to submit transaction')
    expect(err.message).toContain('Bundle simulation failed')
    expect(err.message).toContain('errorType=Bad Request')
    expect(err.message).toContain('statusCode=400')
    expect(err.message).toContain('traceId=trace-abc')
    expect(err.message).toContain('context={"reason":"nonce mismatch"}')
  })

  it('exposes orchestrator fields on `.orchestrator`', () => {
    const sdkError = Object.assign(new Error('Bundle simulation failed'), {
      errorType: 'Bad Request',
      statusCode: 400,
      context: { reason: 'x' },
    })

    const err = new TransactionSubmissionError(dummyRequest, sdkError)

    expect(err.orchestrator).toMatchObject({
      errorType: 'Bad Request',
      statusCode: 400,
      context: { reason: 'x' },
    })
  })

  it('serializes bigints inside `context` without throwing', () => {
    const sdkError = Object.assign(new Error('sim failed'), {
      context: { gasUsed: 21000n, nonce: 7n },
    })

    const err = new TransactionSubmissionError(dummyRequest, sdkError)

    expect(err.message).toContain('"gasUsed":"21000"')
    expect(err.message).toContain('"nonce":"7"')
  })

  it('falls back gracefully when `context` is not JSON-serializable', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const sdkError = Object.assign(new Error('weird'), { context: circular })

    const err = new TransactionSubmissionError(dummyRequest, sdkError)

    // The constructor MUST NOT throw on a circular context — it should
    // fall back to `String(ctx.context)` which yields `[object Object]`.
    expect(err.message).toContain('context=[object Object]')
    expect(err.orchestrator.context).toBe(circular)
  })

  it('preserves the original cause for downstream consumers', () => {
    const sdkError = new Error('Bundle simulation failed')
    const err = new TransactionSubmissionError(dummyRequest, sdkError)
    expect(err.cause).toBe(sdkError)
  })

  it('handles non-Error causes', () => {
    const err = new TransactionSubmissionError(dummyRequest, 'string boom')
    expect(err.message).toBe('Failed to submit transaction')
    expect(err.orchestrator).toEqual({})
  })

  it('handles no cause', () => {
    const err = new TransactionSubmissionError(dummyRequest)
    expect(err.message).toBe('Failed to submit transaction')
    expect(err.orchestrator).toEqual({})
  })
})
