/**
 * Project domain operations for Huly MCP server.
 *
 * Provides typed operations for querying and managing projects from Huly platform.
 * Operations use HulyClient service and return typed domain objects.
 *
 * @module
 */
import {
  type Data,
  type DocumentQuery,
  type DocumentUpdate,
  generateId,
  type Ref,
  SortingOrder
} from "@hcengineering/core"
import { type Project as HulyProject, TimeReportDayType } from "@hcengineering/tracker"
import { Effect } from "effect"

import type {
  CreateProjectParams,
  DeleteProjectParams,
  GetProjectParams,
  ListProjectsParams,
  ListProjectsResult,
  Project,
  ProjectSummary,
  UpdateProjectParams
} from "../../domain/schemas.js"
import type { CreateProjectResult, DeleteProjectResult, UpdateProjectResult } from "../../domain/schemas/projects.js"
import { ProjectIdentifier, type StatusName } from "../../domain/schemas/shared.js"
import { HulyClient, type HulyClientError } from "../client.js"
import type { ProjectNotFoundError } from "../errors.js"
import { clampLimit, findProjectWithStatuses } from "./shared.js"

import { core, tracker } from "../huly-plugins.js"

type ListProjectsError = HulyClientError

type GetProjectError =
  | HulyClientError
  | ProjectNotFoundError

type CreateProjectError = HulyClientError

type UpdateProjectError =
  | HulyClientError
  | ProjectNotFoundError

type DeleteProjectError =
  | HulyClientError
  | ProjectNotFoundError

export const listProjects = (
  params: ListProjectsParams
): Effect.Effect<ListProjectsResult, ListProjectsError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    const query: DocumentQuery<HulyProject> = {}
    if (!params.includeArchived) {
      query.archived = false
    }

    const limit = clampLimit(params.limit)

    const projects = yield* client.findAll<HulyProject>(
      tracker.class.Project,
      query,
      {
        limit,
        sort: {
          name: SortingOrder.Ascending
        }
      }
    )

    const total = projects.total

    const summaries: Array<ProjectSummary> = projects.map((project) => ({
      identifier: ProjectIdentifier.make(project.identifier),
      name: project.name,
      description: project.description || undefined,
      archived: project.archived
    }))

    return {
      projects: summaries,
      total
    }
  })

export const getProject = (
  params: GetProjectParams
): Effect.Effect<Project, GetProjectError, HulyClient> =>
  Effect.gen(function*() {
    const { project, statuses } = yield* findProjectWithStatuses(params.project)

    const defaultStatus = statuses.find((s) => s._id === project.defaultIssueStatus)
    const statusNames = statuses.map((s) => s.name as StatusName)

    return {
      identifier: ProjectIdentifier.make(project.identifier),
      name: project.name,
      description: project.description || undefined,
      archived: project.archived,
      defaultStatus: defaultStatus ? defaultStatus.name as StatusName : undefined,
      statuses: statusNames.length > 0 ? statusNames : undefined
    }
  })

export const createProject = (
  params: CreateProjectParams
): Effect.Effect<CreateProjectResult, CreateProjectError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    const projectId: Ref<HulyProject> = generateId()

    const projectData: Data<HulyProject> = {
      name: params.name,
      identifier: params.identifier.toUpperCase(),
      description: params.description ?? "",
      private: params.private ?? false,
      archived: false,
      members: [],
      sequence: 0,
      defaultIssueStatus: tracker.status.Backlog,
      defaultTimeReportDay: TimeReportDayType.CurrentWorkDay,
      type: tracker.ids.ClassingProjectType
    }

    yield* client.createDoc(
      tracker.class.Project,
      core.space.Space,
      projectData,
      projectId
    )

    return { identifier: ProjectIdentifier.make(params.identifier.toUpperCase()), name: params.name }
  })

export const updateProject = (
  params: UpdateProjectParams
): Effect.Effect<UpdateProjectResult, UpdateProjectError, HulyClient> =>
  Effect.gen(function*() {
    const { client, project } = yield* findProjectWithStatuses(params.project)

    const updateOps: DocumentUpdate<HulyProject> = {}

    if (params.name !== undefined) {
      updateOps.name = params.name
    }

    if (params.description !== undefined) {
      updateOps.description = params.description
    }

    if (Object.keys(updateOps).length === 0) {
      return { identifier: ProjectIdentifier.make(project.identifier), updated: false }
    }

    yield* client.updateDoc(
      tracker.class.Project,
      core.space.Space,
      project._id,
      updateOps
    )

    return { identifier: ProjectIdentifier.make(project.identifier), updated: true }
  })

export const deleteProject = (
  params: DeleteProjectParams
): Effect.Effect<DeleteProjectResult, DeleteProjectError, HulyClient> =>
  Effect.gen(function*() {
    const { client, project } = yield* findProjectWithStatuses(params.project)

    yield* client.removeDoc(
      tracker.class.Project,
      core.space.Space,
      project._id
    )

    return { identifier: ProjectIdentifier.make(project.identifier), deleted: true }
  })
