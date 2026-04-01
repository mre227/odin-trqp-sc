// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorityStatement.sol";
import "./TrqpResponse.sol";

contract TrqpRegistry {

    function initialize() external returns (TrqpResponse memory) {}

    function finishBootstrap() external returns (TrqpResponse memory) {}

    function migrateEcosystem() external returns (TrqpResponse memory) {}

    function migrateEga() external returns (TrqpResponse memory) {}

    function migrateTrustRegistry() external returns (TrqpResponse memory) {}

    function createStatement() external returns (TrqpResponse memory) {}

    function signStatement() external returns (TrqpResponse memory) {}

    function getSigningMaterial() external returns (TrqpResponse memory) {}

    function updateStatement() external returns (TrqpResponse memory) {}

    function getStatement() external returns (TrqpResponse memory) {}

    function searchStatement() external returns (TrqpResponse memory) {}

    function evaluateStatement() external returns (TrqpResponse memory) {}
}