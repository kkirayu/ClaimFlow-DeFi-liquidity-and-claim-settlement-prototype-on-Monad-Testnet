// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { BaseTest } from './BaseTest.sol';
import { ClaimManager } from '../src/ClaimManager.sol';
import { LiquidityVault } from '../src/LiquidityVault.sol';
import { IAccessControl } from '@openzeppelin/contracts/access/IAccessControl.sol';

contract ClaimManagerTest is BaseTest {
    function setUp() public override {
        super.setUp();
        _deposit(lp1, 100_000 * ONE);
    }

    function test_SubmitClaimStoresMinimumMetadata() public {
        bytes32 claimId = keccak256('claim-submit');
        bytes32 refHash = keccak256('opaque-ref');
        bytes32 evidenceHash = keccak256('opaque-evidence');

        vm.expectEmit(true, true, false, true, address(manager));
        emit ClaimManager.ClaimSubmitted(claimId, refHash, 10_000 * ONE, recipient);

        vm.prank(operator);
        manager.submitClaim(claimId, refHash, 101, 2, recipient, 10_000 * ONE, evidenceHash);

        (
            bytes32 id,
            bytes32 storedRef,
            uint32 branchCode,
            uint8 categoryId,
            address storedRecipient,
            uint256 amount,
            bytes32 storedEvidence,
            ClaimManager.ClaimStatus status,
            uint64 createdAt,
            uint64 updatedAt,
            address createdBy
        ) = manager.claims(claimId);

        assertEq(id, claimId);
        assertEq(storedRef, refHash);
        assertEq(branchCode, 101);
        assertEq(categoryId, 2);
        assertEq(storedRecipient, recipient);
        assertEq(amount, 10_000 * ONE);
        assertEq(storedEvidence, evidenceHash);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.Pending));
        assertEq(createdAt, block.timestamp);
        assertEq(updatedAt, block.timestamp);
        assertEq(createdBy, operator);
        assertEq(manager.claimCount(), 1);
        assertEq(manager.getClaimIds(0, 10).length, 1);

        ClaimManager.ClaimStats memory stats = manager.getStats();
        assertEq(stats.total, 1);
        assertEq(stats.pending, 1);
    }

    function test_SubmitRequiresOperatorRole() public {
        bytes32 claimId = keccak256('unauthorized-submit');
        _expectMissingRole(outsider, manager.CLAIM_OPERATOR_ROLE());
        vm.prank(outsider);
        manager.submitClaim(claimId, keccak256('ref'), 101, 1, recipient, 1_000 * ONE, bytes32(0));
    }

    function test_SubmitRejectsDuplicateId() public {
        bytes32 claimId = _newClaim(1, 1_000 * ONE);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ClaimManager.ClaimAlreadyExists.selector, claimId));
        manager.submitClaim(
            claimId,
            keccak256('other-ref'),
            101,
            1,
            recipient,
            1_000 * ONE,
            bytes32(0)
        );
    }

    function test_SubmitInputValidation() public {
        vm.startPrank(operator);

        vm.expectRevert(ClaimManager.InvalidClaimId.selector);
        manager.submitClaim(bytes32(0), keccak256('r'), 1, 1, recipient, 1 * ONE, bytes32(0));

        vm.expectRevert(ClaimManager.InvalidReferenceHash.selector);
        manager.submitClaim(keccak256('c1'), bytes32(0), 1, 1, recipient, 1 * ONE, bytes32(0));

        vm.expectRevert(abi.encodeWithSelector(ClaimManager.InvalidCategory.selector, 0));
        manager.submitClaim(keccak256('c2'), keccak256('r'), 1, 0, recipient, 1 * ONE, bytes32(0));

        vm.expectRevert(abi.encodeWithSelector(ClaimManager.InvalidCategory.selector, 9));
        manager.submitClaim(keccak256('c3'), keccak256('r'), 1, 9, recipient, 1 * ONE, bytes32(0));

        vm.expectRevert(ClaimManager.ZeroAddress.selector);
        manager.submitClaim(keccak256('c4'), keccak256('r'), 1, 1, address(0), 1 * ONE, bytes32(0));

        vm.expectRevert(ClaimManager.InvalidAmount.selector);
        manager.submitClaim(keccak256('c5'), keccak256('r'), 1, 1, recipient, 0, bytes32(0));

        vm.stopPrank();
    }

    function test_ApproveReservesLiquidityAtomically() public {
        bytes32 claimId = _newClaim(2, 12_500 * ONE);
        uint256 availableBefore = vault.availableLiquidity();

        vm.expectEmit(true, false, false, true, address(manager));
        emit ClaimManager.ClaimApproved(claimId, 12_500 * ONE);
        _approve(claimId);

        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.ApprovedReserved));
        assertEq(vault.totalReserved(), 12_500 * ONE);
        assertEq(vault.reservedByClaim(claimId), 12_500 * ONE);
        assertEq(vault.availableLiquidity(), availableBefore - 12_500 * ONE);

        ClaimManager.ClaimStats memory stats = manager.getStats();
        assertEq(stats.pending, 0);
        assertEq(stats.approvedReserved, 1);
    }

    function test_ApproveWithInsufficientLiquidityRevertsAndStaysPending() public {
        bytes32 claimId = _newClaim(3, 250_000 * ONE);
        uint256 available = vault.availableLiquidity();

        vm.prank(approver);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityVault.InsufficientLiquidity.selector,
                available,
                250_000 * ONE
            )
        );
        manager.approveClaim(claimId);

        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.Pending));
        assertEq(vault.totalReserved(), 0);
        assertEq(manager.getStats().pending, 1);
        assertEq(manager.getStats().approvedReserved, 0);
    }

    function test_ApproveRequiresApproverRole() public {
        bytes32 claimId = _newClaim(4, 1_000 * ONE);
        _expectMissingRole(outsider, manager.CLAIM_APPROVER_ROLE());
        vm.prank(outsider);
        manager.approveClaim(claimId);
    }

    function test_SelfApprovalBlockedByDefaultAndConfigurableForDemo() public {
        bytes32 approverRole = manager.CLAIM_APPROVER_ROLE();
        vm.prank(admin);
        manager.grantRole(approverRole, operator);

        bytes32 claimId = _newClaim(5, 1_000 * ONE);
        vm.prank(operator);
        vm.expectRevert(ClaimManager.SelfApprovalNotAllowed.selector);
        manager.approveClaim(claimId);

        vm.prank(admin);
        manager.setAllowSelfApproval(true);

        vm.prank(operator);
        manager.approveClaim(claimId);
        assertEq(vault.reservedByClaim(claimId), 1_000 * ONE);
    }

    function test_RejectDoesNotReserveFunds() public {
        bytes32 claimId = _newClaim(6, 7_000 * ONE);

        vm.expectEmit(true, false, false, false, address(manager));
        emit ClaimManager.ClaimRejected(claimId);
        vm.prank(approver);
        manager.rejectClaim(claimId);

        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.Rejected));
        assertEq(vault.totalReserved(), 0);
        assertEq(manager.getStats().rejected, 1);
        assertEq(manager.getStats().pending, 0);
    }

    function test_RejectRequiresPending() public {
        bytes32 claimId = _newClaim(7, 1_000 * ONE);
        _approve(claimId);

        vm.prank(approver);
        vm.expectRevert(
            abi.encodeWithSelector(
                ClaimManager.InvalidStatus.selector,
                claimId,
                ClaimManager.ClaimStatus.ApprovedReserved,
                ClaimManager.ClaimStatus.Pending
            )
        );
        manager.rejectClaim(claimId);
    }

    function test_CancelPendingByCreator() public {
        bytes32 claimId = _newClaim(8, 1_000 * ONE);

        vm.expectEmit(true, false, false, false, address(manager));
        emit ClaimManager.ClaimCancelled(claimId);
        vm.prank(operator);
        manager.cancelClaim(claimId);

        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.Cancelled));
        assertEq(manager.getStats().cancelled, 1);
        assertEq(vault.totalReserved(), 0);
    }

    function test_CancelPendingByAnotherOperatorReverts() public {
        address operator2 = address(0xB9);
        bytes32 operatorRole = manager.CLAIM_OPERATOR_ROLE();
        vm.prank(admin);
        manager.grantRole(operatorRole, operator2);

        bytes32 claimId = _newClaim(9, 1_000 * ONE);

        vm.prank(operator2);
        vm.expectRevert(ClaimManager.NotAuthorizedToCancel.selector);
        manager.cancelClaim(claimId);
    }

    function test_CancellerCanCancelPendingClaim() public {
        bytes32 claimId = _newClaim(10, 1_000 * ONE);
        vm.prank(canceller);
        manager.cancelClaim(claimId);
        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.Cancelled));
    }

    function test_CancelReservedReleasesWithoutTransfer() public {
        bytes32 claimId = _newClaim(11, 15_000 * ONE);
        _approve(claimId);

        uint256 vaultBalance = token.balanceOf(address(vault));
        uint256 availableBefore = vault.availableLiquidity();

        vm.prank(canceller);
        manager.cancelClaim(claimId);

        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.Cancelled));
        assertEq(token.balanceOf(address(vault)), vaultBalance);
        assertEq(vault.totalReserved(), 0);
        assertEq(vault.availableLiquidity(), availableBefore + 15_000 * ONE);
        assertEq(manager.getStats().approvedReserved, 0);
    }

    function test_OperatorCannotCancelReservedClaim() public {
        bytes32 claimId = _newClaim(12, 15_000 * ONE);
        _approve(claimId);

        vm.prank(operator);
        vm.expectRevert(ClaimManager.NotAuthorizedToCancel.selector);
        manager.cancelClaim(claimId);
    }

    function test_SettleSinglePayout() public {
        bytes32 claimId = _newClaim(13, 20_000 * ONE);
        _approve(claimId);

        uint256 balanceBefore = token.balanceOf(recipient);
        vm.expectEmit(true, true, false, true, address(manager));
        emit ClaimManager.ClaimPaid(claimId, recipient, 20_000 * ONE);
        vm.prank(settler);
        manager.settleClaim(claimId);

        assertEq(token.balanceOf(recipient), balanceBefore + 20_000 * ONE);
        assertEq(vault.totalReserved(), 0);
        assertEq(vault.reservedByClaim(claimId), 0);
        assertEq(manager.getStats().paid, 1);
        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(claimId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.Paid));
    }

    function test_DoublePayoutReverts() public {
        bytes32 claimId = _newClaim(14, 20_000 * ONE);
        _approve(claimId);
        vm.prank(settler);
        manager.settleClaim(claimId);

        uint256 recipientBalance = token.balanceOf(recipient);
        vm.prank(settler);
        vm.expectRevert(
            abi.encodeWithSelector(
                ClaimManager.InvalidStatus.selector,
                claimId,
                ClaimManager.ClaimStatus.Paid,
                ClaimManager.ClaimStatus.ApprovedReserved
            )
        );
        manager.settleClaim(claimId);
        assertEq(token.balanceOf(recipient), recipientBalance);
    }

    function test_SettleRequiresSettlementRole() public {
        bytes32 claimId = _newClaim(15, 1_000 * ONE);
        _approve(claimId);

        _expectMissingRole(outsider, manager.SETTLEMENT_ROLE());
        vm.prank(outsider);
        manager.settleClaim(claimId);
    }

    function test_BatchSettlementPaysAllClaims() public {
        bytes32 id1 = _newClaim(16, 1_000 * ONE);
        bytes32 id2 = _newClaim(17, 2_000 * ONE);
        bytes32 id3 = _newClaim(18, 3_000 * ONE);
        _approve(id1);
        _approve(id2);
        _approve(id3);

        bytes32[] memory ids = new bytes32[](3);
        ids[0] = id1;
        ids[1] = id2;
        ids[2] = id3;

        uint256 total = 6_000 * ONE;
        bytes32 expectedBatchId = keccak256(
            abi.encode(block.chainid, address(manager), 1, settler, total)
        );

        vm.expectEmit(true, false, false, true, address(manager));
        emit ClaimManager.BatchSettled(expectedBatchId, 3, total);

        vm.prank(settler);
        bytes32 batchId = manager.settleBatch(ids);

        assertEq(batchId, expectedBatchId);
        assertEq(token.balanceOf(recipient), total);
        assertEq(vault.totalReserved(), 0);
        assertEq(manager.getStats().paid, 3);
        assertEq(manager.getStats().approvedReserved, 0);
    }

    function test_BatchWithOneInvalidClaimRevertsWithoutPartialPayout() public {
        bytes32 approvedId = _newClaim(19, 4_000 * ONE);
        bytes32 pendingId = _newClaim(20, 4_000 * ONE);
        _approve(approvedId);

        bytes32[] memory ids = new bytes32[](2);
        ids[0] = approvedId;
        ids[1] = pendingId;

        vm.prank(settler);
        vm.expectRevert(
            abi.encodeWithSelector(
                ClaimManager.InvalidStatus.selector,
                pendingId,
                ClaimManager.ClaimStatus.Pending,
                ClaimManager.ClaimStatus.ApprovedReserved
            )
        );
        manager.settleBatch(ids);

        assertEq(token.balanceOf(recipient), 0);
        assertEq(vault.totalReserved(), 4_000 * ONE);
        (, , , , , , , ClaimManager.ClaimStatus status, , , ) = manager.claims(approvedId);
        assertEq(uint8(status), uint8(ClaimManager.ClaimStatus.ApprovedReserved));
        assertEq(manager.getStats().paid, 0);
    }

    function test_BatchWithAlreadyPaidClaimRevertsForAll() public {
        bytes32 paidId = _newClaim(21, 4_000 * ONE);
        bytes32 approvedId = _newClaim(22, 5_000 * ONE);
        _approve(paidId);
        _approve(approvedId);
        vm.prank(settler);
        manager.settleClaim(paidId);

        uint256 recipientBalance = token.balanceOf(recipient);
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = approvedId;
        ids[1] = paidId;

        vm.prank(settler);
        vm.expectRevert(
            abi.encodeWithSelector(
                ClaimManager.InvalidStatus.selector,
                paidId,
                ClaimManager.ClaimStatus.Paid,
                ClaimManager.ClaimStatus.ApprovedReserved
            )
        );
        manager.settleBatch(ids);

        assertEq(token.balanceOf(recipient), recipientBalance);
        assertEq(vault.totalReserved(), 5_000 * ONE);
    }

    function test_BatchRejectsDuplicateClaim() public {
        bytes32 id = _newClaim(23, 1_000 * ONE);
        _approve(id);

        bytes32[] memory ids = new bytes32[](2);
        ids[0] = id;
        ids[1] = id;

        vm.prank(settler);
        vm.expectRevert(abi.encodeWithSelector(ClaimManager.DuplicateClaimInBatch.selector, id));
        manager.settleBatch(ids);
    }

    function test_BatchRejectsEmptyAndOversizedBatch() public {
        bytes32[] memory empty = new bytes32[](0);
        vm.prank(settler);
        vm.expectRevert(ClaimManager.EmptyBatch.selector);
        manager.settleBatch(empty);

        vm.prank(admin);
        manager.setMaxBatchSize(2);

        bytes32 id1 = _newClaim(24, 1_000 * ONE);
        bytes32 id2 = _newClaim(25, 1_000 * ONE);
        bytes32 id3 = _newClaim(26, 1_000 * ONE);
        _approve(id1);
        _approve(id2);
        _approve(id3);

        bytes32[] memory ids = new bytes32[](3);
        ids[0] = id1;
        ids[1] = id2;
        ids[2] = id3;

        vm.prank(settler);
        vm.expectRevert(abi.encodeWithSelector(ClaimManager.BatchTooLarge.selector, 3, 2));
        manager.settleBatch(ids);

        assertEq(manager.getStats().approvedReserved, 3);
    }

    function test_MaxBatchSizeGuards() public {
        assertEq(manager.maxBatchSize(), 20);

        vm.prank(admin);
        manager.setMaxBatchSize(20);
        assertEq(manager.maxBatchSize(), 20);

        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(ClaimManager.InvalidBatchSize.selector, 0));
        manager.setMaxBatchSize(0);
        vm.expectRevert(abi.encodeWithSelector(ClaimManager.InvalidBatchSize.selector, 51));
        manager.setMaxBatchSize(51);
        vm.stopPrank();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                outsider,
                manager.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(outsider);
        manager.setMaxBatchSize(10);
    }

    function test_TerminalStatesCannotTransition() public {
        bytes32 paidId = _newClaim(27, 1_000 * ONE);
        _approve(paidId);
        vm.prank(settler);
        manager.settleClaim(paidId);

        vm.startPrank(approver);
        vm.expectRevert(
            abi.encodeWithSelector(
                ClaimManager.InvalidStatus.selector,
                paidId,
                ClaimManager.ClaimStatus.Paid,
                ClaimManager.ClaimStatus.Pending
            )
        );
        manager.rejectClaim(paidId);
        vm.stopPrank();

        vm.prank(canceller);
        vm.expectRevert(
            abi.encodeWithSelector(
                ClaimManager.InvalidStatus.selector,
                paidId,
                ClaimManager.ClaimStatus.Paid,
                ClaimManager.ClaimStatus.Pending
            )
        );
        manager.cancelClaim(paidId);

        bytes32 rejectedId = _newClaim(28, 1_000 * ONE);
        vm.prank(approver);
        manager.rejectClaim(rejectedId);
        vm.prank(approver);
        vm.expectRevert(
            abi.encodeWithSelector(
                ClaimManager.InvalidStatus.selector,
                rejectedId,
                ClaimManager.ClaimStatus.Rejected,
                ClaimManager.ClaimStatus.Pending
            )
        );
        manager.approveClaim(rejectedId);
    }

    function test_CannotRecreateTerminalClaimId() public {
        bytes32 claimId = _newClaim(29, 1_000 * ONE);
        vm.prank(operator);
        manager.cancelClaim(claimId);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ClaimManager.ClaimAlreadyExists.selector, claimId));
        manager.submitClaim(
            claimId,
            keccak256('new-ref'),
            101,
            1,
            recipient,
            1_000 * ONE,
            bytes32(0)
        );
    }

    function test_ClaimIdPagination() public {
        _newClaim(30, 1 * ONE);
        _newClaim(31, 1 * ONE);
        _newClaim(32, 1 * ONE);

        assertEq(manager.getClaimIds(0, 2).length, 2);
        assertEq(manager.getClaimIds(2, 2).length, 1);
        assertEq(manager.getClaimIds(5, 2).length, 0);
        assertEq(manager.getClaimIds(1, 100).length, 2);
    }

    function test_StatsTrackAllStatuses() public {
        bytes32 pending = _newClaim(33, 1_000 * ONE);
        _newClaim(34, 1_000 * ONE);
        bytes32 reserved = _newClaim(35, 1_000 * ONE);
        _approve(reserved);
        bytes32 paid = _newClaim(36, 1_000 * ONE);
        _approve(paid);
        vm.prank(settler);
        manager.settleClaim(paid);
        bytes32 rejected = _newClaim(37, 1_000 * ONE);
        vm.prank(approver);
        manager.rejectClaim(rejected);
        bytes32 cancelled = _newClaim(38, 1_000 * ONE);
        vm.prank(operator);
        manager.cancelClaim(cancelled);

        ClaimManager.ClaimStats memory stats = manager.getStats();
        assertEq(stats.total, 6);
        assertEq(stats.pending, 2); // pending + the one never approved
        assertEq(stats.approvedReserved, 1);
        assertEq(stats.paid, 1);
        assertEq(stats.rejected, 1);
        assertEq(stats.cancelled, 1);
        assertEq(pending, claimIdOf(33));
        assertEq(reserved, claimIdOf(35));
    }

    function claimIdOf(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked('claim', seed));
    }
}
