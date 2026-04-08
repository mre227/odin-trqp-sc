import { expect } from "chai";
import { ethers } from "hardhat";

const STATEMENTS_MAPPING_SLOT = 0;

const ACTION_AUTHORIZATION = 0;
const ACTION_DELEGATION = 1;
const ACTION_EGA = 4;

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

async function seedStatement(
  contractAddress: string,
  statementId: string,
  authorityId: string,
  entityId: string,
  action: number,
  status: number
): Promise<void> {
  const base = ethers.BigNumber.from(mappingBaseSlot(statementId));

  const idSlot = ethers.utils.hexZeroPad(base.add(0).toHexString(), 32);
  const authoritySlot = ethers.utils.hexZeroPad(base.add(1).toHexString(), 32);
  const entitySlot = ethers.utils.hexZeroPad(base.add(2).toHexString(), 32);
  const actionSlot = ethers.utils.hexZeroPad(base.add(3).toHexString(), 32);
  const statusSlot = ethers.utils.hexZeroPad(base.add(8).toHexString(), 32);

  await writeStringToStorage(contractAddress, idSlot, statementId);
  await writeStringToStorage(contractAddress, authoritySlot, authorityId);
  await writeStringToStorage(contractAddress, entitySlot, entityId);
  await setStorageAt(
    contractAddress,
    actionSlot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(action), 32)
  );
  await setStorageAt(
    contractAddress,
    statusSlot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(status), 32)
  );
}

async function readUint256(contractAddress: string, slot: string): Promise<number> {
  const value = await ethers.provider.getStorageAt(contractAddress, slot);
  return ethers.BigNumber.from(value).toNumber();
}

describe("updateStatement revocation", function () {
  let registry: any;

  beforeEach(async function () {
    const TrqpRegistry = await ethers.getContractFactory("TrqpRegistry");
    registry = await TrqpRegistry.deploy();
    await registry.deployed();
  });

  it("issuer revokes own statement (Active -> Revoked)", async function () {
    const [issuer] = await ethers.getSigners();
    const statementId = "did:stmt:revocable";

    await seedStatement(
      registry.address,
      statementId,
      issuer.address,
      issuer.address,
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE
    );

    const result = await registry.connect(issuer).callStatic.updateStatement();
    expect(result.statusCode).to.equal("TRQP-0");

    const statusSlot = ethers.utils.hexZeroPad(
      ethers.BigNumber.from(mappingBaseSlot(statementId)).add(8).toHexString(),
      32
    );
    const status = await readUint256(registry.address, statusSlot);
    expect(status).to.equal(STATUS_REVOKED);
  });

  it("non-issuer cannot revoke a statement", async function () {
    const [issuer, other] = await ethers.getSigners();
    const statementId = "did:stmt:owned";

    await seedStatement(
      registry.address,
      statementId,
      issuer.address,
      issuer.address,
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE
    );

    const result = await registry.connect(other).callStatic.updateStatement();
    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("attempt to update fields other than status is denied", async function () {
    const [issuer] = await ethers.getSigners();
    const statementId = "did:stmt:field-update";

    await seedStatement(
      registry.address,
      statementId,
      issuer.address,
      issuer.address,
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE
    );

    const result = await registry.connect(issuer).callStatic.updateStatement();
    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("revoking an already-revoked statement returns error", async function () {
    const [issuer] = await ethers.getSigners();
    const statementId = "did:stmt:already-revoked";

    await seedStatement(
      registry.address,
      statementId,
      issuer.address,
      issuer.address,
      ACTION_AUTHORIZATION,
      STATUS_REVOKED
    );

    const result = await registry.connect(issuer).callStatic.updateStatement();
    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("EGA can revoke any statement", async function () {
    const [issuer, ega] = await ethers.getSigners();
    const egaStmtId = "did:stmt:ega";
    const targetId = "did:stmt:ega-target";

    await seedStatement(
      registry.address,
      egaStmtId,
      issuer.address,
      ega.address,
      ACTION_EGA,
      STATUS_ACTIVE
    );

    await seedStatement(
      registry.address,
      targetId,
      issuer.address,
      issuer.address,
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE
    );

    const result = await registry.connect(ega).callStatic.updateStatement();
    expect(result.statusCode).to.equal("TRQP-0");
  });

  it("revoking a parent statement cascades to child statements", async function () {
    const [issuer] = await ethers.getSigners();
    const parentId = "did:stmt:parent";
    const childId = "did:stmt:child";
    const childAuthority = "did:actor:child";

    await seedStatement(
      registry.address,
      parentId,
      issuer.address,
      childAuthority,
      ACTION_DELEGATION,
      STATUS_ACTIVE
    );

    await seedStatement(
      registry.address,
      childId,
      childAuthority,
      "did:actor:leaf",
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE
    );

    const result = await registry.connect(issuer).callStatic.updateStatement();
    expect(result.statusCode).to.equal("TRQP-0");

    const childStatusSlot = ethers.utils.hexZeroPad(
      ethers.BigNumber.from(mappingBaseSlot(childId)).add(8).toHexString(),
      32
    );
    const childStatus = await readUint256(registry.address, childStatusSlot);
    expect(childStatus).to.equal(STATUS_REVOKED);
  });
});
