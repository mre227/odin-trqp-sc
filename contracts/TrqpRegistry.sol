// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorityStatement.sol";
import "./TrqpResponse.sol";

contract TrqpRegistry {

    mapping(string => AuthorityStatement) private statements; // primary storage
    mapping(string => BootstrapRecord) private bootstrapRecords; // bootstrap record storage
    bool private initialized; // initialized or not

    // sets up three initial governane statements 
    function initialize(BootstrapInput calldata input) external returns (TRQPResponse memory) {
        SigningRequestEntry memory emptySR;
        DidAuthChallenge memory emptyDidAuth;
        emptyDidAuth.signingRequest = emptySR;

        // prevent re-initialization
        if (initialized) {
            return TRQPResponse({
                statusCode: TRQP_300,
                status: "invalidrequest",
                description: "already initialized",
                statements: new AuthorityStatement[](0),
                operationResult: "",
                didAuth: emptyDidAuth,
                signingRequest: ""
            });
        }

        // create the ecosystem statement with status Started
        AuthorityStatement storage ecoStmt = statements[input.ecosystemStatementId];
        ecoStmt.id = input.ecosystemStatementId;
        ecoStmt.authorityId = input.bootstrapId;
        ecoStmt.entityId = input.ecosystemId;
        ecoStmt.action = ActionType.Ecosystem;
        ecoStmt.created = block.timestamp;
        ecoStmt.updated = block.timestamp;
        ecoStmt.expires = 0;
        ecoStmt.status = AuthStmtStatus.Started;
        ecoStmt.context.ecosystemId = input.ecosystemId;
        ecoStmt.context.trustRegistryId = input.trustRegistryId;

        // create ega statement with status Started
        AuthorityStatement storage egaStmt = statements[input.egaStatementId];
        egaStmt.id = input.egaStatementId;
        egaStmt.authorityId = input.bootstrapId;
        egaStmt.entityId = input.egaId;
        egaStmt.action = ActionType.EcosystemGovernanceAuthority;
        egaStmt.created = block.timestamp;
        egaStmt.updated = block.timestamp;
        egaStmt.expires = 0;
        egaStmt.status = AuthStmtStatus.Started;
        egaStmt.context.ecosystemId = input.ecosystemId;
        egaStmt.context.trustRegistryId = input.trustRegistryId;

        // create trust registry statement with status Started
        AuthorityStatement storage trStmt = statements[input.trustRegistryStatementId];
        trStmt.id = input.trustRegistryStatementId;
        trStmt.authorityId = input.bootstrapId;
        trStmt.entityId = input.trustRegistryId;
        trStmt.action = ActionType.TrustRegistry;
        trStmt.created = block.timestamp;
        trStmt.updated = block.timestamp;
        trStmt.expires = 0;
        trStmt.status = AuthStmtStatus.Started;
        trStmt.context.ecosystemId = input.ecosystemId;
        trStmt.context.trustRegistryId = input.trustRegistryId;

        // save the bootstrap record for finishBootstrap()
        string memory bootKey = string(abi.encodePacked("bootstrap|", input.ecosystemId));
        bootstrapRecords[bootKey] = BootstrapRecord({
            bootstrapDid: input.bootstrapId,
            ecosystemDid: input.ecosystemId,
            egaDid: input.egaId,
            trustRegistryDid: input.trustRegistryId,
            ecosystemStatementId: input.ecosystemStatementId,
            egaStatementId: input.egaStatementId,
            trustRegistryStatementId: input.trustRegistryStatementId,
            exists: true
        });

        initialized = true;
        emptyDidAuth.signingRequest = emptySR;

        return TRQPResponse({
            statusCode: TRQP_0,
            status: "started",
            description: "bootstrap initialized",
            statements: new AuthorityStatement[](0),
            operationResult: "",
            didAuth: emptyDidAuth,
            signingRequest: ""
        });
    }

    function finishBootstrap() external returns (TRQPResponse memory) {}

    function migrateEcosystem() external returns (TRQPResponse memory) {}

    function migrateEga() external returns (TRQPResponse memory) {}

    function migrateTrustRegistry() external returns (TRQPResponse memory) {}

    function createStatement() external returns (TRQPResponse memory) {}

    function signStatement() external returns (TRQPResponse memory) {}

    function getSigningMaterial() external returns (TRQPResponse memory) {}

    function updateStatement() external returns (TRQPResponse memory) {}

    function getStatement() external returns (TRQPResponse memory) {}

    function searchStatement() external returns (TRQPResponse memory) {}

    function evaluateStatement() external returns (TRQPResponse memory) {}
}