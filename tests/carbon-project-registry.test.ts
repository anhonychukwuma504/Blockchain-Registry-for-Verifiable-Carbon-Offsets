// tests/CarbonProjectRegistry.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Project {
  owner: string;
  documentHash: Buffer;
  title: string;
  description: string;
  location: string;
  areaHectares: number;
  estimatedCo2Tons: number;
  registeredAt: number;
  status: string;
  visibility: boolean;
}

interface ProjectTags {
  tags: string[];
}

interface Collaborator {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface ProjectUpdate {
  updater: string;
  changes: string;
  timestamp: number;
}

interface OwnershipHistory {
  from: string;
  to: string;
  timestamp: number;
  reason: string;
}

interface ContractState {
  contractOwner: string;
  paused: boolean;
  projectCounter: number;
  projects: Map<number, Project>;
  projectTags: Map<number, ProjectTags>;
  projectCollaborators: Map<string, Collaborator>; // Key: `${projectId}-${collaborator}`
  projectUpdates: Map<string, ProjectUpdate>; // Key: `${projectId}-${updateId}`
  projectOwnershipHistory: Map<string, OwnershipHistory>; // Key: `${projectId}-${transferId}`
}

// Mock contract implementation
class CarbonProjectRegistryMock {
  private state: ContractState = {
    contractOwner: "deployer",
    paused: false,
    projectCounter: 0,
    projects: new Map(),
    projectTags: new Map(),
    projectCollaborators: new Map(),
    projectUpdates: new Map(),
    projectOwnershipHistory: new Map(),
  };

  private ERR_ALREADY_REGISTERED = 100;
  private ERR_UNAUTHORIZED = 101;
  private ERR_INVALID_PARAM = 102;
  private ERR_PROJECT_NOT_FOUND = 103;
  private ERR_INVALID_STATUS = 104;
  private ERR_MAX_TAGS_REACHED = 105;
  private ERR_PAUSED = 106;
  private ERR_INVALID_HASH = 107;
  private ERR_INVALID_OWNER = 108;
  private ERR_INVALID_METADATA_LENGTH = 109;

  private MAX_TITLE_LEN = 100;
  private MAX_DESCRIPTION_LEN = 500;
  private MAX_LOCATION_LEN = 200;
  private MAX_TAGS = 10;
  private MAX_TAG_LEN = 50;

  private currentBlockHeight = 100; // Mock block height

  // Helper to simulate block height increase
  private incrementBlockHeight() {
    this.currentBlockHeight += 1;
  }

  registerProject(
    caller: string,
    documentHash: Buffer,
    title: string,
    description: string,
    location: string,
    areaHectares: number,
    estimatedCo2Tons: number,
    initialTags: string[]
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (documentHash.length !== 32) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    if (
      title.length > this.MAX_TITLE_LEN ||
      description.length > this.MAX_DESCRIPTION_LEN ||
      location.length > this.MAX_LOCATION_LEN
    ) {
      return { ok: false, value: this.ERR_INVALID_METADATA_LENGTH };
    }
    if (areaHectares <= 0 || estimatedCo2Tons <= 0) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    if (initialTags.length > this.MAX_TAGS) {
      return { ok: false, value: this.ERR_MAX_TAGS_REACHED };
    }
    this.state.projectCounter += 1;
    const projectId = this.state.projectCounter;
    this.state.projects.set(projectId, {
      owner: caller,
      documentHash,
      title,
      description,
      location,
      areaHectares,
      estimatedCo2Tons,
      registeredAt: this.currentBlockHeight,
      status: "pending",
      visibility: true,
    });
    this.state.projectTags.set(projectId, { tags: initialTags });
    this.incrementBlockHeight();
    return { ok: true, value: projectId };
  }

