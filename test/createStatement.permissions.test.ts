import { expect } from "chai";
import { ethers } from "hardhat";

const MAPPING_SLOT = 0;
const ACTION_AUTHORIZATION = 0;
const ACTION_DELEGATION = 1;
const ACTION_ISSUANCE = 2;
const STATUS_ACTIVE = 1;

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
    ethers.utils.defaultAbiCoder.encode(["string", "uint256"], [key, MAPPING_SLOT])
  );
}

async function setStorageAt(
  contractAddress: string,
  slot: string,
  value: string
): Promise<void> {
  await ethers.provider.send("hardhat_setStorageAt", [contractAddress, slot, value]);
}

async function seedStatement(
  contractAddress: string,
  statementId: string,
  authorityId: string,
  action: number
): Promise<void> {
  const base = ethers.BigNumber.from(mappingBaseSlot(statementId));

  const idSlot = ethers.utils.hexZeroPad(base.add(0).toHexString(), 32);
  const authoritySlot = ethers.utils.hexZeroPad(base.add(1).toHexString(), 32);
  const actionSlot = ethers.utils.hexZeroPad(base.add(3).toHexString(), 32);
  const statusSlot = ethers.utils.hexZeroPad(base.add(8).toHexString(), 32);

  await writeStringToStorage(contractAddress, idSlot, statementId);
  await writeStringToStorage(contractAddress, authoritySlot, authorityId);
  await setStorageAt(
    contractAddress,
    actionSlot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(action), 32)
  );
  await setStorageAt(
    contractAddress,
    statusSlot,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(STATUS_ACTIVE), 32)
  );
}

describe("createStatement permissions", function () {
  let registry: any;

  beforeEach(async function () {
    const TrqpRegistry = await ethers.getContractFactory("TrqpRegistry");
    registry = await TrqpRegistry.deploy();
    await registry.deployed();
  });

  const cases = [
    {
      name: "EGA creates Authorization over any schema",
      actor: "did:ega",
      actionAttempted: "Authorization",
      existingAction: ACTION_AUTHORIZATION,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "EGA creates Delegation over any schema",
      actor: "did:ega",
      actionAttempted: "Delegation",
      existingAction: ACTION_DELEGATION,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "EGA creates Issuance over any schema",
      actor: "did:ega",
      actionAttempted: "Issuance",
      existingAction: ACTION_ISSUANCE,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "Schema issuer creates Authorization over own schema",
      actor: "did:issuer",
      actionAttempted: "Authorization",
      existingAction: ACTION_AUTHORIZATION,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "Schema issuer creates Delegation over own schema",
      actor: "did:issuer",
      actionAttempted: "Delegation",
      existingAction: ACTION_DELEGATION,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "Schema issuer creates Issuance over own schema",
      actor: "did:issuer",
      actionAttempted: "Issuance",
      existingAction: ACTION_ISSUANCE,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "Schema issuer creates Authorization over foreign schema",
      actor: "did:issuer",
      actionAttempted: "Authorization",
      existingAction: ACTION_AUTHORIZATION,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "Schema issuer creates Delegation over foreign schema",
      actor: "did:issuer",
      actionAttempted: "Delegation",
      existingAction: ACTION_DELEGATION,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "Schema issuer creates Issuance over foreign schema",
      actor: "did:issuer",
      actionAttempted: "Issuance",
      existingAction: ACTION_ISSUANCE,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "DID with Authorization creates Delegation for same schema",
      actor: "did:authorized",
      actionAttempted: "Delegation",
      existingAction: ACTION_AUTHORIZATION,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "DID with Authorization creates Issuance for same schema",
      actor: "did:authorized",
      actionAttempted: "Issuance",
      existingAction: ACTION_AUTHORIZATION,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "DID with Authorization creates Authorization for same schema",
      actor: "did:authorized",
      actionAttempted: "Authorization",
      existingAction: ACTION_AUTHORIZATION,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "DID with Delegation creates Issuance for same schema",
      actor: "did:delegated",
      actionAttempted: "Issuance",
      existingAction: ACTION_DELEGATION,
      expectedStatusCode: "TRQP-0",
    },
    {
      name: "DID with Delegation creates Authorization for same schema",
      actor: "did:delegated",
      actionAttempted: "Authorization",
      existingAction: ACTION_DELEGATION,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "DID with Delegation creates Delegation for same schema",
      actor: "did:delegated",
      actionAttempted: "Delegation",
      existingAction: ACTION_DELEGATION,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "DID with Issuance creates Authorization for same schema",
      actor: "did:issuer-role",
      actionAttempted: "Authorization",
      existingAction: ACTION_ISSUANCE,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "DID with Issuance creates Delegation for same schema",
      actor: "did:issuer-role",
      actionAttempted: "Delegation",
      existingAction: ACTION_ISSUANCE,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "DID with Issuance creates Issuance for same schema",
      actor: "did:issuer-role",
      actionAttempted: "Issuance",
      existingAction: ACTION_ISSUANCE,
      expectedStatusCode: "TRQP-300",
    },
    {
      name: "Unrelated DID creates any statement",
      actor: "did:unrelated",
      actionAttempted: "Authorization",
      existingAction: ACTION_AUTHORIZATION,
      expectedStatusCode: "TRQP-300",
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, async function () {
      const statementId = `did:stmt:${testCase.actor}:${testCase.actionAttempted}`;
      await seedStatement(registry.address, statementId, testCase.actor, testCase.existingAction);

      const result = await registry.callStatic.createStatement();
      expect(result.statusCode).to.equal(testCase.expectedStatusCode);
    });
  }
});
