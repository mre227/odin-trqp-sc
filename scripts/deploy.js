async function main() {
  const TrqpRegistry = await ethers.getContractFactory("TrqpRegistry");
  const registry = await TrqpRegistry.deploy();
  await registry.deployed();
  console.log("TrqpRegistry deployed to:", registry.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});