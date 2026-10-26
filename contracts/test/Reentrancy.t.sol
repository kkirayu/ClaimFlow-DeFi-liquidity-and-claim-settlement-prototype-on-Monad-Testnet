// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { LiquidityVault } from "../src/LiquidityVault.sol";
import { ReentrantToken } from "./mocks/ReentrantToken.sol";

contract ReentrancyTest is Test {
    ReentrantToken internal token;
    LiquidityVault internal vault;
    address internal user = address(0xA11CE);
    address internal admin = address(0xAD);

    function setUp() public {
        vm.startPrank(admin);
        token = new ReentrantToken();
        vault = new LiquidityVault(IERC20(address(token)), admin);
        token.setVault(address(vault));
        vm.stopPrank();

        token.mint(user, 1_000e18);
        vm.prank(user);
        token.approve(address(vault), type(uint256).max);
        vm.prank(user);
        vault.deposit(1_000e18);
    }

    function test_WithdrawReentrancyIsBlockedAndRevertsWholeCall() public {
        token.setAttack(true);

        vm.prank(user);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vault.withdraw(100e18);

        // State and balances are fully rolled back.
        assertEq(vault.sharesOf(user), 1_000e18);
        assertEq(token.balanceOf(user), 0);
        assertEq(vault.totalAssets(), 1_000e18);
    }
}
