import { expect } from "chai";
import { ethers } from "hardhat";

const STATEMENTS_MAPPING_SLOT = 0;

const PENDING_SEARCH_AUTHORITY_SLOT = 21;
const PENDING_SEARCH_ENTITY_SLOT = 22;
const PENDING_SEARCH_ACTION_SLOT = 23;
const PENDING_SEARCH_CREATED_AT_SLOT = 24;
const PENDING_SEARCH_STATUS_SLOT = 25;
const PENDING_SEARCH_ECOSYSTEM_SLOT = 26;
const PENDING_SEARCH_TRUST_REGISTRY_SLOT = 27;
const PENDING_SEARCH_RESOURCES_SLOT = 28;

const ACTION_AUTHORIZATION = 0;
const ACTION_DELEGATION = 1;
const ACTION_ISSUANCE = 2;

const STATUS_STARTED = 0;
const STATUS_ACTIVE = 1;
const STATUS_REVOKED = 2;

async function setStorageAt(
  contractAddress: string,
  slot: string,
  value: string
): Promise<void> {
  await ethers.provider.send("hardhat_setStorageAt", [contractAddress, slot, value]);
}

function encodeShortString(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > 31) {
    throw new Error("encodeShortString only supports <= 31 bytes");
  }
  const buf = Buffer.alloc(32);
  bytes.copy(buf, 0);
  buf[31] = bytes.length * 2 + 1;
  return `0x${buf.toString("hex")}`;
}

async function writeStringToStorage(
  contractAddress: string,
  slot: string,
  value: string
): Promise<void> {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= 31) {
    await setStorageAt(contractAddress, slot, encodeShortString(value));
    return;
  }

  const lenSlotValue = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(bytes.length * 2),
    32
  );
  await setStorageAt(contractAddress, slot, lenSlotValue);

  const dataBase = ethers.utils.keccak256(slot);
  const chunks = Math.ceil(bytes.length / 32);
  for (let i = 0; i < chunks; i++) {
    const chunk = bytes.slice(i * 32, (i + 1) * 32);
    const buf = Buffer.alloc(32);
    chunk.copy(buf, 0);
    const dataSlot = ethers.utils.hexZeroPad(
      ethers.BigNumber.from(dataBase).add(i).toHexString(),
      32
    );
    await setStorageAt(contractAddress, dataSlot, `0x${buf.toString("hex")}`);
  }
}

async function writeStringArrayToStorage(
  contractAddress: string,
  slot: string,
  values: string[]
): Promise<void> {
  await setStorageAt(
    contractAddress,
    slot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(values.length), 32)
  );

  const dataBase = ethers.BigNumber.from(ethers.utils.keccak256(slot));
  for (let i = 0; i < values.length; i++) {
    const itemSlot = ethers.utils.hexZeroPad(dataBase.add(i).toHexString(), 32);
    await writeStringToStorage(contractAddress, itemSlot, values[i]);
  }
}

function mappingBaseSlot(key: string): string {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string", "uint256"], [key, STATEMENTS_MAPPING_SLOT])
  );
}

async function seedStatement(
  contractAddress: string,
  statementId: string,
  authorityId: string,
  entityId: string,
  action: number,
  status: number,
  created: number,
  resources: string[],
  ecosystemId: string,
  trustRegistryId: string
): Promise<void> {
  const base = ethers.BigNumber.from(mappingBaseSlot(statementId));

  const idSlot = ethers.utils.hexZeroPad(base.add(0).toHexString(), 32);
  const authoritySlot = ethers.utils.hexZeroPad(base.add(1).toHexString(), 32);
  const entitySlot = ethers.utils.hexZeroPad(base.add(2).toHexString(), 32);
  const actionSlot = ethers.utils.hexZeroPad(base.add(3).toHexString(), 32);
  const resourcesSlot = ethers.utils.hexZeroPad(base.add(4).toHexString(), 32);
  const createdSlot = ethers.utils.hexZeroPad(base.add(5).toHexString(), 32);
  const statusSlot = ethers.utils.hexZeroPad(base.add(8).toHexString(), 32);
  const ecosystemSlot = ethers.utils.hexZeroPad(base.add(17).toHexString(), 32);
  const trustRegistrySlot = ethers.utils.hexZeroPad(base.add(18).toHexString(), 32);

  await writeStringToStorage(contractAddress, idSlot, statementId);
  await writeStringToStorage(contractAddress, authoritySlot, authorityId);
  await writeStringToStorage(contractAddress, entitySlot, entityId);
  await setStorageAt(
    contractAddress,
    actionSlot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(action), 32)
  );
  await writeStringArrayToStorage(contractAddress, resourcesSlot, resources);
  await setStorageAt(
    contractAddress,
    createdSlot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(created), 32)
  );
  await setStorageAt(
    contractAddress,
    statusSlot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(status), 32)
  );
  await writeStringToStorage(contractAddress, ecosystemSlot, ecosystemId);
  await writeStringToStorage(contractAddress, trustRegistrySlot, trustRegistryId);
}

