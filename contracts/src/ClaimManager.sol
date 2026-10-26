// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from '@openzeppelin/contracts/access/AccessControl.sol';
import { ReentrancyGuard } from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import { ILiquidityVault } from './interfaces/ILiquidityVault.sol';

/**
 * @title ClaimManager
 * @notice Role-gated claim lifecycle for the ClaimFlow demo.
 *
 * Claims contain opaque references and minimal metadata only. No names, policy numbers, identity
 * numbers, documents, or other personal data belong on-chain.
 *
 * Lifecycle:
 *   Pending -> ApprovedReserved (approve + atomic reserve)
 *   Pending -> Rejected
 *   Pending -> Cancelled
 *   ApprovedReserved -> Paid (single or batch settlement)
 *   ApprovedReserved -> Cancelled (authorized release, no token transfer)
 *
 * Paid, Rejected and Cancelled are terminal.
 */
contract ClaimManager is AccessControl, ReentrancyGuard {
    bytes32 public constant CLAIM_OPERATOR_ROLE = keccak256('CLAIM_OPERATOR_ROLE');
    bytes32 public constant CLAIM_APPROVER_ROLE = keccak256('CLAIM_APPROVER_ROLE');
    bytes32 public constant SETTLEMENT_ROLE = keccak256('SETTLEMENT_ROLE');
    bytes32 public constant CLAIM_CANCELLER_ROLE = keccak256('CLAIM_CANCELLER_ROLE');

    enum ClaimStatus {
        None,
        Pending,
        ApprovedReserved,
        Paid,
        Rejected,
        Cancelled
    }

    struct Claim {
        bytes32 claimId;
        bytes32 claimRefHash;
        uint32 branchCode;
        uint8 categoryId;
        address recipient;
        uint256 amount;
        bytes32 evidenceHash;
        ClaimStatus status;
        uint64 createdAt;
        uint64 updatedAt;
        address createdBy;
    }

    struct ClaimStats {
        uint256 total;
        uint256 pending;
        uint256 approvedReserved;
        uint256 paid;
        uint256 rejected;
        uint256 cancelled;
    }

    uint256 public constant DEFAULT_MAX_BATCH_SIZE = 20;
    uint256 public constant ABSOLUTE_MAX_BATCH_SIZE = 50;
    uint8 public constant MAX_CATEGORY_ID = 8;

    ILiquidityVault public immutable vault;

    mapping(bytes32 claimId => Claim claim) public claims;
    bytes32[] private _claimIds;

    ClaimStats private _stats;

    uint256 public maxBatchSize = DEFAULT_MAX_BATCH_SIZE;
    bool public allowSelfApproval;
    uint256 public batchNonce;

    event ClaimSubmitted(
        bytes32 indexed claimId,
        bytes32 indexed claimRefHash,
        uint256 amount,
        address recipient
    );
    event ClaimApproved(bytes32 indexed claimId, uint256 amount);
    event ClaimRejected(bytes32 indexed claimId);
    event ClaimCancelled(bytes32 indexed claimId);
    event ClaimPaid(bytes32 indexed claimId, address indexed recipient, uint256 amount);
    event BatchSettled(bytes32 indexed batchId, uint256 claimsCount, uint256 totalAmount);
    event AllowSelfApprovalUpdated(bool allowed);
    event MaxBatchSizeUpdated(uint256 maxBatchSize);

    error ZeroAddress();
    error InvalidClaimId();
    error InvalidReferenceHash();
    error InvalidCategory(uint8 categoryId);
    error InvalidAmount();
    error ClaimAlreadyExists(bytes32 claimId);
    error ClaimNotFound(bytes32 claimId);
    error InvalidStatus(bytes32 claimId, ClaimStatus current, ClaimStatus required);
    error SelfApprovalNotAllowed();
    error NotAuthorizedToCancel();
    error EmptyBatch();
    error BatchTooLarge(uint256 size, uint256 maxSize);
    error DuplicateClaimInBatch(bytes32 claimId);
    error InvalidBatchSize(uint256 size);

    constructor(ILiquidityVault vault_, address admin) {
        if (address(vault_) == address(0) || admin == address(0)) revert ZeroAddress();
        vault = vault_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------------------------------
    // Claim lifecycle
    // ---------------------------------------------------------------------------------------------

    /// @notice Record a claim that has already been verified off-chain.
    function submitClaim(
        bytes32 claimId,
        bytes32 claimRefHash,
        uint32 branchCode,
        uint8 categoryId,
        address recipient,
        uint256 amount,
        bytes32 evidenceHash
    ) external onlyRole(CLAIM_OPERATOR_ROLE) {
        if (claimId == bytes32(0)) revert InvalidClaimId();
        if (claimRefHash == bytes32(0)) revert InvalidReferenceHash();
        if (categoryId == 0 || categoryId > MAX_CATEGORY_ID) revert InvalidCategory(categoryId);
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (claims[claimId].status != ClaimStatus.None) revert ClaimAlreadyExists(claimId);

        uint64 nowTs = uint64(block.timestamp);
        claims[claimId] = Claim({
            claimId: claimId,
            claimRefHash: claimRefHash,
            branchCode: branchCode,
            categoryId: categoryId,
            recipient: recipient,
            amount: amount,
            evidenceHash: evidenceHash,
            status: ClaimStatus.Pending,
            createdAt: nowTs,
            updatedAt: nowTs,
            createdBy: msg.sender
        });
        _claimIds.push(claimId);

        _stats.total += 1;
        _stats.pending += 1;

        // Deliberately does not include metadata beyond the PRD event shape.
        emit ClaimSubmitted(claimId, claimRefHash, amount, recipient);
    }

    /**
     * @notice Approve a pending claim and reserve its amount atomically.
     * @dev If the vault has insufficient available liquidity the whole call reverts and the claim
     *      stays Pending. By default an operator cannot approve a claim they submitted.
     */
    function approveClaim(bytes32 claimId) external onlyRole(CLAIM_APPROVER_ROLE) nonReentrant {
        Claim storage claim = _requireClaim(claimId);
        if (claim.status != ClaimStatus.Pending) {
            revert InvalidStatus(claimId, claim.status, ClaimStatus.Pending);
        }
        if (!allowSelfApproval && claim.createdBy == msg.sender) revert SelfApprovalNotAllowed();

        claim.status = ClaimStatus.ApprovedReserved;
        claim.updatedAt = uint64(block.timestamp);
        _stats.pending -= 1;
        _stats.approvedReserved += 1;

        vault.reserve(claimId, claim.amount);

        emit ClaimApproved(claimId, claim.amount);
    }

    /// @notice Reject a pending claim without reserving any liquidity.
    function rejectClaim(bytes32 claimId) external onlyRole(CLAIM_APPROVER_ROLE) {
        Claim storage claim = _requireClaim(claimId);
        if (claim.status != ClaimStatus.Pending) {
            revert InvalidStatus(claimId, claim.status, ClaimStatus.Pending);
        }

        claim.status = ClaimStatus.Rejected;
        claim.updatedAt = uint64(block.timestamp);
        _stats.pending -= 1;
        _stats.rejected += 1;

        emit ClaimRejected(claimId);
    }

    /**
     * @notice Cancel a pending claim, or release a reserved one if the caller is a canceller.
     * @dev Pending claims may be cancelled by their creator (if still an operator) or any canceller.
     *      Reserved claims may only be cancelled by a canceller. Cancellation never moves tokens.
     */
    function cancelClaim(bytes32 claimId) external nonReentrant {
        Claim storage claim = _requireClaim(claimId);
        bool isCanceller = hasRole(CLAIM_CANCELLER_ROLE, msg.sender);

        if (claim.status == ClaimStatus.Pending) {
            if (!isCanceller) {
                bool isCreatorOperator = claim.createdBy == msg.sender &&
                    hasRole(CLAIM_OPERATOR_ROLE, msg.sender);
                if (!isCreatorOperator) revert NotAuthorizedToCancel();
            }

            claim.status = ClaimStatus.Cancelled;
            claim.updatedAt = uint64(block.timestamp);
            _stats.pending -= 1;
            _stats.cancelled += 1;
        } else if (claim.status == ClaimStatus.ApprovedReserved) {
            if (!isCanceller) revert NotAuthorizedToCancel();

            claim.status = ClaimStatus.Cancelled;
            claim.updatedAt = uint64(block.timestamp);
            _stats.approvedReserved -= 1;
            _stats.cancelled += 1;

            vault.release(claimId);
        } else {
            revert InvalidStatus(claimId, claim.status, ClaimStatus.Pending);
        }

        emit ClaimCancelled(claimId);
    }

    /// @notice Pay one approved and reserved claim.
    function settleClaim(bytes32 claimId) external onlyRole(SETTLEMENT_ROLE) nonReentrant {
        Claim storage claim = _requireClaim(claimId);
        if (claim.status != ClaimStatus.ApprovedReserved) {
            revert InvalidStatus(claimId, claim.status, ClaimStatus.ApprovedReserved);
        }

        _markPaid(claim);

        // Payout verifies the exact reservation amount and clears it before transferring.
        vault.payout(claimId, claim.recipient, claim.amount);

        emit ClaimPaid(claimId, claim.recipient, claim.amount);
    }

    /**
     * @notice Pay several approved and reserved claims atomically (all-or-nothing).
     * @dev The complete batch is validated before the first payout. Any invalid item, duplicate, or
     *      failed transfer reverts the whole transaction, so no partial payouts can occur.
     */
    function settleBatch(
        bytes32[] calldata claimIds
    ) external onlyRole(SETTLEMENT_ROLE) nonReentrant returns (bytes32 batchId) {
        uint256 count = claimIds.length;
        if (count == 0) revert EmptyBatch();
        if (count > maxBatchSize) revert BatchTooLarge(count, maxBatchSize);

        uint256 totalAmount;
        for (uint256 i = 0; i < count; i++) {
            bytes32 claimId = claimIds[i];
            Claim storage claim = _requireClaim(claimId);
            if (claim.status != ClaimStatus.ApprovedReserved) {
                revert InvalidStatus(claimId, claim.status, ClaimStatus.ApprovedReserved);
            }
            for (uint256 j = 0; j < i; j++) {
                if (claimIds[j] == claimId) revert DuplicateClaimInBatch(claimId);
            }
            totalAmount += claim.amount;
        }

        unchecked {
            batchNonce += 1;
        }
        batchId = keccak256(
            abi.encode(block.chainid, address(this), batchNonce, msg.sender, totalAmount)
        );

        for (uint256 i = 0; i < count; i++) {
            bytes32 claimId = claimIds[i];
            Claim storage claim = claims[claimId];
            address recipient = claim.recipient;
            uint256 amount = claim.amount;
            _markPaid(claim);
            vault.payout(claimId, recipient, amount);
            emit ClaimPaid(claimId, recipient, amount);
        }

        emit BatchSettled(batchId, count, totalAmount);
    }

    // ---------------------------------------------------------------------------------------------
    // Admin configuration (demo only)
    // ---------------------------------------------------------------------------------------------

    /// @notice Demo-only escape hatch for single-signer walkthroughs. Off by default.
    function setAllowSelfApproval(bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowSelfApproval = allowed;
        emit AllowSelfApprovalUpdated(allowed);
    }

    function setMaxBatchSize(uint256 newMaxBatchSize) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newMaxBatchSize == 0 || newMaxBatchSize > ABSOLUTE_MAX_BATCH_SIZE) {
            revert InvalidBatchSize(newMaxBatchSize);
        }
        maxBatchSize = newMaxBatchSize;
        emit MaxBatchSizeUpdated(newMaxBatchSize);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    function claimCount() external view returns (uint256) {
        return _claimIds.length;
    }

    /// @notice Paginated claim IDs. Keeps RPC responses bounded as the demo grows.
    function getClaimIds(
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory ids) {
        uint256 total = _claimIds.length;
        if (offset >= total) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        ids = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _claimIds[i];
        }
    }

    function getStats() external view returns (ClaimStats memory) {
        return _stats;
    }

    // ---------------------------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------------------------

    function _requireClaim(bytes32 claimId) private view returns (Claim storage claim) {
        claim = claims[claimId];
        if (claim.claimId == bytes32(0) || claim.status == ClaimStatus.None) {
            revert ClaimNotFound(claimId);
        }
    }

    function _markPaid(Claim storage claim) private {
        claim.status = ClaimStatus.Paid;
        claim.updatedAt = uint64(block.timestamp);
        _stats.approvedReserved -= 1;
        _stats.paid += 1;
    }
}
