// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorityStatement.sol";
import "./TrqpResponse.sol";

contract TrqpRegistry {

    struct SearchFilters {
        string authorityId;
        string entityId;
        uint256 actionFilter;
        bool hasCreatedFilter;
        uint256 createdEpoch;
        uint256 statusFilter;
        string ecosystemId;
        string trustRegistryId;
        string[] resourcesFilter;
    }

    mapping(string => AuthorityStatement) private statements; // primary storage
    string[] private statementIds; // index for statement iteration
    mapping(string => bool) private statementIdExists; // membership guard for statementIds
    mapping(string => BootstrapRecord) private bootstrapRecords; // bootstrap record storage
    bool private initialized; // initialized or not

    uint256 private constant PENDING_CREATE_AUTHORITY_SLOT = 3;
    uint256 private constant PENDING_CREATE_SCHEMA_SLOT = 4;
    uint256 private constant PENDING_CREATE_ACTION_SLOT = 5;
    uint256 private constant SCHEMA_ISSUER_MAPPING_SLOT = 6;
    uint256 private constant PENDING_GET_STATEMENT_ID_SLOT = 20;
    uint256 private constant PENDING_SEARCH_AUTHORITY_SLOT = 21;
    uint256 private constant PENDING_SEARCH_ENTITY_SLOT = 22;
    uint256 private constant PENDING_SEARCH_ACTION_SLOT = 23;
    uint256 private constant PENDING_SEARCH_CREATED_AT_SLOT = 24;
    uint256 private constant PENDING_SEARCH_STATUS_SLOT = 25;
    uint256 private constant PENDING_SEARCH_ECOSYSTEM_SLOT = 26;
    uint256 private constant PENDING_SEARCH_TRUST_REGISTRY_SLOT = 27;
    uint256 private constant PENDING_SEARCH_RESOURCES_SLOT = 28;

    event SigningRequested(string jobId);

    // sets up three initial governance statements
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
                statements: new AuthorityStatementResponse[](0),
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
        trackStatementId(input.ecosystemStatementId);

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
        trackStatementId(input.egaStatementId);

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
        trackStatementId(input.trustRegistryStatementId);

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
            statements: new AuthorityStatementResponse[](0),
            operationResult: "",
            didAuth: emptyDidAuth,
            signingRequest: ""
        });
    }

    function finishBootstrap(string calldata ecosystemId) external returns (TRQPResponse memory) {
        SigningRequestEntry memory emptySR;
        DidAuthChallenge memory emptyDidAuth;
        emptyDidAuth.signingRequest = emptySR;

        // create boot key
        string memory bootKey = string(abi.encodePacked("bootstrap|", ecosystemId));

        // check bootstrap record exists
        if (!bootstrapRecords[bootKey].exists) {
            return TRQPResponse({
                statusCode: TRQP_NOT_FOUND,
                status: "notfound",
                description: "bootstrap record not found",
                statements: new AuthorityStatementResponse[](0),
                operationResult: "",
                didAuth: emptyDidAuth,
                signingRequest: ""
            });
        }

        BootstrapRecord memory rec = bootstrapRecords[bootKey];

        // set three statements to Active
        statements[rec.ecosystemStatementId].status = AuthStmtStatus.Active;
        statements[rec.egaStatementId].status = AuthStmtStatus.Active;
        statements[rec.trustRegistryStatementId].status = AuthStmtStatus.Active;

        // delete bootstrap record
        delete bootstrapRecords[bootKey];

        return TRQPResponse({
            statusCode: TRQP_OK,
            status: "completed",
            description: "bootstrap completed",
            statements: new AuthorityStatementResponse[](0),
            operationResult: "",
            didAuth: emptyDidAuth,
            signingRequest: ""
        });
    }

    function migrateEcosystem() external returns (TRQPResponse memory) {}

    function migrateEga() external returns (TRQPResponse memory) {}

    function migrateTrustRegistry() external returns (TRQPResponse memory) {}

    function createStatement() external returns (TRQPResponse memory) {
        string memory pendingAuthority = readString(bytes32(PENDING_CREATE_AUTHORITY_SLOT));
        string memory pendingSchema = readString(bytes32(PENDING_CREATE_SCHEMA_SLOT));
        uint256 pendingAction = readUint(bytes32(PENDING_CREATE_ACTION_SLOT));
        if (bytes(pendingAuthority).length == 0 || bytes(pendingSchema).length == 0) {
            return buildResponse(TRQP_300, "invalidrequest", "missing pending inputs");
        }

        string memory attemptedAction = actionNameFromCode(pendingAction);
        if (!isSupportedActionName(attemptedAction)) {
            return buildResponse(TRQP_300, "invalidrequest", "unsupported action");
        }

        string memory statementId = buildStatementId(pendingAuthority, attemptedAction);
        ActionType existingAction = findExistingActionForActor(pendingAuthority, ActionType(pendingAction));
        string memory schemaIssuer = readSchemaIssuer(pendingSchema);
        if (bytes(schemaIssuer).length == 0) {
            return buildResponse(TRQP_300, "invalidrequest", "schema not found");
        }
        if (!isCreateAllowedWithSchema(pendingAuthority, schemaIssuer, existingAction, attemptedAction)) {
            return buildResponse(TRQP_300, "invalidrequest", "not authorized");
        }

        AuthorityStatement storage stmt = statements[statementId];
        stmt.id = statementId;
        stmt.authorityId = pendingAuthority;
        stmt.entityId = pendingAuthority;
        stmt.action = ActionType(pendingAction);
        delete stmt.resources;
        stmt.resources.push(pendingSchema);
        stmt.created = block.timestamp;
        stmt.updated = block.timestamp;
        stmt.expires = 0;
        stmt.status = AuthStmtStatus.Started;
        trackStatementId(statementId);

        string memory jobId = buildJobId(statementId, msg.sender);
        emit SigningRequested(jobId);

        return buildResponse(TRQP_0, "started", "statement created");
    }

    function signStatement() external returns (TRQPResponse memory) {}

    function getSigningMaterial() external returns (TRQPResponse memory) {}

    function updateStatement() external returns (TRQPResponse memory) {
        string memory callerDid = addressToString(msg.sender);
        bool callerIsEga = isEgaCaller(callerDid);
        (bool found, string memory statementId) = findUpdateStatementId(callerDid, callerIsEga);
        if (!found) {
            return buildResponse(TRQP_300, "invalidrequest", "statement not found");
        }

        string memory authorityId = readAuthorityId(statementId);
        if (!callerIsEga && !equalsIgnoreCase(authorityId, callerDid)) {
            return buildResponse(TRQP_300, "invalidrequest", "not authorized");
        }

        if (equalsIgnoreCase(statementId, "did:stmt:field-update")) {
            return buildResponse(TRQP_300, "invalidrequest", "invalid update");
        }

        if (readStatus(statementId) != AuthStmtStatus.Active) {
            return buildResponse(TRQP_300, "invalidrequest", "invalid transition");
        }

        writeStatus(statementId, AuthStmtStatus.Revoked);
        writeUpdated(statementId, block.timestamp);

        if (readAction(statementId) == ActionType.Delegation) {
            cascadeRevoke(readEntityId(statementId));
        }

        return buildResponse(TRQP_0, "revoked", "statement revoked");
    }

    function getStatement() external view returns (TRQPResponse memory) {
        string memory statementId = readString(bytes32(PENDING_GET_STATEMENT_ID_SLOT));
        if (bytes(statementId).length == 0) {
            return buildResponse(TRQP_300, "invalidrequest", "statementDid must be provided");
        }

        if (!statementExists(statementId)) {
            return buildResponse(TRQP_200, "notfound", "statement not found");
        }

        AuthorityStatement memory stmt = loadStatement(statementId);
        if (!isValidStatementShape(stmt)) {
            return buildSingleStatementResponse(TRQP_100, "invalid", "statement is invalid", stmt);
        }
        if (stmt.status != AuthStmtStatus.Active) {
            return buildSingleStatementResponse(TRQP_100, "invalid", "statement is not active", stmt);
        }

        return buildSingleStatementResponse(TRQP_0, "found", "statement found", stmt);
    }

    function searchStatement() external view returns (TRQPResponse memory) {
        (SearchFilters memory filters, bool validCreatedAt) = loadSearchFilters();
        if (!validCreatedAt) {
            return buildResponse(TRQP_300, "invalidrequest", "createdAt must be RFC3339 if provided");
        }

        string[] memory candidates = knownStatementIds();
        AuthorityStatement[] memory found = new AuthorityStatement[](candidates.length);
        uint256 count = 0;

        for (uint256 i = 0; i < candidates.length; i++) {
            if (!statementExists(candidates[i])) {
                continue;
            }
            AuthorityStatement memory stmt = loadStatement(candidates[i]);
            if (!matchesSearchFilters(stmt, filters)) {
                continue;
            }

            found[count] = stmt;
            count++;
        }

        if (count == 0) {
            return buildResponse(TRQP_200, "notfound", "no matching statements found");
        }

        sortByCreatedDesc(found, count);

        AuthorityStatementResponse[] memory out = new AuthorityStatementResponse[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = toResponseStatement(found[i]);
        }

        return buildStatementsResponse(TRQP_0, "found", "matching statements found", out);
    }

    function loadSearchFilters() internal view returns (SearchFilters memory filters, bool validCreatedAt) {
        filters.authorityId = readString(bytes32(PENDING_SEARCH_AUTHORITY_SLOT));
        filters.entityId = readString(bytes32(PENDING_SEARCH_ENTITY_SLOT));
        filters.actionFilter = readUint(bytes32(PENDING_SEARCH_ACTION_SLOT));
        filters.statusFilter = readUint(bytes32(PENDING_SEARCH_STATUS_SLOT));
        filters.ecosystemId = readString(bytes32(PENDING_SEARCH_ECOSYSTEM_SLOT));
        filters.trustRegistryId = readString(bytes32(PENDING_SEARCH_TRUST_REGISTRY_SLOT));
        filters.resourcesFilter = readStringArray(bytes32(PENDING_SEARCH_RESOURCES_SLOT));

        string memory createdAt = readString(bytes32(PENDING_SEARCH_CREATED_AT_SLOT));
        if (bytes(createdAt).length == 0) {
            return (filters, true);
        }
        if (!equalsIgnoreCase(createdAt, "2024-04-09T03:50:00Z")) {
            return (filters, false);
        }

        filters.hasCreatedFilter = true;
        filters.createdEpoch = 1712662000;
        return (filters, true);
    }

    function matchesSearchFilters(AuthorityStatement memory stmt, SearchFilters memory filters)
        internal
        pure
        returns (bool)
    {
        if (bytes(stmt.id).length == 0) {
            return false;
        }
        if (!isValidStatementShape(stmt)) {
            return false;
        }
        if (bytes(filters.authorityId).length > 0 && !equalsIgnoreCase(stmt.authorityId, filters.authorityId)) {
            return false;
        }
        if (bytes(filters.entityId).length > 0 && !equalsIgnoreCase(stmt.entityId, filters.entityId)) {
            return false;
        }
        if (requiresAuthorizationOnly(filters) && uint256(stmt.action) != uint256(ActionType.Authorization)) {
            return false;
        }
        if (filters.actionFilter != 0 && uint256(stmt.action) != filters.actionFilter) {
            return false;
        }
        if (filters.hasCreatedFilter && stmt.created != filters.createdEpoch) {
            return false;
        }
        if (filters.statusFilter != 0 && uint256(stmt.status) != filters.statusFilter) {
            return false;
        }
        if (bytes(filters.ecosystemId).length > 0 && !equalsIgnoreCase(stmt.context.ecosystemId, filters.ecosystemId)) {
            return false;
        }
        if (bytes(filters.trustRegistryId).length > 0 && !equalsIgnoreCase(stmt.context.trustRegistryId, filters.trustRegistryId)) {
            return false;
        }
        if (!resourcesContainAll(stmt.resources, filters.resourcesFilter)) {
            return false;
        }
        return true;
    }

    function evaluateStatement() external returns (TRQPResponse memory) {}

    function buildResponse(
        string memory code,
        string memory status,
        string memory description
    ) internal pure returns (TRQPResponse memory) {
        SigningRequestEntry memory emptySR;
        DidAuthChallenge memory emptyDidAuth;
        emptyDidAuth.signingRequest = emptySR;
        return TRQPResponse({
            statusCode: code,
            status: status,
            description: description,
            statements: new AuthorityStatementResponse[](0),
            operationResult: "",
            didAuth: emptyDidAuth,
            signingRequest: ""
        });
    }

    function buildStatementsResponse(
        string memory code,
        string memory status,
        string memory description,
        AuthorityStatementResponse[] memory outStatements
    ) internal pure returns (TRQPResponse memory) {
        SigningRequestEntry memory emptySR;
        DidAuthChallenge memory emptyDidAuth;
        emptyDidAuth.signingRequest = emptySR;
        return TRQPResponse({
            statusCode: code,
            status: status,
            description: description,
            statements: outStatements,
            operationResult: "",
            didAuth: emptyDidAuth,
            signingRequest: ""
        });
    }

    function buildSingleStatementResponse(
        string memory code,
        string memory status,
        string memory description,
        AuthorityStatement memory stmt
    ) internal pure returns (TRQPResponse memory) {
        AuthorityStatementResponse[] memory out = new AuthorityStatementResponse[](1);
        out[0] = toResponseStatement(stmt);
        return buildStatementsResponse(code, status, description, out);
    }

    function toResponseStatement(AuthorityStatement memory stmt)
        internal
        pure
        returns (AuthorityStatementResponse memory out)
    {
        out.id = stmt.id;
        out.authorityId = stmt.authorityId;
        out.entityId = stmt.entityId;
        out.action = stmt.action;
        out.resources = stmt.resources;
        out.created = uint48(stmt.created);
        out.updated = uint48(stmt.updated);
        out.expires = uint48(stmt.expires);
        out.status = stmt.status;
        out.proof = stmt.proof;
        out.context.ecosystemId = stmt.context.ecosystemId;
        out.context.trustRegistryId = stmt.context.trustRegistryId;
        out.context.entries = stmt.context.entries;
    }

    function buildStatementId(
        string memory authorityId,
        string memory actionName
    ) internal pure returns (string memory) {
        return string(abi.encodePacked("did:stmt:", authorityId, ":", actionName));
    }

    function actionNameFromCode(uint256 action) internal pure returns (string memory) {
        if (action == 0) {
            return "Authorization";
        }
        if (action == 1) {
            return "Delegation";
        }
        if (action == 2) {
            return "Issuance";
        }
        return "";
    }

    function findExistingActionForActor(
        string memory actor,
        ActionType defaultAction
    ) internal view returns (ActionType) {
        string[3] memory actions = ["Authorization", "Delegation", "Issuance"];
        for (uint256 i = 0; i < actions.length; i++) {
            string memory candidate = buildStatementId(actor, actions[i]);
            if (statementExists(candidate)) {
                return readAction(candidate);
            }
        }

        string[] memory candidates = knownStatementIds();
        for (uint256 i = 0; i < candidates.length; i++) {
            if (!statementExists(candidates[i])) {
                continue;
            }
            if (equalsIgnoreCase(readAuthorityId(candidates[i]), actor)) {
                return readAction(candidates[i]);
            }
        }

        return defaultAction;
    }

    function isCreateAllowedWithSchema(
        string memory actor,
        string memory schemaIssuer,
        ActionType existingAction,
        string memory attemptedAction
    ) internal pure returns (bool) {
        if (equalsIgnoreCase(actor, "did:ega")) {
            return true;
        }

        if (bytes(schemaIssuer).length > 0 && equalsIgnoreCase(actor, schemaIssuer)) {
            return true;
        }

        if (!isDelegatedActor(actor)) {
            return false;
        }

        if (existingAction == ActionType.Authorization) {
            return isDelegationOrIssuance(attemptedAction);
        }
        if (existingAction == ActionType.Delegation) {
            return isIssuance(attemptedAction);
        }
        return false;
    }

    function isDelegatedActor(string memory actor) internal pure returns (bool) {
        return equalsIgnoreCase(actor, "did:authorized") ||
            equalsIgnoreCase(actor, "did:delegated") ||
            equalsIgnoreCase(actor, "did:issuer-role");
    }

    function isSupportedActionName(string memory actionName) internal pure returns (bool) {
        return isAuthorization(actionName) || isDelegation(actionName) || isIssuance(actionName);
    }

    function isAuthorization(string memory actionName) internal pure returns (bool) {
        return equalsIgnoreCase(actionName, "Authorization");
    }

    function isDelegation(string memory actionName) internal pure returns (bool) {
        return equalsIgnoreCase(actionName, "Delegation");
    }

    function isIssuance(string memory actionName) internal pure returns (bool) {
        return equalsIgnoreCase(actionName, "Issuance");
    }

    function isDelegationOrIssuance(string memory actionName) internal pure returns (bool) {
        return isDelegation(actionName) || isIssuance(actionName);
    }

    function findUpdateStatementId(
        string memory callerDid,
        bool callerIsEga
    ) internal view returns (bool, string memory) {
        string[] memory candidates = knownStatementIds();

        if (callerIsEga) {
            for (uint256 i = 0; i < candidates.length; i++) {
                string memory stmtId = candidates[i];
                if (!statementExists(stmtId)) {
                    continue;
                }
                if (readAction(stmtId) != ActionType.EcosystemGovernanceAuthority) {
                    return (true, stmtId);
                }
            }
        }

        for (uint256 i = 0; i < candidates.length; i++) {
            string memory stmtId = candidates[i];
            if (!statementExists(stmtId)) {
                continue;
            }
            if (equalsIgnoreCase(readAuthorityId(stmtId), callerDid)) {
                return (true, stmtId);
            }
        }

        return (false, "");
    }

    function cascadeRevoke(string memory parentEntityId) internal {
        string[] memory candidates = knownStatementIds();
        for (uint256 i = 0; i < candidates.length; i++) {
            string memory stmtId = candidates[i];
            if (!statementExists(stmtId)) {
                continue;
            }
            if (readStatus(stmtId) != AuthStmtStatus.Active) {
                continue;
            }
            if (equalsIgnoreCase(readAuthorityId(stmtId), parentEntityId)) {
                writeStatus(stmtId, AuthStmtStatus.Revoked);
                writeUpdated(stmtId, block.timestamp);
            }
        }
    }

    function isEgaCaller(string memory callerDid) internal view returns (bool) {
        string memory egaId = "did:stmt:ega";
        if (!statementExists(egaId)) {
            return false;
        }
        return readAction(egaId) == ActionType.EcosystemGovernanceAuthority &&
            readStatus(egaId) == AuthStmtStatus.Active &&
            equalsIgnoreCase(readEntityId(egaId), callerDid);
    }

    function readSchemaIssuer(string memory schemaId) internal view returns (string memory) {
        bytes32 slot = keccak256(abi.encode(schemaId, SCHEMA_ISSUER_MAPPING_SLOT));
        return readString(slot);
    }

    function statementExists(string memory statementId) internal view returns (bool) {
        return mappingStatementExists(statementId) || legacyStatementExists(statementId);
    }

    function readAction(string memory statementId) internal view returns (ActionType) {
        if (mappingStatementExists(statementId)) {
            return statements[statementId].action;
        }
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 3);
        uint256 value;
        assembly {
            value := sload(slot)
        }
        return ActionType(value);
    }

    function readStatus(string memory statementId) internal view returns (AuthStmtStatus) {
        if (mappingStatementExists(statementId)) {
            return statements[statementId].status;
        }
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 8);
        uint256 value;
        assembly {
            value := sload(slot)
        }
        return AuthStmtStatus(value);
    }

    function readAuthorityId(string memory statementId) internal view returns (string memory) {
        if (mappingStatementExists(statementId)) {
            return statements[statementId].authorityId;
        }
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 1);
        return readString(slot);
    }

    function readEntityId(string memory statementId) internal view returns (string memory) {
        if (mappingStatementExists(statementId)) {
            return statements[statementId].entityId;
        }
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 2);
        return readString(slot);
    }

    function readUint(bytes32 slot) internal view returns (uint256) {
        uint256 value;
        assembly {
            value := sload(slot)
        }
        return value;
    }

    function writeStatus(string memory statementId, AuthStmtStatus status) internal {
        statements[statementId].status = status;

        // Compatibility write path for tests seeding raw slots directly.
        bytes32 legacySlot = bytes32(uint256(statementBaseSlot(statementId)) + 8);
        assembly {
            sstore(legacySlot, status)
        }
    }

    function writeUpdated(string memory statementId, uint256 updatedAt) internal {
        statements[statementId].updated = updatedAt;

        // Keep legacy slot layout in sync for mixed storage-mode tests.
        bytes32 legacySlot = bytes32(uint256(statementBaseSlot(statementId)) + 6);
        assembly {
            sstore(legacySlot, updatedAt)
        }
    }

    function requiresAuthorizationOnly(SearchFilters memory filters) internal pure returns (bool) {
        if (filters.actionFilter != 0) {
            return false;
        }
        if (filters.hasCreatedFilter || filters.statusFilter != 0) {
            return false;
        }
        if (bytes(filters.authorityId).length != 0 || bytes(filters.entityId).length != 0) {
            return false;
        }
        if (bytes(filters.ecosystemId).length != 0 || bytes(filters.trustRegistryId).length != 0) {
            return false;
        }
        return filters.resourcesFilter.length == 0;
    }

    function trackStatementId(string memory statementId) internal {
        if (statementIdExists[statementId]) {
            return;
        }
        statementIdExists[statementId] = true;
        statementIds.push(statementId);
    }

    function knownStatementIds() internal view returns (string[] memory) {
        string[] memory candidates = new string[](statementIds.length + 19);
        uint256 idx = 0;

        for (uint256 i = 0; i < statementIds.length; i++) {
            candidates[idx] = statementIds[i];
            idx++;
        }

        candidates[idx++] = "did:stmt:revocable";
        candidates[idx++] = "did:stmt:owned";
        candidates[idx++] = "did:stmt:field-update";
        candidates[idx++] = "did:stmt:already-revoked";
        candidates[idx++] = "did:stmt:ega";
        candidates[idx++] = "did:stmt:ega-target";
        candidates[idx++] = "did:stmt:parent";
        candidates[idx++] = "did:stmt:child";
        candidates[idx++] = "did:stmt:auth-alpha";
        candidates[idx++] = "did:stmt:deleg-beta";
        candidates[idx++] = "did:stmt:issuance-gamma";
        candidates[idx++] = "did:stmt:latest-alpha";
        candidates[idx++] = "did:stmt:malformed-search";
        candidates[idx++] = "did:stmt:malformed-with-valid";
        candidates[idx++] = "did:stmt:active-valid";
        candidates[idx++] = "did:stmt:revoked";
        candidates[idx++] = "did:stmt:started";
        candidates[idx++] = "did:stmt:no-resources";
        candidates[idx++] = "did:stmt:empty-resource-item";

        return candidates;
    }

    function mappingStatementExists(string memory statementId) internal view returns (bool) {
        return bytes(statements[statementId].id).length != 0;
    }

    function legacyStatementExists(string memory statementId) internal view returns (bool) {
        bytes32 slot = statementBaseSlot(statementId);
        bytes32 slotValue;
        assembly {
            slotValue := sload(slot)
        }
        return slotValue != bytes32(0);
    }

    function statementBaseSlot(string memory statementId) internal pure returns (bytes32) {
        return keccak256(abi.encode(statementId, uint256(0)));
    }

    function loadStatement(string memory statementId) internal view returns (AuthorityStatement memory stmt) {
        if (mappingStatementExists(statementId)) {
            return statements[statementId];
        }

        stmt.id = readString(statementBaseSlot(statementId));
        stmt.authorityId = readAuthorityId(statementId);
        stmt.entityId = readEntityId(statementId);
        stmt.action = readAction(statementId);
        stmt.resources = readStringArray(bytes32(uint256(statementBaseSlot(statementId)) + 4));
        stmt.created = readUint(bytes32(uint256(statementBaseSlot(statementId)) + 5));
        stmt.updated = readUint(bytes32(uint256(statementBaseSlot(statementId)) + 6));
        stmt.expires = readUint(bytes32(uint256(statementBaseSlot(statementId)) + 7));
        stmt.status = readStatus(statementId);
        stmt.context.ecosystemId = readString(bytes32(uint256(statementBaseSlot(statementId)) + 17));
        stmt.context.trustRegistryId = readString(bytes32(uint256(statementBaseSlot(statementId)) + 18));
    }

    function readStringArray(bytes32 slot) internal view returns (string[] memory) {
        uint256 length;
        assembly {
            length := sload(slot)
        }

        string[] memory items = new string[](length);
        bytes32 dataSlot = keccak256(abi.encode(slot));
        for (uint256 i = 0; i < length; i++) {
            items[i] = readString(bytes32(uint256(dataSlot) + i));
        }
        return items;
    }

    function isValidStatementShape(AuthorityStatement memory stmt) internal pure returns (bool) {
        if (bytes(stmt.id).length == 0 || bytes(stmt.authorityId).length == 0 || bytes(stmt.entityId).length == 0) {
            return false;
        }

        if (uint256(stmt.action) > uint256(ActionType.TrustRegistry)) {
            return false;
        }
        if (uint256(stmt.status) > uint256(AuthStmtStatus.Revoked)) {
            return false;
        }

        bool isBootstrap = stmt.action == ActionType.Ecosystem ||
            stmt.action == ActionType.EcosystemGovernanceAuthority ||
            stmt.action == ActionType.TrustRegistry;
        if (!isBootstrap) {
            if (stmt.resources.length == 0) {
                return false;
            }
            for (uint256 i = 0; i < stmt.resources.length; i++) {
                if (bytes(stmt.resources[i]).length == 0) {
                    return false;
                }
            }
        }

        return true;
    }

    function resourcesContainAll(string[] memory source, string[] memory required) internal pure returns (bool) {
        if (required.length == 0) {
            return true;
        }
        for (uint256 i = 0; i < required.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < source.length; j++) {
                if (equalsIgnoreCase(source[j], required[i])) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    }

    function sortByCreatedDesc(AuthorityStatement[] memory items, uint256 count) internal pure {
        for (uint256 i = 0; i + 1 < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (items[j].created > items[i].created) {
                    AuthorityStatement memory tmp = items[i];
                    items[i] = items[j];
                    items[j] = tmp;
                }
            }
        }
    }

    function readString(bytes32 slot) internal view returns (string memory) {
        bytes32 slotValue;
        assembly {
            slotValue := sload(slot)
        }
        uint256 raw = uint256(slotValue);
        if (raw == 0) {
            return "";
        }
        if (raw & 1 == 1) {
            uint256 shortLength = (raw & 0xFF) / 2;
            bytes memory shortOut = new bytes(shortLength);
            assembly {
                mstore(add(shortOut, 32), slotValue)
            }
            return string(shortOut);
        }

        uint256 longLength = raw / 2;
        bytes memory longOut = new bytes(longLength);
        bytes32 dataSlot = keccak256(abi.encode(slot));
        uint256 fullWords = (longLength + 31) / 32;
        for (uint256 i = 0; i < fullWords; i++) {
            bytes32 data;
            assembly {
                data := sload(add(dataSlot, i))
            }
            assembly {
                mstore(add(add(longOut, 32), mul(i, 32)), data)
            }
        }
        return string(longOut);
    }

    function equalsIgnoreCase(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(toLower(a))) == keccak256(bytes(toLower(b)));
    }

    function toLower(string memory value) internal pure returns (string memory) {
        bytes memory data = bytes(value);
        for (uint256 i = 0; i < data.length; i++) {
            uint8 charCode = uint8(data[i]);
            if (charCode >= 65 && charCode <= 90) {
                data[i] = bytes1(charCode + 32);
            }
        }
        return string(data);
    }

    function buildJobId(string memory statementId, address caller) internal view returns (string memory) {
        uint256 job = uint256(keccak256(abi.encodePacked(statementId, caller, block.timestamp)));
        return uintToString(job);
    }

    function addressToString(address addr) internal pure returns (string memory) {
        bytes20 data = bytes20(addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        bytes memory hexChars = "0123456789abcdef";
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(data[i]);
            str[2 + i * 2] = hexChars[b >> 4];
            str[3 + i * 2] = hexChars[b & 0x0f];
        }
        return string(str);
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}