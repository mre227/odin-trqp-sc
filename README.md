# odin-trqp-sc
Solidity smart contract implementation of TRQP (Trust Registry Query Protocol), ported from Hyperledger Fabric chaincode in odin-trqp-cc 

## Overview 
Implements governance and authority statement flows on Besu:
- Bootstrap Ecoystem, EGA, and TrustRegistry statements
- Create, sign and revoke authority statements
- Evaluate statements for Authorization, Delegation and Issuance

## Project Structure
``` 
contracts/                      # Solidity contract
    AuthorityStatement.sol      # Core structs and enums
    TrqpResponse.sol            # Response struct and constants
    TrqpRegistry.sol            # Main contract with stub functions
docs/ 
    function-map.md             # Fabric -> Solidity function mapping
scripts/
    deploy.ts                   # Deployment script