type SearchFilters = {
  authorityId?: string;
  entityId?: string;
  action?: number;
  resources?: string[];
  createdAt?: string;
  status?: number;
  ecosystemId?: string;
  trustRegistryId?: string;
};

async function setPendingSearchFilters(
  contractAddress: string,
  filters: SearchFilters
): Promise<void> {
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_AUTHORITY_SLOT), 32),
    filters.authorityId ?? ""
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_ENTITY_SLOT), 32),
    filters.entityId ?? ""
  );

  const actionValue = filters.action ?? 0;
  await setStorageAt(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_ACTION_SLOT), 32),
    ethers.utils.hexZeroPad(ethers.utils.hexlify(actionValue), 32)
  );

  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_CREATED_AT_SLOT), 32),
    filters.createdAt ?? ""
  );

  const statusValue = filters.status ?? STATUS_STARTED;
  await setStorageAt(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_STATUS_SLOT), 32),
    ethers.utils.hexZeroPad(ethers.utils.hexlify(statusValue), 32)
  );

  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_ECOSYSTEM_SLOT), 32),
    filters.ecosystemId ?? ""
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_TRUST_REGISTRY_SLOT), 32),
    filters.trustRegistryId ?? ""
  );

  await writeStringArrayToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SEARCH_RESOURCES_SLOT), 32),
    filters.resources ?? []
  );
}

