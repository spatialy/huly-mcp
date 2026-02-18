import { describe, it } from "@effect/vitest"
import type { Doc, PersonId, Ref, Space } from "@hcengineering/core"
import { toFindResult } from "@hcengineering/core"
import type { ProjectType, TaskType } from "@hcengineering/task"
import type {
  Component as HulyComponent,
  Issue as HulyIssue,
  IssueStatus,
  IssueTemplate as HulyIssueTemplate,
  Milestone as HulyMilestone,
  Project as HulyProject
} from "@hcengineering/tracker"
import { MilestoneStatus, TimeReportDayType } from "@hcengineering/tracker"
import { Effect } from "effect"
import { expect } from "vitest"
import { HulyClient, type HulyClientOperations } from "../../../src/huly/client.js"
import type {
  ComponentNotFoundError,
  IssueNotFoundError,
  MilestoneNotFoundError,
  ProjectNotFoundError
} from "../../../src/huly/errors.js"
import { tracker } from "../../../src/huly/huly-plugins.js"
import { previewDeletion } from "../../../src/huly/operations/deletion.js"
import { projectIdentifier } from "../../helpers/brands.js"

// --- Mock Data Builders ---

const makeProject = (overrides?: Partial<HulyProject>): HulyProject => ({
  _id: "project-1" as Ref<HulyProject>,
  _class: tracker.class.Project,
  space: "space-1" as Ref<Space>,
  name: "Test Project",
  description: "",
  private: false,
  archived: false,
  members: [],
  identifier: "PROJ",
  sequence: 1,
  defaultIssueStatus: "status-1" as Ref<IssueStatus>,
  defaultTimeReportDay: TimeReportDayType.CurrentWorkDay,
  type: "project-type-1" as Ref<ProjectType>,
  modifiedBy: "user-1" as PersonId,
  modifiedOn: Date.now(),
  createdBy: "user-1" as PersonId,
  createdOn: Date.now(),
  ...overrides
})

const makeIssue = (overrides?: Partial<HulyIssue>): HulyIssue => ({
  _id: "issue-1" as Ref<HulyIssue>,
  _class: tracker.class.Issue,
  space: "project-1" as Ref<HulyProject>,
  attachedTo: "issue-parent" as Ref<HulyIssue>,
  attachedToClass: tracker.class.Issue,
  collection: "subIssues",
  title: "Test Issue",
  description: null,
  status: "status-1" as Ref<IssueStatus>,
  priority: 0,
  component: null,
  subIssues: 0,
  parents: [],
  estimation: 0,
  remainingTime: 0,
  reportedTime: 0,
  reports: 0,
  childInfo: [],
  kind: "task-type-1" as Ref<TaskType>,
  number: 123,
  assignee: null,
  dueDate: null,
  identifier: "PROJ-123",
  rank: "0|aaa",
  modifiedBy: "user-1" as PersonId,
  modifiedOn: Date.now(),
  createdBy: "user-1" as PersonId,
  createdOn: Date.now(),
  ...overrides
})

const makeComponent = (overrides?: Partial<HulyComponent>): HulyComponent => ({
  _id: "comp-1" as Ref<HulyComponent>,
  _class: tracker.class.Component,
  space: "project-1" as Ref<HulyProject>,
  label: "Backend",
  description: "Backend component",
  lead: null,
  comments: 0,
  modifiedBy: "user-1" as PersonId,
  modifiedOn: Date.now(),
  createdBy: "user-1" as PersonId,
  createdOn: Date.now(),
  ...overrides
})

const makeMilestone = (overrides?: Partial<HulyMilestone>): HulyMilestone => ({
  _id: "milestone-1" as Ref<HulyMilestone>,
  _class: tracker.class.Milestone,
  space: "project-1" as Ref<HulyProject>,
  label: "v1.0",
  description: "",
  status: MilestoneStatus.Planned,
  targetDate: Date.now(),
  comments: 0,
  modifiedBy: "user-1" as PersonId,
  modifiedOn: Date.now(),
  createdBy: "user-1" as PersonId,
  createdOn: Date.now(),
  ...overrides
})

// --- Test Helpers ---

interface MockConfig {
  projects?: Array<HulyProject>
  issues?: Array<HulyIssue>
  components?: Array<HulyComponent>
  milestones?: Array<HulyMilestone>
  templates?: Array<HulyIssueTemplate>
  issuesByComponent?: Map<string, Array<HulyIssue>>
  issuesByMilestone?: Map<string, Array<HulyIssue>>
}

