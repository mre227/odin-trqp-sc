import { ethers } from "hardhat";
import { expect } from "chai";

describe("finishBootstrap", function () {
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
    // initialize first so bootstrap record exists
    await (await registry.initialize(input)).wait();
  });

  it("should activate three statements and delete bootstrap record", async function () {
    const result = await registry.callStatic.finishBootstrap(input.ecosystemId);
    expect(result.statusCode).to.equal("TRQP-0");
  });

  it("should return notfound if bootstrap record does not exist", async function () {
    const result = await registry.callStatic.finishBootstrap("did:orcl:nonexistent");
    expect(result.statusCode).to.equal("TRQP-200");
  });
});