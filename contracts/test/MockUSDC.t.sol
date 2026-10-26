// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from 'forge-std/Test.sol';
import { IAccessControl } from '@openzeppelin/contracts/access/IAccessControl.sol';
import { MockUSDC } from '../src/MockUSDC.sol';

contract MockUSDCTest is Test {
    MockUSDC internal token;
    address internal admin = address(0xA11CE);
    address internal user = address(0xB0B);

    function setUp() public {
        vm.prank(admin);
        token = new MockUSDC(admin);
    }

    function test_Metadata() public view {
        assertEq(token.name(), 'Mock USD Coin');
        assertEq(token.symbol(), 'mUSDC');
        assertEq(token.decimals(), 6);
        assertEq(token.FAUCET_AMOUNT(), 100_000e6);
        assertEq(token.FAUCET_CAP(), 500_000e6);
        assertEq(token.FAUCET_COOLDOWN(), 1 hours);
    }

    function test_AdminCanMint() public {
        vm.prank(admin);
        token.mint(user, 1_234e6);
        assertEq(token.balanceOf(user), 1_234e6);
    }

    function test_MintRequiresRole() public {
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                user,
                minterRole
            )
        );
        token.mint(user, 1e6);
    }

    function test_FaucetMintsAndStartsCooldown() public {
        vm.prank(user);
        uint256 received = token.faucet();
        assertEq(received, 100_000e6);
        assertEq(token.balanceOf(user), 100_000e6);
        assertEq(token.faucetMinted(user), 100_000e6);
        assertEq(token.faucetAvailableAt(user), block.timestamp + 1 hours);
    }

    function test_FaucetCooldownReverts() public {
        vm.prank(user);
        token.faucet();

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                MockUSDC.FaucetCooldownActive.selector,
                block.timestamp + 1 hours
            )
        );
        token.faucet();
    }

    function test_FaucetCanRepeatAfterCooldown() public {
        vm.startPrank(user);
        token.faucet();
        vm.warp(block.timestamp + 1 hours);
        token.faucet();
        vm.stopPrank();
        assertEq(token.balanceOf(user), 200_000e6);
    }

    function test_FaucetCapEnforced() public {
        vm.startPrank(user);
        for (uint256 i = 0; i < 5; i++) {
            token.faucet();
            vm.warp(block.timestamp + 1 hours);
        }
        assertEq(token.balanceOf(user), 500_000e6);

        vm.expectRevert(abi.encodeWithSelector(MockUSDC.FaucetCapExceeded.selector, 100_000e6, 0));
        token.faucet();
        vm.stopPrank();
    }

    function test_FaucetEmitsEvent() public {
        uint256 expectedAvailableAt = block.timestamp + 1 hours;
        vm.expectEmit(true, false, false, true, address(token));
        emit MockUSDC.Faucet(user, 100_000e6, expectedAvailableAt);
        vm.prank(user);
        token.faucet();
    }

    function test_MintToZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert(MockUSDC.ZeroAddress.selector);
        token.mint(address(0), 1e6);
    }

    function test_ConstructorRejectsZeroAdmin() public {
        vm.expectRevert(MockUSDC.ZeroAddress.selector);
        new MockUSDC(address(0));
    }
}