const createTestLayerWithMocks = (config: MockConfig) => {
  const projects = config.projects ?? []
  const issues = config.issues ?? []
  const components = config.components ?? []
  const milestones = config.milestones ?? []
  const templates = config.templates ?? []

  const findAllImpl: HulyClientOperations["findAll"] = ((_class: unknown, query: unknown, options: unknown) => {
    const q = query as Record<string, unknown>
    const opts = options as Record<string, unknown> | undefined
    const useTotal = opts?.total === true

    if (_class === tracker.class.Issue) {
      let filtered = issues.filter(i => q.space === undefined || i.space === q.space)
      if (q.component !== undefined) {
        filtered = filtered.filter(i => i.component === q.component)
      }
      if (q.milestone !== undefined) {
        filtered = filtered.filter(i => i.milestone === q.milestone)
      }
      const result = toFindResult(filtered)
      if (useTotal) {
        return Effect.succeed(Object.assign(result, { total: filtered.length }))
      }
      return Effect.succeed(result)
    }
    if (_class === tracker.class.Component) {
      const filtered = components.filter(c => q.space === undefined || c.space === q.space)
      const result = toFindResult(filtered)
      if (useTotal) {
        return Effect.succeed(Object.assign(result, { total: filtered.length }))
      }
      return Effect.succeed(result)
    }
    if (_class === tracker.class.Milestone) {
      const filtered = milestones.filter(m => q.space === undefined || m.space === q.space)
      const result = toFindResult(filtered)
      if (useTotal) {
        return Effect.succeed(Object.assign(result, { total: filtered.length }))
      }
      return Effect.succeed(result)
    }
    if (_class === tracker.class.IssueTemplate) {
      const filtered = templates.filter(t => q.space === undefined || t.space === q.space)
      const result = toFindResult(filtered)
      if (useTotal) {
        return Effect.succeed(Object.assign(result, { total: filtered.length }))
      }
      return Effect.succeed(result)
    }
    return Effect.succeed(toFindResult([]))
  }) as HulyClientOperations["findAll"]

  const findOneImpl: HulyClientOperations["findOne"] = ((_class: unknown, query: unknown) => {
    const q = query as Record<string, unknown>
    if (_class === tracker.class.Project) {
      const found = projects.find(p => p.identifier === q.identifier)
      return Effect.succeed(found)
    }
    if (_class === tracker.class.Issue) {
      const found = issues.find(i =>
        (q.space !== undefined && q.identifier !== undefined && i.space === q.space && i.identifier === q.identifier)
        || (q.space !== undefined && q.number !== undefined && i.space === q.space && i.number === q.number)
      )
      return Effect.succeed(found)
    }
    if (_class === tracker.class.Component) {
      const found = components.find(c =>
        (q.space !== undefined && q._id !== undefined && c.space === q.space && c._id === q._id)
        || (q.space !== undefined && q.label !== undefined && c.space === q.space && c.label === q.label)
      )
      return Effect.succeed(found)
    }
    if (_class === tracker.class.Milestone) {
      const found = milestones.find(m =>
        (q.space !== undefined && q._id !== undefined && m.space === q.space && m._id === q._id)
        || (q.space !== undefined && q.label !== undefined && m.space === q.space && m.label === q.label)
      )
      return Effect.succeed(found)
    }
    return Effect.succeed(undefined)
  }) as HulyClientOperations["findOne"]

  return HulyClient.testLayer({
    findAll: findAllImpl,
    findOne: findOneImpl
  })
}

// --- Tests ---

