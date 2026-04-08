// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// represents a proof attached to an authority statement
struct DataIntegrityProof {
    string proofType;
    string cryptosuite;
    string verificationMethod;
    string proofPurpose;
    uint256 created;
    string domain;
    string challenge;
    string proofValue;
}

// represents a single lifecycle event on a authority statement
struct ContextEntry {
    string message;
    uint256 updated;
    AuthStmtStatus status;
    DataIntegrityProof proof;
}

// holds ecosystem and trust registry into with a history of lifecycle events
struct AuthorityContext {
    string ecosystemId;
    string trustRegistryId;
    ContextEntry[] entries;
}

// main data structure representing an authority statement
struct AuthorityStatement {
    string id;
    string authorityId;
    string entityId;
    ActionType action;
    string[] resources;
    uint256 created;
    uint256 updated;
    uint256 expires;
    AuthStmtStatus status;
    DataIntegrityProof proof;
    AuthorityContext context;
}

// the different type of authority a statement can grant
enum ActionType {
    Authorization,
    Delegation,
    Issuance,
    Ecosystem,
    EcosystemGovernanceAuthority,
    TrustRegistry
}

// the possible states of an authority statement during its lifecycle
enum AuthStmtStatus {
    Started,
    Active,
    Revoked
}

// narrowed status enumeration used by the migration tests
enum StatementStatus {
    Active,
    Revoked
}

// input data required to initialize (bootstrap) the registry
struct BootstrapInput {
    string bootstrapId;
    string ecosystemId;
    string ecosystemStatementId;
    string egaId;
    string egaStatementId;
    string trustRegistryId;
    string trustRegistryStatementId;
}

// stores the bootstrap context so finishBoostrap() can complete the process
struct BootstrapRecord {
    string bootstrapDid;
    string ecosystemDid;
    string egaDid;
    string trustRegistryDid;
    string ecosystemStatementId;
    string egaStatementId;
    string trustRegistryStatementId;
    bool exists;
}