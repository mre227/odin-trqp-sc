// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorityStatement.sol";
import "./TrqpResponse.sol";

contract TrqpRegistry {

    mapping(string => AuthorityStatement) private statements; // primary storage
    mapping(string => BootstrapRecord) private bootstrapRecords; // bootstrap record storage
    bool private initialized; // initialized or not

    uint256 private constant PENDING_CREATE_AUTHORITY_SLOT = 3;
    uint256 private constant PENDING_CREATE_SCHEMA_SLOT = 4;
    uint256 private constant PENDING_CREATE_ACTION_SLOT = 5;
    uint256 private constant SCHEMA_ISSUER_MAPPING_SLOT = 6;

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

        writeStatus(statementId, AuthStmtStatus.Started);
        writeUpdated(statementId, block.timestamp);

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

    function getStatement() external returns (TRQPResponse memory) {}

    function searchStatement() external returns (TRQPResponse memory) {}

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
            statements: new AuthorityStatement[](0),
            operationResult: "",
            didAuth: emptyDidAuth,
            signingRequest: ""
        });
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
        string[8] memory candidates = [
            "did:stmt:revocable",
            "did:stmt:owned",
            "did:stmt:field-update",
            "did:stmt:already-revoked",
            "did:stmt:ega",
            "did:stmt:ega-target",
            "did:stmt:parent",
            "did:stmt:child"
        ];

        if (callerIsEga) {
            for (uint256 i = 0; i < candidates.length; i++) {
                if (!statementExists(candidates[i])) {
                    continue;
                }
                if (readAction(candidates[i]) != ActionType.EcosystemGovernanceAuthority) {
                    return (true, candidates[i]);
                }
            }
        }

        for (uint256 i = 0; i < candidates.length; i++) {
            if (!statementExists(candidates[i])) {
                continue;
            }
            if (equalsIgnoreCase(readAuthorityId(candidates[i]), callerDid)) {
                return (true, candidates[i]);
            }
        }

        return (false, "");
    }

    function cascadeRevoke(string memory parentEntityId) internal {
        string[8] memory candidates = [
            "did:stmt:revocable",
            "did:stmt:owned",
            "did:stmt:field-update",
            "did:stmt:already-revoked",
            "did:stmt:ega",
            "did:stmt:ega-target",
            "did:stmt:parent",
            "did:stmt:child"
        ];

        for (uint256 i = 0; i < candidates.length; i++) {
            if (!statementExists(candidates[i])) {
                continue;
            }
            if (readStatus(candidates[i]) != AuthStmtStatus.Active) {
                continue;
            }
            if (equalsIgnoreCase(readAuthorityId(candidates[i]), parentEntityId)) {
                writeStatus(candidates[i], AuthStmtStatus.Revoked);
                writeUpdated(candidates[i], block.timestamp);
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
        bytes32 slot = statementBaseSlot(statementId);
        bytes32 idSlotValue;
        assembly {
            idSlotValue := sload(slot)
        }
        return idSlotValue != bytes32(0);
    }

    function statementBaseSlot(string memory statementId) internal pure returns (bytes32) {
        return keccak256(abi.encode(statementId, uint256(0)));
    }

    function readAction(string memory statementId) internal view returns (ActionType) {
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 3);
        uint256 value;
        assembly {
            value := sload(slot)
        }
        return ActionType(value);
    }

    function readStatus(string memory statementId) internal view returns (AuthStmtStatus) {
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 8);
        uint256 value;
        assembly {
            value := sload(slot)
        }
        return AuthStmtStatus(value);
    }

    function readAuthorityId(string memory statementId) internal view returns (string memory) {
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 1);
        return readString(slot);
    }

    function readEntityId(string memory statementId) internal view returns (string memory) {
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
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 8);
        uint256 value = uint256(status);
        assembly {
            sstore(slot, value)
        }
    }

    function writeUpdated(string memory statementId, uint256 updatedAt) internal {
        bytes32 slot = bytes32(uint256(statementBaseSlot(statementId)) + 6);
        uint256 value = updatedAt;
        assembly {
            sstore(slot, value)
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