describe("previewDeletion - issue", () => {
  it.effect("returns impact for issue with sub-issues, comments, relations", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const issue = makeIssue({
        _id: "issue-1" as Ref<HulyIssue>,
        space: "proj-1" as Ref<HulyProject>,
        identifier: "PROJ-123",
        number: 123,
        subIssues: 2,
        comments: 3,
        attachments: 1,
        blockedBy: [
          { _id: "issue-2" as Ref<Doc>, _class: tracker.class.Issue },
          { _id: "issue-3" as Ref<Doc>, _class: tracker.class.Issue }
        ],
        relations: [{ _id: "issue-4" as Ref<Doc>, _class: tracker.class.Issue }]
      })

      const testLayer = createTestLayerWithMocks({ projects: [project], issues: [issue] })

      const result = yield* previewDeletion({
        entityType: "issue",
        project: projectIdentifier("PROJ"),
        identifier: "PROJ-123"
      }).pipe(Effect.provide(testLayer))

      expect(result.entityType).toBe("issue")
      expect(result.identifier).toBe("PROJ-123")
      expect(result.impact.subIssues).toBe(2)
      expect(result.impact.comments).toBe(3)
      expect(result.impact.attachments).toBe(1)
      expect(result.impact.blockedBy).toBe(2)
      expect(result.impact.relations).toBe(1)
      expect(result.totalAffected).toBe(9)
      expect(result.warnings.length).toBeGreaterThan(0)
    }))

  it.effect("returns zero counts for issue with nothing attached", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const issue = makeIssue({
        space: "proj-1" as Ref<HulyProject>,
        identifier: "PROJ-1",
        number: 1,
        subIssues: 0,
        comments: 0
      })

      const testLayer = createTestLayerWithMocks({ projects: [project], issues: [issue] })

      const result = yield* previewDeletion({
        entityType: "issue",
        project: projectIdentifier("PROJ"),
        identifier: "PROJ-1"
      }).pipe(Effect.provide(testLayer))

      expect(result.totalAffected).toBe(0)
      expect(result.warnings).toHaveLength(0)
    }))

  it.effect("returns IssueNotFoundError when issue doesn't exist", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const testLayer = createTestLayerWithMocks({ projects: [project], issues: [] })

      const error = yield* Effect.flip(
        previewDeletion({
          entityType: "issue",
          project: projectIdentifier("PROJ"),
          identifier: "PROJ-999"
        }).pipe(Effect.provide(testLayer))
      )

      expect(error._tag).toBe("IssueNotFoundError")
      expect((error as IssueNotFoundError).identifier).toBe("PROJ-999")
    }))

  it.effect("returns ProjectNotFoundError when project doesn't exist", () =>
    Effect.gen(function*() {
      const testLayer = createTestLayerWithMocks({ projects: [] })

      const error = yield* Effect.flip(
        previewDeletion({
          entityType: "issue",
          project: projectIdentifier("NOPE"),
          identifier: "NOPE-1"
        }).pipe(Effect.provide(testLayer))
      )

      expect(error._tag).toBe("ProjectNotFoundError")
    }))
})

describe("previewDeletion - project", () => {
  it.effect("returns counts of all project contents", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const issues = [
        makeIssue({ _id: "i1" as Ref<HulyIssue>, space: "proj-1" as Ref<HulyProject> }),
        makeIssue({ _id: "i2" as Ref<HulyIssue>, space: "proj-1" as Ref<HulyProject> })
      ]
      const components = [
        makeComponent({ _id: "c1" as Ref<HulyComponent>, space: "proj-1" as Ref<HulyProject> })
      ]
      const milestones = [
        makeMilestone({ _id: "m1" as Ref<HulyMilestone>, space: "proj-1" as Ref<HulyProject> })
      ]

      const testLayer = createTestLayerWithMocks({ projects: [project], issues, components, milestones })

      const result = yield* previewDeletion({
        entityType: "project",
        project: projectIdentifier("PROJ")
      }).pipe(Effect.provide(testLayer))

      expect(result.entityType).toBe("project")
      expect(result.identifier).toBe("PROJ")
      expect(result.impact.issues).toBe(2)
      expect(result.impact.components).toBe(1)
      expect(result.impact.milestones).toBe(1)
      expect(result.impact.templates).toBe(0)
      expect(result.totalAffected).toBe(4)
      expect(result.warnings.length).toBeGreaterThan(0)
    }))

  it.effect("returns zero counts for empty project", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const testLayer = createTestLayerWithMocks({ projects: [project] })

      const result = yield* previewDeletion({
        entityType: "project",
        project: projectIdentifier("PROJ")
      }).pipe(Effect.provide(testLayer))

      expect(result.totalAffected).toBe(0)
      expect(result.warnings).toHaveLength(0)
    }))

  it.effect("returns ProjectNotFoundError when project doesn't exist", () =>
    Effect.gen(function*() {
      const testLayer = createTestLayerWithMocks({ projects: [] })

      const error = yield* Effect.flip(
        previewDeletion({
          entityType: "project",
          project: projectIdentifier("NOPE")
        }).pipe(Effect.provide(testLayer))
      )

      expect(error._tag).toBe("ProjectNotFoundError")
      expect((error as ProjectNotFoundError).identifier).toBe("NOPE")
    }))
})

