//SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AllowList.sol";
import "./IAllowList.sol";
import "ds-test/src/test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Precompiled Allow List Contract Address
address constant TX_ALLOW_LIST = 0x0200000000000000000000000000000000000002;

// ExampleTxAllowList shows how TxAllowList precompile can be used in a smart contract
// All methods of [allowList] can be directly called. There are example calls as tasks in hardhat.config.ts file.
contract ExampleTxAllowList is AllowList {
  constructor() AllowList(TX_ALLOW_LIST) {}

  function deployToken() public {
    new ERC20("Test", "TST");
  }
}

contract ExampleTxAllowListTest is DSTest {
  function setUp() public {
    // noop
  }

  function test_contractOwnerIsAdmin() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    assertTrue(example.isAdmin(address(this)));
  }

  function test_precompileHasDeployerAsAdmin() public {
    IAllowList allowList = IAllowList(TX_ALLOW_LIST);
    assertEq(allowList.readAllowList(msg.sender), 2);
  }

  function test_newAddressHasNoRole() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    IAllowList allowList = IAllowList(TX_ALLOW_LIST);
    assertEq(allowList.readAllowList(address(example)), 0);
  }

  function test_noRoleIsNotAdmin() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    ExampleTxAllowList other = new ExampleTxAllowList();
    assertTrue(!example.isAdmin(address(other)));
  }

  function test_exmapleAllowListReturnsTestIsAdmin() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    assertTrue(example.isAdmin(address(this)));
  }

  function test_cantDeployFromNoRole() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    try example.deployToken() {
      assertTrue(false, "deployToken should fail");
    } catch {} // TODO should match on an error to make sure that this is failing in the way that's expected
  }

  function test_noRoleCannotEnableItself() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    IAllowList allowList = IAllowList(TX_ALLOW_LIST);

    assertEq(allowList.readAllowList(address(example)), 0);

    try example.setEnabled(address(example)) {
      assertTrue(false, "setEnabled should fail");
    } catch {} // TODO should match on an error to make sure that this is failing in the way that's expected
  }

  function test_addContractAsAdmin() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    address exampleAddress = address(example);

    IAllowList allowList = IAllowList(TX_ALLOW_LIST);

    assertEq(allowList.readAllowList(exampleAddress), 0);

    allowList.setAdmin(exampleAddress);

    assertEq(allowList.readAllowList(exampleAddress), 2);

    assertTrue(example.isAdmin(exampleAddress));
  }

  function test_enableThroughContract() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    ExampleTxAllowList other = new ExampleTxAllowList();
    address exampleAddress = address(example);
    address otherAddress = address(other);

    IAllowList allowList = IAllowList(TX_ALLOW_LIST);

    assertTrue(!example.isEnabled(exampleAddress));
    assertTrue(!example.isEnabled(otherAddress));

    allowList.setAdmin(exampleAddress);

    assertTrue(example.isEnabled(exampleAddress));
    assertTrue(!example.isEnabled(otherAddress));

    example.setEnabled(otherAddress);

    assertTrue(example.isEnabled(exampleAddress));
    assertTrue(example.isEnabled(otherAddress));
  }

  function test_canDeploy() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    address exampleAddress = address(example);

    IAllowList allowList = IAllowList(TX_ALLOW_LIST);

    allowList.setEnabled(exampleAddress);

    // try-catch makes this easier to debug if something isn't working
    try example.deployToken() {} catch {
      assertTrue(false, "deployToken should not fail");
    }
  }

  function test_onlyAdminCanEnable() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    ExampleTxAllowList other = new ExampleTxAllowList();
    address exampleAddress = address(example);
    address otherAddress = address(other);

    IAllowList allowList = IAllowList(TX_ALLOW_LIST);

    assertTrue(!example.isEnabled(exampleAddress));
    assertTrue(!example.isEnabled(otherAddress));

    allowList.setEnabled(exampleAddress);

    assertTrue(example.isEnabled(exampleAddress));
    assertTrue(!example.isEnabled(otherAddress));

    try example.setEnabled(otherAddress) {
      assertTrue(false, "setEnabled should fail");
    } catch {} // TODO should match on an error to make sure that this is failing in the way that's expected

    // state should not have changed when setEnabled fails
    assertTrue(!example.isEnabled(otherAddress));
  }

  function test_onlyAdminCanRevoke() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    ExampleTxAllowList other = new ExampleTxAllowList();
    address exampleAddress = address(example);
    address otherAddress = address(other);

    IAllowList allowList = IAllowList(TX_ALLOW_LIST);

    assertTrue(!example.isEnabled(exampleAddress));
    assertTrue(!example.isEnabled(otherAddress));

    allowList.setEnabled(exampleAddress);
    allowList.setAdmin(otherAddress);

    assertTrue(example.isEnabled(exampleAddress) && !example.isAdmin(exampleAddress));
    assertTrue(example.isAdmin(otherAddress));

    try example.revoke(otherAddress) {
      assertTrue(false, "revoke should fail");
    } catch {} // TODO should match on an error to make sure that this is failing in the way that's expected

    // state should not have changed when revoke fails
    assertTrue(example.isAdmin(otherAddress));
  }

  function test_adminCanRevoke() public {
    ExampleTxAllowList example = new ExampleTxAllowList();
    ExampleTxAllowList other = new ExampleTxAllowList();
    address exampleAddress = address(example);
    address otherAddress = address(other);

    IAllowList allowList = IAllowList(TX_ALLOW_LIST);

    assertTrue(!example.isEnabled(exampleAddress));
    assertTrue(!example.isEnabled(otherAddress));

    allowList.setAdmin(exampleAddress);
    allowList.setAdmin(otherAddress);

    assertTrue(example.isAdmin(exampleAddress));
    assertTrue(other.isAdmin(otherAddress));

    example.revoke(otherAddress);
    assertTrue(!other.isEnabled(otherAddress));
  }
}
