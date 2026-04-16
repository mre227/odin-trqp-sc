const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("evaluateStatement", function () {
  let registry: any;

  const bootstrapInput = {
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
    await (await registry.initialize(bootstrapInput)).wait();
    await (await registry.finishBootstrap(bootstrapInput.ecosystemId)).wait();
  });

  // invalidrequest cases
    it("returns TRQP-300 when entityDid is empty", async function () {
    const result = await registry.callStatic.evaluateStatement(
        "Authorization", "did:orcl:test-setup", "", ["did:schema:1"]
    );
    expect(result.statusCode).to.equal("TRQP-300");
    expect(result.status).to.equal("invalidrequest");
    });

  it("returns TRQP-300 when action is invalid", async function () {
    const result = await registry.callStatic.evaluateStatement(
      "InvalidAction", "did:orcl:test-setup", "did:orcl:eco-1", ["did:schema:1"]
    );
    expect(result.statusCode).to.equal("TRQP-300");
    expect(result.status).to.equal("invalidrequest");
  });

  it("returns TRQP-300 when resources are empty for schema-scoped action", async function () {
    const result = await registry.callStatic.evaluateStatement(
      "Authorization", "did:orcl:test-setup", "did:orcl:eco-1", []
    );
    expect(result.statusCode).to.equal("TRQP-300");
    expect(result.status).to.equal("invalidrequest");
  });

  // notfound 
  it("returns TRQP-200 when no matching statements found", async function () {
    const result = await registry.callStatic.evaluateStatement(
      "Authorization", "did:orcl:test-setup", "did:orcl:nonexistent", ["did:schema:1"]
    );
    expect(result.statusCode).to.equal("TRQP-200");
    expect(result.status).to.equal("notfound");
  });

  // governance action
  it("returns EC-1 for active Ecosystem statement", async function () {
    const result = await registry.callStatic.evaluateStatement(
      "Ecosystem", "", "did:orcl:eco-1", []
    );
    expect(result.statusCode).to.equal("EC-1");
    expect(result.status).to.equal("ecosystem");
  });

  it("returns EGA-1 for active EGA statement", async function () {
    const result = await registry.callStatic.evaluateStatement(
      "EcosystemGovernanceAuthority", "", "did:orcl:ega-1", []
    );
    expect(result.statusCode).to.equal("EGA-1");
    expect(result.status).to.equal("ega");
  });

  it("returns TR-1 for active TrustRegistry statement", async function () {
    const result = await registry.callStatic.evaluateStatement(
      "TrustRegistry", "", "did:orcl:tr-1", []
    );
    expect(result.statusCode).to.equal("TR-1");
    expect(result.status).to.equal("trustregistry");
  });

  // expiration
  it("returns TRQP-200 for expired statement", async function () {
    const result = await registry.callStatic.evaluateStatement(
      "Authorization", "did:orcl:test-setup", "did:orcl:expired-entity", ["did:schema:1"]
    );
    expect(result.statusCode).to.equal("TRQP-200");
  });
});