describe("previewDeletion - component", () => {
  it.effect("returns issue count for component", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const comp = makeComponent({
        _id: "comp-1" as Ref<HulyComponent>,
        label: "Backend",
        space: "proj-1" as Ref<HulyProject>
      })
      const issues = [
        makeIssue({
          _id: "i1" as Ref<HulyIssue>,
          space: "proj-1" as Ref<HulyProject>,
          component: "comp-1" as Ref<HulyComponent>
        }),
        makeIssue({
          _id: "i2" as Ref<HulyIssue>,
          space: "proj-1" as Ref<HulyProject>,
          component: "comp-1" as Ref<HulyComponent>
        })
      ]

      const testLayer = createTestLayerWithMocks({ projects: [project], components: [comp], issues })

      const result = yield* previewDeletion({
        entityType: "component",
        project: projectIdentifier("PROJ"),
        identifier: "Backend"
      }).pipe(Effect.provide(testLayer))

      expect(result.entityType).toBe("component")
      expect(result.identifier).toBe("Backend")
      expect(result.impact.issues).toBe(2)
      expect(result.totalAffected).toBe(2)
      expect(result.warnings).toHaveLength(1)
    }))

  it.effect("returns zero when no issues use component", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const comp = makeComponent({
        _id: "comp-1" as Ref<HulyComponent>,
        label: "Frontend",
        space: "proj-1" as Ref<HulyProject>
      })

      const testLayer = createTestLayerWithMocks({ projects: [project], components: [comp] })

      const result = yield* previewDeletion({
        entityType: "component",
        project: projectIdentifier("PROJ"),
        identifier: "Frontend"
      }).pipe(Effect.provide(testLayer))

      expect(result.totalAffected).toBe(0)
      expect(result.warnings).toHaveLength(0)
    }))

  it.effect("returns ComponentNotFoundError when component doesn't exist", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const testLayer = createTestLayerWithMocks({ projects: [project], components: [] })

      const error = yield* Effect.flip(
        previewDeletion({
          entityType: "component",
          project: projectIdentifier("PROJ"),
          identifier: "Ghost"
        }).pipe(Effect.provide(testLayer))
      )

      expect(error._tag).toBe("ComponentNotFoundError")
      expect((error as ComponentNotFoundError).identifier).toBe("Ghost")
    }))
})

describe("previewDeletion - milestone", () => {
  it.effect("returns issue count for milestone", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const ms = makeMilestone({
        _id: "ms-1" as Ref<HulyMilestone>,
        label: "v1.0",
        space: "proj-1" as Ref<HulyProject>
      })
      const issues = [
        makeIssue({
          _id: "i1" as Ref<HulyIssue>,
          space: "proj-1" as Ref<HulyProject>,
          milestone: "ms-1" as Ref<HulyMilestone>
        }),
        makeIssue({
          _id: "i2" as Ref<HulyIssue>,
          space: "proj-1" as Ref<HulyProject>,
          milestone: "ms-1" as Ref<HulyMilestone>
        }),
        makeIssue({
          _id: "i3" as Ref<HulyIssue>,
          space: "proj-1" as Ref<HulyProject>,
          milestone: "ms-1" as Ref<HulyMilestone>
        })
      ]

      const testLayer = createTestLayerWithMocks({ projects: [project], milestones: [ms], issues })

      const result = yield* previewDeletion({
        entityType: "milestone",
        project: projectIdentifier("PROJ"),
        identifier: "v1.0"
      }).pipe(Effect.provide(testLayer))

      expect(result.entityType).toBe("milestone")
      expect(result.identifier).toBe("v1.0")
      expect(result.impact.issues).toBe(3)
      expect(result.totalAffected).toBe(3)
      expect(result.warnings).toHaveLength(1)
    }))

  it.effect("returns zero when no issues in milestone", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const ms = makeMilestone({
        _id: "ms-1" as Ref<HulyMilestone>,
        label: "v2.0",
        space: "proj-1" as Ref<HulyProject>
      })

      const testLayer = createTestLayerWithMocks({ projects: [project], milestones: [ms] })

      const result = yield* previewDeletion({
        entityType: "milestone",
        project: projectIdentifier("PROJ"),
        identifier: "v2.0"
      }).pipe(Effect.provide(testLayer))

      expect(result.totalAffected).toBe(0)
      expect(result.warnings).toHaveLength(0)
    }))

  it.effect("returns MilestoneNotFoundError when milestone doesn't exist", () =>
    Effect.gen(function*() {
      const project = makeProject({ _id: "proj-1" as Ref<HulyProject>, identifier: "PROJ" })
      const testLayer = createTestLayerWithMocks({ projects: [project], milestones: [] })

      const error = yield* Effect.flip(
        previewDeletion({
          entityType: "milestone",
          project: projectIdentifier("PROJ"),
          identifier: "Ghost"
        }).pipe(Effect.provide(testLayer))
      )

      expect(error._tag).toBe("MilestoneNotFoundError")
      expect((error as MilestoneNotFoundError).identifier).toBe("Ghost")
    }))
})
