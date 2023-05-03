// (c) 2019-2022, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import {
  BigNumber,
  Contract,
  ContractFactory,
  Event,
} from "ethers"
import { ethers } from "hardhat"
import ts = require("typescript");

const fundedAddr: string = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
const SHARED_MEMORY_ADDRESS = "0x0200000000000000000000000000000000000005";

describe("SharedMemoryExport", function () {
  this.timeout("30s")
  let fundedSigner: SignerWithAddress
  let contract: Contract
  let signer1: SignerWithAddress
  let signer2: SignerWithAddress
  let precompile: Contract
  let blockchainIDA: string
  let blockchainIDB: string

  beforeEach('Setup DS-Test contract', async function () {
    // Populate blockchainIDs from the environment variables
    blockchainIDA = "0x" + process.env.BLOCKCHAIN_ID_A
    blockchainIDB = "0x" + process.env.BLOCKCHAIN_ID_B
    console.log("blockchainIDA %s, blockchainIDB: %s", blockchainIDA, blockchainIDB)

    fundedSigner = await ethers.getSigner(fundedAddr);
    signer1 = (await ethers.getSigners())[1]
    signer2 = (await ethers.getSigners())[2]

    const sharedMemory = await ethers.getContractAt(
       "ISharedMemory", SHARED_MEMORY_ADDRESS, fundedSigner)

    return  ethers.getContractFactory(
        "ERC20SharedMemoryTest", { signer: fundedSigner })
      .then(factory => factory.deploy())
      .then(contract => {
        this.testContract = contract
        return Promise.all([
          contract.deployed().then(() => contract),
        ])
      })
      .then(([contract]) => contract.setUp())
      .then(tx0 => tx0.wait())
  })


  it("exportAVAX via contract", async function () {
    let testContract: Contract = this.testContract;
    
    let startingBalance: BigNumber = await ethers.provider.getBalance(fundedAddr)
    console.log("Starting balance of %d", startingBalance)
    console.log("testContract", testContract.address)
    
    // Fund the contract
    // Note 1 gwei is the minimum amount of AVAX that can be sent due to
    // denomination adjustment in exported UTXOs.
    let amount = ethers.utils.parseUnits("1", "gwei") 
    let tx = await fundedSigner.sendTransaction({
      to: testContract.address,
      value: amount,
    })
    let receipt = await tx.wait()
    expect(receipt.status == 1).to.be.true

    // ExportAVAX
    // Note we export AVAX to testContract.address, which is the contract we
    // just deployed. This is because the import test will also deploy a
    // contract from the same account with the same nonce.
    tx = await testContract.test_exportAVAX(
       amount, blockchainIDB, testContract.address)
    let txReceipt = await tx.wait()
    console.log("txReceipt", txReceipt.status)
    expect(await testContract.callStatic.failed()).to.be.false

    // Verify logs were emitted as expected
    let foundLog = txReceipt.logs.find(
      (log: Event, _: any, __: any) => 
        log.address === SHARED_MEMORY_ADDRESS &&
        log.topics.length === 2 && // TODO: review the indexed vs. non-indexed log data
        // TODO: get the string from the contract abi
        log.topics[0] === ethers.utils.id("ExportAVAX(uint64,bytes32,uint64,uint64,address[])") &&
        log.topics[1] == blockchainIDB // destination
    )
    // TODO: consider verifying more about the logs
    expect(foundLog).to.exist;
  })


  // TODO: export non-AVAX asset
});
