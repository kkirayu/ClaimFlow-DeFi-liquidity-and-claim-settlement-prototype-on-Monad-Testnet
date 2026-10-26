// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from 'forge-std/Test.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { IAccessControl } from '@openzeppelin/contracts/access/IAccessControl.sol';
import { MockUSDC } from '../src/MockUSDC.sol';
import { LiquidityVault } from '../src/LiquidityVault.sol';
import { ClaimManager } from '../src/ClaimManager.sol';
import { ILiquidityVault } from '../src/interfaces/ILiquidityVault.sol';

abstract contract BaseTest is Test {
    MockUSDC internal token;
    LiquidityVault internal vault;
    ClaimManager internal manager;

    address internal admin = address(0xA11CE);
    address internal lp1 = address(0xA1);
    address internal lp2 = address(0xA2);
    address internal operator = address(0xB1);
    address internal approver = address(0xB2);
    address internal settler = address(0xB3);
    address internal canceller = address(0xB4);
    address internal recipient = address(0xC1);
    address internal outsider = address(0xDEAD);

    uint256 internal constant ONE = 1e6;
    uint256 internal constant LP_FUNDS = 1_000_000 * ONE;

    function setUp() public virtual {
        vm.startPrank(admin);
        token = new MockUSDC(admin);
        vault = new LiquidityVault(IERC20(address(token)), admin);
        manager = new ClaimManager(ILiquidityVault(address(vault)), admin);

        vault.grantRole(vault.CLAIM_MANAGER_ROLE(), address(manager));
        manager.grantRole(manager.CLAIM_OPERATOR_ROLE(), operator);
        manager.grantRole(manager.CLAIM_APPROVER_ROLE(), approver);
        manager.grantRole(manager.SETTLEMENT_ROLE(), settler);
        manager.grantRole(manager.CLAIM_CANCELLER_ROLE(), canceller);
        vm.stopPrank();

        vm.startPrank(admin);
        token.mint(lp1, LP_FUNDS);
        token.mint(lp2, LP_FUNDS);
        vm.stopPrank();

        vm.prank(lp1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(lp2);
        token.approve(address(vault), type(uint256).max);
    }

    function _deposit(address lp, uint256 amount) internal {
        vm.prank(lp);
        vault.deposit(amount);
    }

    function _newClaim(uint256 seed, uint256 amount) internal returns (bytes32 claimId) {
        claimId = keccak256(abi.encodePacked('claim', seed));
        vm.prank(operator);
        manager.submitClaim(
            claimId,
            keccak256(abi.encodePacked('ref', seed)),
            101,
            1,
            recipient,
            amount,
            keccak256(abi.encodePacked('evidence', seed))
        );
    }

    function _approve(bytes32 claimId) internal {
        vm.prank(approver);
        manager.approveClaim(claimId);
    }

    function _expectMissingRole(address account, bytes32 role) internal {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                account,
                role
            )
        );
    }
}
