// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorityStatement.sol";

// represents a single signing request entry returned during DID creation
struct SigningRequestEntry {
    string alg;
    string kid;
    string serializedPayload;
    string payload;
    string purpose;
    string nonce;
}

// represents the DID auth challenge returned when a statement needs to be signed
struct DidAuthChallenge {
    string jobId;
    string state;
    string action;
    SigningRequestEntry signingRequest;
}

// standard response envelope returned by all trqp functions
struct TrqpResponse {
    string statusCode;
    string status;
    string description;
    AuthorityStatement[] statements;
    string operationResultJson;
    DidAuthChallenge didAuth;
    string signingRequestJson;
}

// trqp status codes
string constant TRQP_OK = "TRQP-0";
string constant TRQP_ERROR = "TRQP-100";
string constant TRQP_NOT_FOUND = "TRQP-200";
string constant TRQP_INVALID_REQUEST = "TRQP-300";

// action success codes
string constant AS_1 = "AS-1"; // authorized
string constant DS_1 = "DS-1"; // delegated
string constant IS_1 = "IS-1"; // issuer
string constant EC_1 = "EC-1"; // ecosystem
string constant EGA_1 = "EGA-1"; // ecosystem governance authority
string constant TR_1 = "TR-1"; // trust registry