// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct AuthorityContext {
    string ecosystemId;
    string trustRegistryId;
    ContextEntry[] entries;
}

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
    AuthorityContext context;
}

enum ActionType {
    Authorization,
    Delegation,
    Issue,
    Ecosystem,
    EcosystemGovernanceAuthority,
    TrustRegistry
}

enum AuthStmtStatus {
    Started,
    Active,
    Revoked
}

struct ContextEntry {
    string message;
    uint256 updated;
    AuthStmtStatus status;
}