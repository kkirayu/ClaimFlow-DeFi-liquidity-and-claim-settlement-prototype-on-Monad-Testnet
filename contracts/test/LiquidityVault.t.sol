// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { BaseTest } from './BaseTest.sol';
import { LiquidityVault } from '../src/LiquidityVault.sol';

contract LiquidityVaultTest is BaseTest {
    bytes32 internal constant CLAIM_A = keccak256('vault-claim-a');
    bytes32 internal constant CLAIM_B = keccak256('vault-claim-b');

    function test_FirstDepositMintsOneToOneShares() public {
        vm.expectEmit(true, false, false, true, address(vault));
        emit LiquidityVault.Deposited(lp1, 100_000 * ONE, 100_000 * ONE);

        vm.prank(lp1);
        uint256 shares = vault.deposit(100_000 * ONE);

        assertEq(shares, 100_000 * ONE);
        assertEq(vault.sharesOf(lp1), shares);
        assertEq(vault.totalShares(), shares);
        assertEq(vault.totalAssets(), 100_000 * ONE);
        assertEq(vault.availableLiquidity(), 100_000 * ONE);
        assertEq(vault.totalReserved(), 0);
    }

    function test_DepositRejectsZeroAmount() public {
        vm.prank(lp1);
        vm.expectRevert(LiquidityVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_SecondDepositUsesAvailableSharePrice() public {
        _deposit(lp1, 100_000 * ONE);

        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 20_000 * ONE);
        assertEq(vault.availableLiquidity(), 80_000 * ONE);

        vm.prank(lp2);
        uint256 lp2Shares = vault.deposit(40_000 * ONE);

        // 40,000 assets at an available-liquidity price of 0.80 per share => 50,000 shares.
        assertEq(lp2Shares, 50_000 * ONE);
        assertEq(vault.totalShares(), 150_000 * ONE);
        assertEq(vault.availableLiquidity(), 120_000 * ONE);
        assertEq(vault.totalAssets(), 140_000 * ONE);
        assertEq(vault.totalReserved(), 20_000 * ONE);

        vm.prank(lp2);
        uint256 assets = vault.withdraw(lp2Shares);
        assertEq(assets, 40_000 * ONE);
        assertEq(vault.totalAssets(), 100_000 * ONE);
        assertEq(vault.totalReserved(), 20_000 * ONE);
    }

    function test_WithdrawCannotTouchReservedFunds() public {
        _deposit(lp1, 100_000 * ONE);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 20_000 * ONE);

        vm.expectEmit(true, false, false, true, address(vault));
        emit LiquidityVault.Withdrawn(lp1, 80_000 * ONE, 100_000 * ONE);
        vm.prank(lp1);
        uint256 assets = vault.withdraw(100_000 * ONE);

        assertEq(assets, 80_000 * ONE);
        assertEq(token.balanceOf(lp1), LP_FUNDS - 20_000 * ONE);
        assertEq(vault.totalAssets(), 20_000 * ONE);
        assertEq(vault.totalReserved(), 20_000 * ONE);
        assertEq(vault.availableLiquidity(), 0);
    }

    function test_WithdrawRejectsMoreThanOwnedShares() public {
        _deposit(lp1, 10_000 * ONE);

        vm.prank(lp1);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityVault.InsufficientShares.selector,
                10_000 * ONE + 1,
                10_000 * ONE
            )
        );
        vault.withdraw(10_000 * ONE + 1);
    }

    function test_WithdrawRejectsWhenNoAvailableLiquidity() public {
        _deposit(lp1, 10_000 * ONE);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 10_000 * ONE);

        vm.prank(lp1);
        vm.expectRevert(LiquidityVault.NoLiquidityForWithdrawal.selector);
        vault.withdraw(1);
    }

    function test_DepositRevertsWhenAllLiquidityIsReserved() public {
        _deposit(lp1, 10_000 * ONE);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 10_000 * ONE);

        vm.prank(lp2);
        vm.expectRevert(LiquidityVault.NoLiquidityForDeposit.selector);
        vault.deposit(1_000 * ONE);
    }

    function test_ReserveReducesAvailableLiquidity() public {
        _deposit(lp1, 100_000 * ONE);

        vm.expectEmit(true, false, false, true, address(vault));
        emit LiquidityVault.LiquidityReserved(CLAIM_A, 25_000 * ONE);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 25_000 * ONE);

        assertEq(vault.totalReserved(), 25_000 * ONE);
        assertEq(vault.reservedByClaim(CLAIM_A), 25_000 * ONE);
        assertEq(vault.availableLiquidity(), 75_000 * ONE);
        assertEq(vault.totalAssets(), 100_000 * ONE);
    }

    function test_ReserveRequiresManagerRole() public {
        _deposit(lp1, 10_000 * ONE);
        _expectMissingRole(outsider, vault.CLAIM_MANAGER_ROLE());
        vm.prank(outsider);
        vault.reserve(CLAIM_A, 1_000 * ONE);
    }

    function test_ReserveRejectsInsufficientLiquidity() public {
        _deposit(lp1, 10_000 * ONE);
        vm.prank(address(manager));
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityVault.InsufficientLiquidity.selector,
                10_000 * ONE,
                10_001 * ONE
            )
        );
        vault.reserve(CLAIM_A, 10_001 * ONE);
    }

    function test_ReserveRejectsDuplicateClaimAndZeroAmount() public {
        _deposit(lp1, 10_000 * ONE);

        vm.startPrank(address(manager));
        vm.expectRevert(LiquidityVault.ZeroReservation.selector);
        vault.reserve(CLAIM_A, 0);

        vault.reserve(CLAIM_A, 1_000 * ONE);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityVault.ReservationAlreadyExists.selector, CLAIM_A)
        );
        vault.reserve(CLAIM_A, 1_000 * ONE);
        vm.stopPrank();
    }

    function test_ReleaseFreesLiquidityWithoutTransfer() public {
        _deposit(lp1, 100_000 * ONE);
        vm.startPrank(address(manager));
        vault.reserve(CLAIM_A, 40_000 * ONE);

        uint256 balanceBefore = token.balanceOf(address(vault));
        vm.expectEmit(true, false, false, true, address(vault));
        emit LiquidityVault.LiquidityReleased(CLAIM_A, 40_000 * ONE);
        uint256 released = vault.release(CLAIM_A);
        vm.stopPrank();

        assertEq(released, 40_000 * ONE);
        assertEq(token.balanceOf(address(vault)), balanceBefore);
        assertEq(vault.totalReserved(), 0);
        assertEq(vault.availableLiquidity(), 100_000 * ONE);
        assertEq(vault.reservedByClaim(CLAIM_A), 0);
    }

    function test_ReleaseRejectsMissingReservation() public {
        vm.prank(address(manager));
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityVault.ReservationMissing.selector, CLAIM_A)
        );
        vault.release(CLAIM_A);
    }

    function test_PayoutTransfersAndClearsReservation() public {
        _deposit(lp1, 100_000 * ONE);
        vm.startPrank(address(manager));
        vault.reserve(CLAIM_A, 25_000 * ONE);

        vm.expectEmit(true, true, false, true, address(vault));
        emit LiquidityVault.PayoutExecuted(CLAIM_A, recipient, 25_000 * ONE);
        vault.payout(CLAIM_A, recipient, 25_000 * ONE);
        vm.stopPrank();

        assertEq(token.balanceOf(recipient), 25_000 * ONE);
        assertEq(vault.totalAssets(), 75_000 * ONE);
        assertEq(vault.totalReserved(), 0);
        assertEq(vault.availableLiquidity(), 75_000 * ONE);
        assertEq(vault.reservedByClaim(CLAIM_A), 0);
    }

    function test_DoublePayoutReverts() public {
        _deposit(lp1, 100_000 * ONE);
        vm.startPrank(address(manager));
        vault.reserve(CLAIM_A, 25_000 * ONE);
        vault.payout(CLAIM_A, recipient, 25_000 * ONE);

        vm.expectRevert(
            abi.encodeWithSelector(LiquidityVault.ReservationMissing.selector, CLAIM_A)
        );
        vault.payout(CLAIM_A, recipient, 25_000 * ONE);
        vm.stopPrank();

        assertEq(token.balanceOf(recipient), 25_000 * ONE);
    }

    function test_PayoutRejectsReservationMismatch() public {
        _deposit(lp1, 100_000 * ONE);
        vm.startPrank(address(manager));
        vault.reserve(CLAIM_A, 25_000 * ONE);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityVault.ReservationMismatch.selector,
                CLAIM_A,
                25_000 * ONE,
                20_000 * ONE
            )
        );
        vault.payout(CLAIM_A, recipient, 20_000 * ONE);
        vm.stopPrank();
    }

    function test_PayoutRequiresManagerRoleAndValidRecipient() public {
        _deposit(lp1, 100_000 * ONE);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 25_000 * ONE);

        _expectMissingRole(outsider, vault.CLAIM_MANAGER_ROLE());
        vm.prank(outsider);
        vault.payout(CLAIM_A, recipient, 25_000 * ONE);

        vm.prank(address(manager));
        vm.expectRevert(LiquidityVault.ZeroAddress.selector);
        vault.payout(CLAIM_A, address(0), 25_000 * ONE);
    }

    function test_UtilizationAndConversions() public {
        assertEq(vault.utilizationBps(), 0);
        _deposit(lp1, 100_000 * ONE);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 25_000 * ONE);

        assertEq(vault.utilizationBps(), 2_500);
        assertEq(vault.convertToAssets(100_000 * ONE), 75_000 * ONE);
        assertEq(vault.previewDeposit(40_000 * ONE), 53_333_333_333);

        vm.prank(address(manager));
        vault.release(CLAIM_A);
        assertEq(vault.utilizationBps(), 0);
    }

    function test_PreviewDepositReturnsZeroWhenUnavailable() public {
        _deposit(lp1, 100_000 * ONE);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 100_000 * ONE);
        assertEq(vault.previewDeposit(1_000 * ONE), 0);
    }

    function test_ClaimManagerRoleCanBeRotatedByAdmin() public {
        _deposit(lp1, 10_000 * ONE);
        bytes32 managerRole = vault.CLAIM_MANAGER_ROLE();
        vm.prank(admin);
        vault.revokeRole(managerRole, address(manager));

        _expectMissingRole(address(manager), vault.CLAIM_MANAGER_ROLE());
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, 1_000 * ONE);
    }

    function testFuzz_ReservedFundsAlwaysCovered(
        uint96 rawDeposit,
        uint96 rawReserve,
        uint96 rawShares
    ) public {
        uint256 depositAmount = bound(rawDeposit, 1, LP_FUNDS);
        _deposit(lp1, depositAmount);

        uint256 reserveAmount = bound(rawReserve, 1, depositAmount);
        vm.prank(address(manager));
        vault.reserve(CLAIM_A, reserveAmount);

        uint256 owned = vault.sharesOf(lp1);
        uint256 shares = bound(rawShares, 1, owned);
        vm.prank(lp1);
        try vault.withdraw(shares) {} catch {}

        assertGe(vault.totalAssets(), vault.totalReserved());
        assertEq(vault.availableLiquidity(), vault.totalAssets() - vault.totalReserved());
    }

    function testFuzz_PayoutPreservesAccounting(uint96 rawDeposit, uint96 rawReserve) public {
        uint256 depositAmount = bound(rawDeposit, 1, LP_FUNDS);
        uint256 reserveAmount = bound(rawReserve, 1, depositAmount);

        _deposit(lp1, depositAmount);
        vm.startPrank(address(manager));
        vault.reserve(CLAIM_B, reserveAmount);
        vault.payout(CLAIM_B, recipient, reserveAmount);
        vm.stopPrank();

        assertEq(vault.totalAssets(), depositAmount - reserveAmount);
        assertEq(vault.totalReserved(), 0);
        assertEq(token.balanceOf(recipient), reserveAmount);
        assertGe(vault.totalAssets(), vault.totalReserved());
    }
}
