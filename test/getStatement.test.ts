import { expect } from "chai";
import { ethers } from "hardhat";

const STATEMENTS_MAPPING_SLOT = 0;
const PENDING_GET_STATEMENT_ID_SLOT = 20;

const ACTION_AUTHORIZATION = 0;
const ACTION_DELEGATION = 1;
const ACTION_ECOSYSTEM = 3;

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

function mappingBaseSlot(key: string): string {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string", "uint256"], [key, STATEMENTS_MAPPING_SLOT])
  );
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

async function seedStatement(
  contractAddress: string,
  statementId: string,
  authorityId: string,
  entityId: string,
  action: number,
  status: number,
  created: number,
  resources: string[]
): Promise<void> {
  const base = ethers.BigNumber.from(mappingBaseSlot(statementId));

  const idSlot = ethers.utils.hexZeroPad(base.add(0).toHexString(), 32);
  const authoritySlot = ethers.utils.hexZeroPad(base.add(1).toHexString(), 32);
  const entitySlot = ethers.utils.hexZeroPad(base.add(2).toHexString(), 32);
  const actionSlot = ethers.utils.hexZeroPad(base.add(3).toHexString(), 32);
  const resourcesSlot = ethers.utils.hexZeroPad(base.add(4).toHexString(), 32);
  const createdSlot = ethers.utils.hexZeroPad(base.add(5).toHexString(), 32);
  const statusSlot = ethers.utils.hexZeroPad(base.add(8).toHexString(), 32);

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
}

async function setPendingGetStatementId(
  contractAddress: string,
  statementId: string
): Promise<void> {
  const idSlot = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(PENDING_GET_STATEMENT_ID_SLOT),
    32
  );
  await writeStringToStorage(contractAddress, idSlot, statementId);
}

describe("getStatement", function () {
  let registry: any;

  beforeEach(async function () {
    const TrqpRegistry = await ethers.getContractFactory("TrqpRegistry");
    registry = await TrqpRegistry.deploy();
    await registry.deployed();
  });

  it("returns TRQP-300 when statementDid is empty", async function () {
    await setPendingGetStatementId(registry.address, "");

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-300");
    expect(result.statements).to.have.lengthOf(0);
  });

  it("returns TRQP-200 when statement does not exist", async function () {
    await setPendingGetStatementId(registry.address, "did:stmt:not-found");

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-200");
    expect(result.statements).to.have.lengthOf(0);
  });

  it("returns TRQP-0 and statement data for an active valid statement", async function () {
    const statementId = "did:stmt:active-valid";
    await seedStatement(
      registry.address,
      statementId,
      "did:authority:alpha",
      "did:entity:subject",
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE,
      1712661000,
      ["schema:employment"]
    );
    await setPendingGetStatementId(registry.address, statementId);

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal(statementId);
    expect(result.statements[0].authorityId).to.equal("did:authority:alpha");
    expect(result.statements[0].entityId).to.equal("did:entity:subject");
    expect(result.statements[0].action).to.equal(ACTION_AUTHORIZATION);
    expect(result.statements[0].status).to.equal(STATUS_ACTIVE);
    expect(result.statements[0].resources).to.deep.equal(["schema:employment"]);
  });

  it("returns TRQP-100 invalid and statement payload for revoked statements", async function () {
    const statementId = "did:stmt:revoked";
    await seedStatement(
      registry.address,
      statementId,
      "did:authority:beta",
      "did:entity:subject",
      ACTION_DELEGATION,
      STATUS_REVOKED,
      1712662000,
      ["schema:delegation"]
    );
    await setPendingGetStatementId(registry.address, statementId);

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-100");
    expect(result.status).to.equal("invalid");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal(statementId);
    expect(result.statements[0].status).to.equal(STATUS_REVOKED);
  });

  it("returns TRQP-100 invalid when statement shape is malformed", async function () {
    const malformedId = "did:stmt:malformed";

    const base = ethers.BigNumber.from(mappingBaseSlot(malformedId));
    const idSlot = ethers.utils.hexZeroPad(base.add(0).toHexString(), 32);
    const authoritySlot = ethers.utils.hexZeroPad(base.add(1).toHexString(), 32);
    const entitySlot = ethers.utils.hexZeroPad(base.add(2).toHexString(), 32);
    const statusSlot = ethers.utils.hexZeroPad(base.add(8).toHexString(), 32);

    await writeStringToStorage(registry.address, idSlot, malformedId);
    await writeStringToStorage(registry.address, authoritySlot, "");
    await writeStringToStorage(registry.address, entitySlot, "did:entity:shape");
    await setStorageAt(
      registry.address,
      statusSlot,
      ethers.utils.hexZeroPad(ethers.utils.hexlify(STATUS_STARTED), 32)
    );
    await setPendingGetStatementId(registry.address, malformedId);

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-100");
    expect(result.status).to.equal("invalid");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal(malformedId);
  });

  it("returns TRQP-100 invalid when statement is in Started status", async function () {
    const statementId = "did:stmt:started";
    await seedStatement(
      registry.address,
      statementId,
      "did:authority:started",
      "did:entity:started",
      ACTION_AUTHORIZATION,
      STATUS_STARTED,
      1712663000,
      ["schema:started"]
    );
    await setPendingGetStatementId(registry.address, statementId);

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-100");
    expect(result.status).to.equal("invalid");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal(statementId);
    expect(result.statements[0].status).to.equal(STATUS_STARTED);
  });

  it("returns TRQP-100 invalid when non-bootstrap statement has empty resources", async function () {
    const statementId = "did:stmt:no-resources";
    await seedStatement(
      registry.address,
      statementId,
      "did:authority:no-resources",
      "did:entity:no-resources",
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE,
      1712664000,
      []
    );
    await setPendingGetStatementId(registry.address, statementId);

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-100");
    expect(result.status).to.equal("invalid");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal(statementId);
  });

  it("returns TRQP-0 for a bootstrap ecosystem statement with empty resources", async function () {
    const statementId = "did:stmt:bootstrap-ecosystem";
    await seedStatement(
      registry.address,
      statementId,
      "did:bootstrap",
      "did:ecosystem:main",
      ACTION_ECOSYSTEM,
      STATUS_ACTIVE,
      1712665000,
      []
    );
    await setPendingGetStatementId(registry.address, statementId);

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal(statementId);
    expect(result.statements[0].action).to.equal(ACTION_ECOSYSTEM);
    expect(result.statements[0].resources).to.deep.equal([]);
  });

  it("returns TRQP-100 invalid when non-bootstrap resources contain an empty id", async function () {
    const statementId = "did:stmt:empty-resource-item";
    await seedStatement(
      registry.address,
      statementId,
      "did:authority:empty-resource-item",
      "did:entity:empty-resource-item",
      ACTION_DELEGATION,
      STATUS_ACTIVE,
      1712666000,
      [""]
    );
    await setPendingGetStatementId(registry.address, statementId);

    const result = await registry.callStatic.getStatement();

    expect(result.statusCode).to.equal("TRQP-100");
    expect(result.status).to.equal("invalid");
    expect(result.statements).to.have.lengthOf(1);
    expect(result.statements[0].id).to.equal(statementId);
  });
});
