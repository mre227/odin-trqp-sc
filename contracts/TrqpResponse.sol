// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorityStatement.sol";

struct TrqpResponse {
    string statusCode;
    string status;
    string description;
    AuthorityStatement[] statements;
}

string constant TRQP_OK = "TRQP-0";
string constant TRQP_ERROR = "TRQP-100";
string constant TRQP_NOT_FOUND = "TRQP-200";
string constant TRQP_INVALID_REQUEST = "TRQP-300";

string constant AS_1 = "AS-1";
string constant DS_1 = "DS-1";
string constant IS_1 = "IS-1";
string constant EC_1 = "EC-1";
string constant EGA_1 = "EGA-1";
string constant TR_1 = "TR-1";