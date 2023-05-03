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
import { test } from "./utils"
import ts = require("typescript");

const fundedAddr: string = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
const SHARED_MEMORY_ADDRESS = "0x0200000000000000000000000000000000000005";

function packPredicate(predicate: string): string {
  predicate = ethers.utils.hexConcat([predicate, "0xff"])
  let predicateByteLen = (predicate.length-2)/2
  let expectedLen = Math.ceil(predicateByteLen / 32)*32
  let numZeroes = expectedLen - predicateByteLen
  return predicate + "00".repeat(numZeroes)
}

function bytesToHashSlice(hexString: string): string[] {
  const partLength = 32; // length of each part in bytes
  const parts = [];
  const byteLength = ethers.utils.hexDataLength(hexString);

  for (let i = 0; i < byteLength; i += partLength) {
    const part = ethers.utils.hexDataSlice(hexString, i, i + partLength);
    parts.push(part);
  }

  return parts
}

describe("SharedMemoryImport", function () {
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


  it("importAVAX via contract", async function () {
    let testContract: Contract = this.testContract;
    console.log("testContract", testContract.address)

    let predicateBytes = "0x" + process.env.PREDICATE_BYTES_0
    let utxoID = "0x" + process.env.UTXO_ID_0

    // add padding and compute the access list to name the imported UTXO
    let utxoIDBytes32 = ethers.utils.hexZeroPad(utxoID, 32)
    let predicateBytesPacked = packPredicate(predicateBytes)
    let predicateStorageKeys = bytesToHashSlice(predicateBytesPacked)
    // TODO: remove debugging log
    console.log(
      "utxoID", utxoID,
      "utxoIDBytes32", utxoIDBytes32,
      "predicateBytes", predicateBytes,
      "predicateBytesPacked", predicateBytesPacked,
      "predicateStorageKeys", predicateStorageKeys,
    )
    let accessList = [
      {
        address: SHARED_MEMORY_ADDRESS,
        storageKeys: predicateStorageKeys,
      }
    ]

    // ImportAVAX
    let expectedValue = ethers.utils.parseUnits("1", "gwei")
    let tx = await testContract.populateTransaction.test_importAVAX(
      blockchainIDA, utxoIDBytes32, expectedValue, {accessList})
    let signedTx = await fundedSigner.sendTransaction(tx);
    let txReceipt = await signedTx.wait()
    console.log("txReceipt", txReceipt.status)
    expect(await testContract.callStatic.failed()).to.be.false

    // Verify logs were emitted as expected
    let foundLog = txReceipt.logs.some(
      (log: Event, _: any, __: any) => 
        log.address === SHARED_MEMORY_ADDRESS &&
        log.topics.length === 2 && // TODO: review the indexed vs. non-indexed log data
        // TODO: get the string from the contract abi
        log.topics[0] === ethers.utils.id("ImportAVAX(uint64,bytes32,bytes32)") &&
        log.topics[1] == blockchainIDA // source
    )
    // TODO: consider verifying more about the logs
    expect(foundLog).to.be.true
  })


  // TODO: import non-AVAX asset
});
