import { expect } from "chai";
import { ethers } from "hardhat";

const STATEMENTS_MAPPING_SLOT = 0;

const PENDING_SIGN_STATEMENT_ID_SLOT = 29;
const PENDING_SIGN_PROOF_TYPE_SLOT = 30;
const PENDING_SIGN_PROOF_CRYPTOSUITE_SLOT = 31;
const PENDING_SIGN_PROOF_VERIFICATION_METHOD_SLOT = 32;
const PENDING_SIGN_PROOF_PURPOSE_SLOT = 33;
const PENDING_SIGN_PROOF_DOMAIN_SLOT = 34;
const PENDING_SIGN_PROOF_CHALLENGE_SLOT = 35;
const PENDING_SIGN_PROOF_VALUE_SLOT = 36;
const PENDING_SIGN_PROOF_CREATED_SLOT = 37;
const PENDING_SIGN_JOB_ID_SLOT = 38;
const PENDING_SIGN_VERIFICATION_METHODS_SLOT = 39;
const PENDING_SIGN_SIGNING_RESPONSE_SLOT = 40;

const ACTION_AUTHORIZATION = 0;

const STATUS_STARTED = 0;
const STATUS_ACTIVE = 1;
const STATUS_REVOKED = 2;

type ProofFixture = {
  proofType: string;
  cryptosuite: string;
  verificationMethod: string;
  proofPurpose: string;
  created: number;
  domain: string;
  challenge: string;
  proofValue: string;
};

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

async function setPendingSignInputs(
  contractAddress: string,
  statementId: string,
  proof: ProofFixture
): Promise<void> {
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_STATEMENT_ID_SLOT), 32),
    statementId
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_TYPE_SLOT), 32),
    proof.proofType
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_CRYPTOSUITE_SLOT), 32),
    proof.cryptosuite
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_VERIFICATION_METHOD_SLOT), 32),
    proof.verificationMethod
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_PURPOSE_SLOT), 32),
    proof.proofPurpose
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_DOMAIN_SLOT), 32),
    proof.domain
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_CHALLENGE_SLOT), 32),
    proof.challenge
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_VALUE_SLOT), 32),
    proof.proofValue
  );
  await setStorageAt(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_PROOF_CREATED_SLOT), 32),
    ethers.utils.hexZeroPad(ethers.utils.hexlify(proof.created), 32)
  );
}

async function readStatus(contractAddress: string, statementId: string): Promise<number> {
  const statusSlot = ethers.utils.hexZeroPad(
    ethers.BigNumber.from(mappingBaseSlot(statementId)).add(8).toHexString(),
    32
  );
  const statusValue = await ethers.provider.getStorageAt(contractAddress, statusSlot);
  return ethers.BigNumber.from(statusValue).toNumber();
}

async function setPendingDidCreateStep2Inputs(
  contractAddress: string,
  jobId: string,
  verificationMethodsJson: string,
  signingResponseJson: string
): Promise<void> {
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_JOB_ID_SLOT), 32),
    jobId
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_VERIFICATION_METHODS_SLOT), 32),
    verificationMethodsJson
  );
  await writeStringToStorage(
    contractAddress,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(PENDING_SIGN_SIGNING_RESPONSE_SLOT), 32),
    signingResponseJson
  );
}

