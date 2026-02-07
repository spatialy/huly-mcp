import type { Class, Doc, Ref, Status, WithLookup } from "@hcengineering/core"
import type { ProjectType } from "@hcengineering/task"
import type { Issue as HulyIssue, Project as HulyProject } from "@hcengineering/tracker"
import { Effect } from "effect"

import { HulyClient, type HulyClientError } from "../client.js"
import { IssueNotFoundError, ProjectNotFoundError } from "../errors.js"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tracker = require("@hcengineering/tracker").default as typeof import("@hcengineering/tracker").default
// eslint-disable-next-line @typescript-eslint/no-require-imports
const task = require("@hcengineering/task").default as typeof import("@hcengineering/task").default
// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require("@hcengineering/core").default as typeof import("@hcengineering/core").default

export type ProjectWithType = WithLookup<HulyProject> & {
  $lookup?: { type?: ProjectType }
}

export const findProject = (
  projectIdentifier: string
): Effect.Effect<
  { client: HulyClient["Type"]; project: HulyProject },
  ProjectNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    const project = yield* client.findOne<HulyProject>(
      tracker.class.Project,
      { identifier: projectIdentifier }
    )
    if (project === undefined) {
      return yield* new ProjectNotFoundError({ identifier: projectIdentifier })
    }

    return { client, project }
  })

export type StatusInfo = {
  _id: Ref<Status>
  name: string
  isDone: boolean
  isCanceled: boolean
}

/**
 * Find project with its ProjectType lookup to get status information.
 * This avoids querying IssueStatus directly which can fail on some workspaces.
 */
export const findProjectWithStatuses = (
  projectIdentifier: string
): Effect.Effect<
  { client: HulyClient["Type"]; project: HulyProject; statuses: StatusInfo[] },
  ProjectNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    // Use lookup to get ProjectType which contains status definitions
    const project = yield* client.findOne<ProjectWithType>(
      tracker.class.Project,
      { identifier: projectIdentifier },
      { lookup: { type: task.class.ProjectType } }
    )
    if (project === undefined) {
      return yield* new ProjectNotFoundError({ identifier: projectIdentifier })
    }

    // Extract statuses from ProjectType
    const projectType = project.$lookup?.type
    const statuses: StatusInfo[] = []

    // Category refs for done/canceled detection
    const wonCategory = String(task.statusCategory.Won)
    const lostCategory = String(task.statusCategory.Lost)

    if (projectType?.statuses) {
      // ProjectType.statuses contains ProjectStatus objects with _id refs
      // We need to fetch the actual Status documents to get names
      const statusRefs = projectType.statuses.map(s => s._id)
      if (statusRefs.length > 0) {
        const statusDocs = yield* client.findAll<Status>(
          core.class.Status as Ref<Class<Doc>> as Ref<Class<Status>>,
          { _id: { $in: statusRefs } }
        )
        for (const doc of statusDocs) {
          const categoryStr = doc.category ? String(doc.category) : ""
          statuses.push({
            _id: doc._id,
            name: doc.name,
            isDone: categoryStr === wonCategory,
            isCanceled: categoryStr === lostCategory
          })
        }
      }
    }

    return { client, project, statuses }
  })

export const parseIssueIdentifier = (
  identifier: string | number,
  projectIdentifier: string
): { fullIdentifier: string; number: number | null } => {
  const idStr = String(identifier).trim()

  const match = idStr.match(/^([A-Z]+)-(\d+)$/i)
  if (match) {
    return {
      fullIdentifier: `${match[1].toUpperCase()}-${match[2]}`,
      number: parseInt(match[2], 10)
    }
  }

  const numMatch = idStr.match(/^\d+$/)
  if (numMatch) {
    const num = parseInt(idStr, 10)
    return {
      fullIdentifier: `${projectIdentifier.toUpperCase()}-${num}`,
      number: num
    }
  }

  return { fullIdentifier: idStr, number: null }
}

export const findProjectAndIssue = (
  params: { project: string; identifier: string }
): Effect.Effect<
  { client: HulyClient["Type"]; project: HulyProject; issue: HulyIssue },
  ProjectNotFoundError | IssueNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const { client, project } = yield* findProject(params.project)

    const { fullIdentifier, number } = parseIssueIdentifier(
      params.identifier,
      params.project
    )

    let issue = yield* client.findOne<HulyIssue>(
      tracker.class.Issue,
      {
        space: project._id,
        identifier: fullIdentifier
      }
    )
    if (issue === undefined && number !== null) {
      issue = yield* client.findOne<HulyIssue>(
        tracker.class.Issue,
        {
          space: project._id,
          number
        }
      )
    }
    if (issue === undefined) {
      return yield* new IssueNotFoundError({
        identifier: params.identifier,
        project: params.project
      })
    }

    return { client, project, issue }
  })