  updateProjectMetadata(
    caller: string,
    projectId: number,
    newTitle: string,
    newDescription: string,
    newLocation: string,
    changesNote: string
  ): ClarityResponse<boolean> {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    if (project.owner !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (
      newTitle.length > this.MAX_TITLE_LEN ||
      newDescription.length > this.MAX_DESCRIPTION_LEN ||
      newLocation.length > this.MAX_LOCATION_LEN ||
      changesNote.length > this.MAX_DESCRIPTION_LEN
    ) {
      return { ok: false, value: this.ERR_INVALID_METADATA_LENGTH };
    }
    this.state.projects.set(projectId, {
      ...project,
      title: newTitle,
      description: newDescription,
      location: newLocation,
    });
    // Simulate update id (assuming we count existing updates)
    const updateKey = `${projectId}-${this.state.projectUpdates.size + 1}`;
    this.state.projectUpdates.set(updateKey, {
      updater: caller,
      changes: changesNote,
      timestamp: this.currentBlockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  transferOwnership(
    caller: string,
    projectId: number,
    newOwner: string,
    reason: string
  ): ClarityResponse<boolean> {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    if (project.owner !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newOwner === caller) {
      return { ok: false, value: this.ERR_INVALID_OWNER };
    }
    this.state.projects.set(projectId, { ...project, owner: newOwner });
    const transferKey = `${projectId}-${this.state.projectOwnershipHistory.size + 1}`;
    this.state.projectOwnershipHistory.set(transferKey, {
      from: caller,
      to: newOwner,
      timestamp: this.currentBlockHeight,
      reason,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    projectId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    if (project.owner !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const collabKey = `${projectId}-${collaborator}`;
    if (this.state.projectCollaborators.has(collabKey)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    this.state.projectCollaborators.set(collabKey, {
      role,
      permissions,
      addedAt: this.currentBlockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  updateProjectStatus(
    caller: string,
    projectId: number,
    newStatus: string
  ): ClarityResponse<boolean> {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    // Simplified: assume has permission if owner or collaborator with perm
    const hasPerm = project.owner === caller || this.hasPermission(projectId, caller, "update-status");
    if (!hasPerm) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newStatus === project.status) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    this.state.projects.set(projectId, { ...project, status: newStatus });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  private hasPermission(projectId: number, user: string, perm: string): boolean {
    const collabKey = `${projectId}-${user}`;
    const collab = this.state.projectCollaborators.get(collabKey);
    return collab ? collab.permissions.includes(perm) : false;
  }

  toggleVisibility(caller: string, projectId: number): ClarityResponse<boolean> {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return { ok: false, value: this.ERR_PROJECT_NOT_FOUND };
    }
    if (project.owner !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const newVis = !project.visibility;
    this.state.projects.set(projectId, { ...project, visibility: newVis });
    this.incrementBlockHeight();
    return { ok: true, value: newVis };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  transferContractOwnership(caller: string, newOwner: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.contractOwner = newOwner;
    return { ok: true, value: true };
  }

  getProjectDetails(projectId: number): ClarityResponse<Project | null> {
    return { ok: true, value: this.state.projects.get(projectId) ?? null };
  }

  getProjectTags(projectId: number): ClarityResponse<ProjectTags | null> {
    return { ok: true, value: this.state.projectTags.get(projectId) ?? null };
  }

  getCollaborator(projectId: number, collaborator: string): ClarityResponse<Collaborator | null> {
    const collabKey = `${projectId}-${collaborator}`;
    return { ok: true, value: this.state.projectCollaborators.get(collabKey) ?? null };
  }

  getUpdateHistory(projectId: number, updateId: number): ClarityResponse<ProjectUpdate | null> {
    const updateKey = `${projectId}-${updateId}`;
    return { ok: true, value: this.state.projectUpdates.get(updateKey) ?? null };
  }

  getOwnershipHistory(projectId: number, transferId: number): ClarityResponse<OwnershipHistory | null> {
    const transferKey = `${projectId}-${transferId}`;
    return { ok: true, value: this.state.projectOwnershipHistory.get(transferKey) ?? null };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getContractOwner(): ClarityResponse<string> {
    return { ok: true, value: this.state.contractOwner };
  }

  getProjectCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.projectCounter };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  owner: "wallet_1",
  collaborator: "wallet_2",
  unauthorized: "wallet_3",
  newOwner: "wallet_4",
};

describe("CarbonProjectRegistry Contract", () => {
  let contract: CarbonProjectRegistryMock;

  beforeEach(() => {
    contract = new CarbonProjectRegistryMock();
    vi.resetAllMocks();
  });

  it("should register a new project successfully", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    const registerResult = contract.registerProject(
      accounts.owner,
      documentHash,
      "Forest Project",
      "Preservation in Amazon",
      "Brazil",
      1000,
      5000,
      ["forest", "carbon"]
    );
    expect(registerResult).toEqual({ ok: true, value: 1 });

    const details = contract.getProjectDetails(1);
    expect(details.ok).toBe(true);
    expect(details.value).toEqual(
      expect.objectContaining({
        owner: accounts.owner,
        title: "Forest Project",
        status: "pending",
        visibility: true,
      })
    );

    const tags = contract.getProjectTags(1);
    expect(tags.value).toEqual({ tags: ["forest", "carbon"] });
  });

  it("should prevent registration when paused", () => {
    contract.pauseContract(accounts.deployer);
    const documentHash = Buffer.alloc(32, "test-hash");
    const registerResult = contract.registerProject(
      accounts.owner,
      documentHash,
      "Forest Project",
      "Preservation in Amazon",
      "Brazil",
      1000,
      5000,
      ["forest"]
    );
    expect(registerResult).toEqual({ ok: false, value: 106 });
  });

  it("should update project metadata by owner", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    contract.registerProject(
      accounts.owner,
      documentHash,
      "Old Title",
      "Old Desc",
      "Old Loc",
      1000,
      5000,
      []
    );

    const updateResult = contract.updateProjectMetadata(
      accounts.owner,
      1,
      "New Title",
      "New Desc",
      "New Loc",
      "Updated for accuracy"
    );
    expect(updateResult).toEqual({ ok: true, value: true });

    const details = contract.getProjectDetails(1);
    expect(details.value).toEqual(
      expect.objectContaining({
        title: "New Title",
        description: "New Desc",
        location: "New Loc",
      })
    );

    const updateHistory = contract.getUpdateHistory(1, 1);
    expect(updateHistory.value).toEqual(
      expect.objectContaining({
        changes: "Updated for accuracy",
      })
    );
  });

  it("should prevent metadata update by unauthorized user", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    contract.registerProject(
      accounts.owner,
      documentHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      []
    );

    const updateResult = contract.updateProjectMetadata(
      accounts.unauthorized,
      1,
      "New Title",
      "New Desc",
      "New Loc",
      "Unauthorized"
    );
    expect(updateResult).toEqual({ ok: false, value: 101 });
  });

  it("should transfer ownership successfully", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    contract.registerProject(
      accounts.owner,
      documentHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      []
    );

    const transferResult = contract.transferOwnership(
      accounts.owner,
      1,
      accounts.newOwner,
      "Sold to new entity"
    );
    expect(transferResult).toEqual({ ok: true, value: true });

    const details = contract.getProjectDetails(1);
    expect(details.value?.owner).toBe(accounts.newOwner);

    const history = contract.getOwnershipHistory(1, 1);
    expect(history.value).toEqual(
      expect.objectContaining({
        from: accounts.owner,
        to: accounts.newOwner,
        reason: "Sold to new entity",
      })
    );
  });

  it("should add collaborator successfully", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    contract.registerProject(
      accounts.owner,
      documentHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      []
    );

    const addResult = contract.addCollaborator(
      accounts.owner,
      1,
      accounts.collaborator,
      "Verifier",
      ["update-status", "view-private"]
    );
    expect(addResult).toEqual({ ok: true, value: true });

    const collab = contract.getCollaborator(1, accounts.collaborator);
    expect(collab.value).toEqual(
      expect.objectContaining({
        role: "Verifier",
        permissions: ["update-status", "view-private"],
      })
    );
  });

  it("should update status by collaborator with permission", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    contract.registerProject(
      accounts.owner,
      documentHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      []
    );

    contract.addCollaborator(
      accounts.owner,
      1,
      accounts.collaborator,
      "Verifier",
      ["update-status"]
    );

    const updateResult = contract.updateProjectStatus(accounts.collaborator, 1, "verified");
    expect(updateResult).toEqual({ ok: true, value: true });

    const details = contract.getProjectDetails(1);
    expect(details.value?.status).toBe("verified");
  });

  it("should prevent status update without permission", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    contract.registerProject(
      accounts.owner,
      documentHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      []
    );

    const updateResult = contract.updateProjectStatus(accounts.unauthorized, 1, "verified");
    expect(updateResult).toEqual({ ok: false, value: 101 });
  });

  it("should toggle visibility by owner", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    contract.registerProject(
      accounts.owner,
      documentHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      []
    );

    const toggleResult = contract.toggleVisibility(accounts.owner, 1);
    expect(toggleResult).toEqual({ ok: true, value: false });

    const details = contract.getProjectDetails(1);
    expect(details.value?.visibility).toBe(false);
  });

  it("should pause and unpause contract by owner", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: true });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent invalid hash registration", () => {
    const invalidHash = Buffer.alloc(31, "invalid");
    const registerResult = contract.registerProject(
      accounts.owner,
      invalidHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      []
    );
    expect(registerResult).toEqual({ ok: false, value: 107 });
  });

  it("should prevent too many tags", () => {
    const documentHash = Buffer.alloc(32, "test-hash");
    const tooManyTags = Array(11).fill("tag");
    const registerResult = contract.registerProject(
      accounts.owner,
      documentHash,
      "Title",
      "Desc",
      "Loc",
      1000,
      5000,
      tooManyTags
    );
    expect(registerResult).toEqual({ ok: false, value: 105 });
  });
});