describe("searchStatement", function () {
  let registry: any;

  beforeEach(async function () {
    const TrqpRegistry = await ethers.getContractFactory("TrqpRegistry");
    registry = await TrqpRegistry.deploy();
    await registry.deployed();

    await seedStatement(
      registry.address,
      "did:stmt:auth-alpha",
      "did:authority:alpha",
      "did:entity:one",
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE,
      1712661000,
      ["schema:a", "schema:b"],
      "did:ecosystem:one",
      "did:trust:one"
    );

    await seedStatement(
      registry.address,
      "did:stmt:deleg-beta",
      "did:authority:beta",
      "did:entity:one",
      ACTION_DELEGATION,
      STATUS_ACTIVE,
      1712662000,
      ["schema:b", "schema:c"],
      "did:ecosystem:one",
      "did:trust:two"
    );

    await seedStatement(
      registry.address,
      "did:stmt:issuance-gamma",
      "did:authority:gamma",
      "did:entity:two",
      ACTION_ISSUANCE,
      STATUS_REVOKED,
      1712663000,
      ["schema:c"],
      "did:ecosystem:two",
      "did:trust:two"
    );

    await seedStatement(
      registry.address,
      "did:stmt:latest-alpha",
      "did:authority:alpha",
      "did:entity:three",
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE,
      1712669000,
      ["schema:a"],
      "did:ecosystem:one",
      "did:trust:one"
    );
  });

  it("returns TRQP-300 when createdAt is not RFC3339", async function () {
    await setPendingSearchFilters(registry.address, {
      createdAt: "08-04-2026 10:20:30",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-300");
    expect(result.statements).to.have.lengthOf(0);
  });

  it("returns TRQP-200 when there are no matching statements", async function () {
    await setPendingSearchFilters(registry.address, {
      authorityId: "did:authority:none",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-200");
    expect(result.statements).to.have.lengthOf(0);
  });

  it("filters by authorityId", async function () {
    await setPendingSearchFilters(registry.address, {
      authorityId: "did:authority:alpha",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(2);
    expect(result.statements[0].id).to.equal("did:stmt:latest-alpha");
    expect(result.statements[1].id).to.equal("did:stmt:auth-alpha");
  });

  it("filters by entityId", async function () {
    await setPendingSearchFilters(registry.address, {
      entityId: "did:entity:one",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(2);
    expect(result.statements[0].id).to.equal("did:stmt:deleg-beta");
    expect(result.statements[1].id).to.equal("did:stmt:auth-alpha");
  });

  it("filters by action", async function () {
    await setPendingSearchFilters(registry.address, {
      action: ACTION_DELEGATION,
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal("did:stmt:deleg-beta");
    expect(result.statements[0].action).to.equal(ACTION_DELEGATION);
  });

  it("filters by exact createdAt value", async function () {
    await setPendingSearchFilters(registry.address, {
      createdAt: "2024-04-09T03:50:00Z",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal("did:stmt:deleg-beta");
  });

  it("filters by resources with $all semantics", async function () {
    await setPendingSearchFilters(registry.address, {
      resources: ["schema:a", "schema:b"],
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal("did:stmt:auth-alpha");
    expect(result.statements[0].resources).to.deep.equal(["schema:a", "schema:b"]);
  });

  it("filters by resource subset and returns all statements containing that resource", async function () {
    await setPendingSearchFilters(registry.address, {
      resources: ["schema:b"],
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(2);
    expect(result.statements[0].id).to.equal("did:stmt:deleg-beta");
    expect(result.statements[1].id).to.equal("did:stmt:auth-alpha");
  });

  it("filters by status", async function () {
    await setPendingSearchFilters(registry.address, {
      status: STATUS_REVOKED,
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal("did:stmt:issuance-gamma");
    expect(result.statements[0].status).to.equal(STATUS_REVOKED);
  });

  it("filters by ecosystem context", async function () {
    await setPendingSearchFilters(registry.address, {
      ecosystemId: "did:ecosystem:two",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal("did:stmt:issuance-gamma");
  });

  it("filters by trust registry context", async function () {
    await setPendingSearchFilters(registry.address, {
      trustRegistryId: "did:trust:one",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(2);
    expect(result.statements[0].id).to.equal("did:stmt:latest-alpha");
    expect(result.statements[1].id).to.equal("did:stmt:auth-alpha");
  });

  it("applies combined filters", async function () {
    await setPendingSearchFilters(registry.address, {
      authorityId: "did:authority:alpha",
      action: ACTION_AUTHORIZATION,
      resources: ["schema:a"],
      status: STATUS_ACTIVE,
      ecosystemId: "did:ecosystem:one",
      trustRegistryId: "did:trust:one",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(2);
    expect(result.statements[0].id).to.equal("did:stmt:latest-alpha");
    expect(result.statements[1].id).to.equal("did:stmt:auth-alpha");
  });

  it("returns TRQP-200 when combined filters produce zero matches", async function () {
    await setPendingSearchFilters(registry.address, {
      authorityId: "did:authority:alpha",
      action: ACTION_DELEGATION,
      status: STATUS_REVOKED,
      trustRegistryId: "did:trust:one",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-200");
    expect(result.statements).to.have.lengthOf(0);
  });

  it("returns matches sorted by created descending", async function () {
    await setPendingSearchFilters(registry.address, {
      action: ACTION_AUTHORIZATION,
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(2);
    expect(result.statements[0].created).to.be.greaterThan(result.statements[1].created);
    expect(result.statements[0].id).to.equal("did:stmt:latest-alpha");
    expect(result.statements[1].id).to.equal("did:stmt:auth-alpha");
  });

  it("ignores malformed records and returns TRQP-200 if no valid matches remain", async function () {
    const malformedId = "did:stmt:malformed-search";
    const base = ethers.BigNumber.from(mappingBaseSlot(malformedId));

    await writeStringToStorage(
      registry.address,
      ethers.utils.hexZeroPad(base.add(0).toHexString(), 32),
      malformedId
    );
    await writeStringToStorage(
      registry.address,
      ethers.utils.hexZeroPad(base.add(1).toHexString(), 32),
      ""
    );
    await writeStringToStorage(
      registry.address,
      ethers.utils.hexZeroPad(base.add(2).toHexString(), 32),
      "did:entity:bad"
    );

    await setPendingSearchFilters(registry.address, {
      authorityId: "",
      entityId: "did:entity:bad",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-200");
    expect(result.statements).to.have.lengthOf(0);
  });

  it("ignores malformed records but still returns valid matches", async function () {
    const malformedId = "did:stmt:malformed-with-valid";
    const base = ethers.BigNumber.from(mappingBaseSlot(malformedId));

    await writeStringToStorage(
      registry.address,
      ethers.utils.hexZeroPad(base.add(0).toHexString(), 32),
      malformedId
    );
    await writeStringToStorage(
      registry.address,
      ethers.utils.hexZeroPad(base.add(1).toHexString(), 32),
      ""
    );
    await writeStringToStorage(
      registry.address,
      ethers.utils.hexZeroPad(base.add(2).toHexString(), 32),
      "did:entity:one"
    );

    await setPendingSearchFilters(registry.address, {
      entityId: "did:entity:one",
    });

    const result = await registry.callStatic.searchStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(2);
    expect(result.statements[0].id).to.equal("did:stmt:deleg-beta");
    expect(result.statements[1].id).to.equal("did:stmt:auth-alpha");
  });
});
