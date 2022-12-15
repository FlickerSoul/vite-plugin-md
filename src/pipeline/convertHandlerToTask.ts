import type { BuilderOptions, BuilderRegistration } from '@yankeeinlondon/builder-api'
import { pipe } from 'fp-ts/lib/function.js'
import * as TE from 'fp-ts/lib/TaskEither.js'

import type { IPipelineStage, PipeTask, Pipeline, ResolvedOptions } from '../types'

/**
 * Gets all builders associated with a particular pipeline stage
 */
const getBuilders = <
  S extends IPipelineStage,
>(
    stage: S,
    options: ResolvedOptions,
  ) => {
  const builders = options.builders.reduce(
    (acc, b) => {
      return b.lifecycle === stage ? [...acc, b as BuilderRegistration<BuilderOptions, S>] : acc
    },
    [] as readonly BuilderRegistration<BuilderOptions, S>[],
  )
  return builders
}

/**
 * Provides back a function which converts the payload for a given lifecycle stage --
 * a `Pipeline<S>` -- and returns a `TaskEither<string, Pipeline<S>` which represents
 * _either_ an error condition (as string) or the mutated pipeline state after all
 * builder API's for that stage have been executed
 *
 * ```ts
 * const fn: (p: Pipeline<S>): TE.TaskEither<string, Pipeline<S>>
 *  = transformForBuilders(stage)
 * ```
 */
export const getBuilderTask = <S extends IPipelineStage>(
  stage: S,
  options: ResolvedOptions,
) => (payload: Pipeline<S>): PipeTask<S> => {
    const builders = getBuilders(stage, options)
    if (builders.length === 0) {
    // if no builders then just return payload as-is
      return TE.right(payload)
    }

    const asyncApi = async (payload: Pipeline<S>) => {
      for (const b of builders) {
        try {
          payload = await b.handler(payload as any, b.options) as Pipeline<S>
        }
        catch (e) {
          throw new Error(`During the "${stage}" stage, the builder API "${b.name}" was unable to transform the payload. It received the following error message: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      return payload
    }

    const taskApi = TE.tryCatchK(asyncApi, reason => `${reason}`)

    return taskApi(payload)
  }

/**
 * A higher order function which starts by taking the `options` for this plugin
 *
 * - returns a function requesting a _stage_,
 * - another function of type `AsyncTransformer` which receives
 *    - a synchronous `Pipeline<S>`
 *    - an asynchronous `TaskEither<unknown, Pipeline<S>`
 * - in _both_ cases the return type will be a `TaskEither<string, S>`
 */
export const gatherBuilderEvents = (options: ResolvedOptions) =>

  /**
   * Providing the _stage_ allows isolating only those events
   * which should be executed at this point in time and
   */
  <S extends IPipelineStage>(stage: S) => {
    const task = (payload: PipeTask<S>): PipeTask<S> => {
      const bt = getBuilderTask(stage, options)
      return pipe(
        payload,
        TE.map(bt),
        TE.flatten,
      ) as PipeTask<S>
    }
    return task
  }
