import { ethers } from "hardhat";
import { expect } from "chai";

describe("initialize", function () {
  let registry: any;

  const input = {
    bootstrapId: "did:orcl:test-setup",
    ecosystemId: "did:orcl:eco-1",
    ecosystemStatementId: "did:orcl:eco-stmt-1",
    egaId: "did:orcl:ega-1",
    egaStatementId: "did:orcl:ega-stmt-1",
    trustRegistryId: "did:orcl:tr-1",
    trustRegistryStatementId: "did:orcl:tr-stmt-1",
  };

  beforeEach(async function () {
    const TrqpRegistry = await ethers.getContractFactory("TrqpRegistry");
    registry = await TrqpRegistry.deploy();
    await registry.deployed();
  });

  it("should create three Started statements on success", async function () {
    const tx = await registry.initialize(input);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });

  it("should return already initialized on second call", async function () {
    await (await registry.initialize(input)).wait();
    const result = await registry.callStatic.initialize(input);
    expect(result.statusCode).to.equal("TRQP-300");
    expect(result.description).to.equal("already initialized");
  });
});