describe("signStatement", function () {
  let registry: any;
  let signer: any;
  let other: any;

  beforeEach(async function () {
    const TrqpRegistry = await ethers.getContractFactory("TrqpRegistry");
    registry = await TrqpRegistry.deploy();
    await registry.deployed();

    [signer, other] = await ethers.getSigners();
  });

  function validProofFor(authority: string): ProofFixture {
    return {
      proofType: "DataIntegrityProof",
      cryptosuite: "eddsa-jcs-2022",
      verificationMethod: `${authority}#key-1`,
      proofPurpose: "assertionMethod",
      created: 1712669000,
      domain: "did:eco:1|did:tr:1|schema:a",
      challenge: "challenge-sign-1",
      proofValue: "z2J8A5gkYxkW6QxQ7XhQ9r8m4fQ1vQk2pQYwA2fR9mPq",
    };
  }

  function vmPayloadFor(authority: string): string {
    return JSON.stringify([
      {
        id: `${authority}#key-1`,
        type: "Ed25519VerificationKey2018",
        controller: authority,
        publicKeyMultibase: "z6MkhWm5f6QxXnS7Dg7Y7K2k2o4W6L8m2f3Q6n1s7j8k9p0",
      },
    ]);
  }

  function validSigningResponseFor(statementId: string): string {
    const kid = `${statementId}#key-1`;
    return JSON.stringify({
      [kid]: {
        signature:
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        kid,
        alg: "EdDSA",
      },
    });
  }

  function invalidProofFor(authority: string): ProofFixture {
    return {
      proofType: "DataIntegrityProof",
      cryptosuite: "eddsa-jcs-2022",
      verificationMethod: `${authority}#key-1`,
      proofPurpose: "assertionMethod",
      created: 1712669000,
      domain: "did:eco:bad|did:tr:bad|schema:bad",
      challenge: "challenge-sign-bad",
      proofValue: "zInvalidProofValue",
    };
  }

  it("returns TRQP-0 and sets statement status to Active for valid proof on Started statement", async function () {
    const statementId = "did:stmt:sign-started-valid";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-started-valid",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();
    await registry.connect(signer).signStatement();

    expect(result.statusCode).to.equal("TRQP-0");
    const status = await readStatus(registry.address, statementId);
    expect(status).to.equal(STATUS_ACTIVE);
  });

  it("returns TRQP-300 when statement does not exist", async function () {
    const existingId = "did:stmt:sign-existing";
    const missingId = "did:stmt:sign-missing";
    await seedStatement(
      registry.address,
      existingId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, missingId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-missing",
      vmPayloadFor(signer.address),
      validSigningResponseFor(missingId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when statement is already Active", async function () {
    const statementId = "did:stmt:sign-already-active";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_ACTIVE
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-active",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when statement is already Revoked", async function () {
    const statementId = "did:stmt:sign-already-revoked";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_REVOKED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-revoked",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-100 when proof verification fails", async function () {
    const statementId = "did:stmt:sign-proof-invalid";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, invalidProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-proof-invalid",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-100");
  });

  it("returns TRQP-300 when statement id is empty", async function () {
    const seededId = "did:stmt:sign-empty-id-seed";
    await seedStatement(
      registry.address,
      seededId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, "", validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-empty-id",
      vmPayloadFor(signer.address),
      validSigningResponseFor("did:stmt:unused")
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-100 when caller is not the intended signer", async function () {
    const statementId = "did:stmt:sign-wrong-signer";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-wrong-signer",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(other).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-100");
  });

  it("returns TRQP-300 when jobId is empty", async function () {
    const statementId = "did:stmt:sign-empty-job";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when verificationMethods is empty", async function () {
    const statementId = "did:stmt:sign-empty-vms";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-empty-vms",
      "[]",
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when signingResponse is missing", async function () {
    const statementId = "did:stmt:sign-missing-signing-response";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-missing-signing-response",
      vmPayloadFor(signer.address),
      ""
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when signingResponse does not include expected kid", async function () {
    const statementId = "did:stmt:sign-missing-kid";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-missing-kid",
      vmPayloadFor(signer.address),
      JSON.stringify({
        "did:stmt:other#key-1": {
          signature:
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          kid: "did:stmt:other#key-1",
          alg: "EdDSA",
        },
      })
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when signingResponse alg is not EdDSA", async function () {
    const statementId = "did:stmt:sign-bad-alg";
    const kid = `${statementId}#key-1`;
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, validProofFor(signer.address));
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-bad-alg",
      vmPayloadFor(signer.address),
      JSON.stringify({
        [kid]: {
          signature:
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          kid,
          alg: "ES256",
        },
      })
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when proofValue is empty", async function () {
    const statementId = "did:stmt:sign-empty-proof-value";
    const badProof = validProofFor(signer.address);
    badProof.proofValue = "";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, badProof);
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-empty-proof-value",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when verificationMethod is empty", async function () {
    const statementId = "did:stmt:sign-empty-verification-method";
    const badProof = validProofFor(signer.address);
    badProof.verificationMethod = "";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, badProof);
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-empty-verification-method",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when proof created is zero", async function () {
    const statementId = "did:stmt:sign-zero-created";
    const badProof = validProofFor(signer.address);
    badProof.created = 0;
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, badProof);
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-zero-created",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when proof type is not DataIntegrityProof", async function () {
    const statementId = "did:stmt:sign-bad-proof-type";
    const badProof = validProofFor(signer.address);
    badProof.proofType = "JwtProof2020";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, badProof);
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-bad-proof-type",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when cryptosuite is not eddsa-jcs-2022", async function () {
    const statementId = "did:stmt:sign-bad-cryptosuite";
    const badProof = validProofFor(signer.address);
    badProof.cryptosuite = "rsa-pss-2020";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, badProof);
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-bad-cryptosuite",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-300 when proofPurpose is not assertionMethod", async function () {
    const statementId = "did:stmt:sign-bad-proof-purpose";
    const badProof = validProofFor(signer.address);
    badProof.proofPurpose = "authentication";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, badProof);
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-bad-proof-purpose",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-300");
  });

  it("returns TRQP-410 when challenge is missing for the statement", async function () {
    const statementId = "did:stmt:sign-missing-challenge";
    const badProof = validProofFor(signer.address);
    badProof.challenge = "";
    await seedStatement(
      registry.address,
      statementId,
      signer.address,
      signer.address,
      ACTION_AUTHORIZATION,
      STATUS_STARTED
    );
    await setPendingSignInputs(registry.address, statementId, badProof);
    await setPendingDidCreateStep2Inputs(
      registry.address,
      "job-sign-missing-challenge",
      vmPayloadFor(signer.address),
      validSigningResponseFor(statementId)
    );

    const result = await registry.connect(signer).callStatic.signStatement();

    expect(result.statusCode).to.equal("TRQP-410");
  });
});