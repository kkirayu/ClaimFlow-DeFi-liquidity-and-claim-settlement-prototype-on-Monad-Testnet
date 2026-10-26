// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LiquidityVault
 * @notice Shared demo liquidity pool with explicit available/reserved accounting.
 *
 * Share value is derived from **available liquidity** (token balance minus total reserved), not the
 * full token balance. This intentionally makes claim reserves reduce the withdrawable value of LP
 * shares: the pool carries claim risk, and reserved tokens are never considered free liquidity.
 *
 * Accounting invariant: `asset.balanceOf(vault) >= totalReserved` in every valid state.
 */
contract LiquidityVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CLAIM_MANAGER_ROLE = keccak256("CLAIM_MANAGER_ROLE");

    IERC20 public immutable asset;
    string public constant shareSymbol = "cfmUSDC";

    uint256 public totalShares;
    mapping(address account => uint256 shares) public sharesOf;

    uint256 public totalReserved;
    mapping(bytes32 claimId => uint256 amount) public reservedByClaim;

    event Deposited(address indexed provider, uint256 assets, uint256 shares);
    event Withdrawn(address indexed provider, uint256 assets, uint256 shares);
    event LiquidityReserved(bytes32 indexed claimId, uint256 amount);
    event LiquidityReleased(bytes32 indexed claimId, uint256 amount);
    event PayoutExecuted(bytes32 indexed claimId, address indexed recipient, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error ZeroShares();
    error InsufficientShares(uint256 requested, uint256 owned);
    error InsufficientLiquidity(uint256 available, uint256 requested);
    error NoLiquidityForDeposit();
    error NoLiquidityForWithdrawal();
    error ReservationAlreadyExists(bytes32 claimId);
    error ReservationMissing(bytes32 claimId);
    error ReservationMismatch(bytes32 claimId, uint256 expected, uint256 actual);
    error ZeroReservation();

    constructor(IERC20 asset_, address admin) {
        if (address(asset_) == address(0) || admin == address(0)) revert ZeroAddress();
        asset = asset_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------------------------------
    // LP actions
    // ---------------------------------------------------------------------------------------------

    /**
     * @notice Deposit tokens and receive shares priced on available liquidity before the deposit.
     * @dev If shares exist but all liquidity is reserved, depositing is blocked to avoid an
     *      undefined/zero-denominator share price.
     */
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();

        uint256 availableBefore = availableLiquidity();
        if (totalShares == 0) {
            shares = assets;
        } else {
            if (availableBefore == 0) revert NoLiquidityForDeposit();
            shares = (assets * totalShares) / availableBefore;
        }
        if (shares == 0) revert ZeroShares();

        totalShares += shares;
        sharesOf[msg.sender] += shares;

        asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposited(msg.sender, assets, shares);
    }

    /**
     * @notice Redeem shares for tokens at the current available-liquidity share price.
     * @dev Reserved tokens can never be withdrawn: assets are computed from `availableLiquidity`
     *      and are therefore bounded by `balance - totalReserved`.
     */
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();

        uint256 owned = sharesOf[msg.sender];
        if (shares > owned) revert InsufficientShares(shares, owned);

        uint256 available = availableLiquidity();
        if (available == 0 || totalShares == 0) revert NoLiquidityForWithdrawal();

        assets = (shares * available) / totalShares;
        if (assets == 0) revert ZeroAmount();

        totalShares -= shares;
        sharesOf[msg.sender] = owned - shares;

        asset.safeTransfer(msg.sender, assets);

        emit Withdrawn(msg.sender, assets, shares);
    }

    // ---------------------------------------------------------------------------------------------
    // Claim manager actions
    // ---------------------------------------------------------------------------------------------

    /// @notice Lock available liquidity for a claim. Only the configured ClaimManager can call this.
    function reserve(bytes32 claimId, uint256 amount) external onlyRole(CLAIM_MANAGER_ROLE) {
        if (claimId == bytes32(0)) revert ZeroAmount();
        if (amount == 0) revert ZeroReservation();
        if (reservedByClaim[claimId] != 0) revert ReservationAlreadyExists(claimId);

        uint256 available = availableLiquidity();
        if (amount > available) revert InsufficientLiquidity(available, amount);

        reservedByClaim[claimId] = amount;
        totalReserved += amount;

        emit LiquidityReserved(claimId, amount);
    }

    /// @notice Release a reservation without moving tokens. Funds become available again.
    function release(bytes32 claimId)
        external
        onlyRole(CLAIM_MANAGER_ROLE)
        returns (uint256 amount)
    {
        amount = reservedByClaim[claimId];
        if (amount == 0) revert ReservationMissing(claimId);

        delete reservedByClaim[claimId];
        totalReserved -= amount;

        emit LiquidityReleased(claimId, amount);
    }

    /**
     * @notice Pay a reserved claim. The reservation must match the payout exactly.
     * @dev State is cleared before the external token transfer so a reentrant call cannot pay the
     *      same claim twice. `nonReentrant` provides an additional guard.
     */
    function payout(bytes32 claimId, address recipient, uint256 amount)
        external
        onlyRole(CLAIM_MANAGER_ROLE)
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 reserved = reservedByClaim[claimId];
        if (reserved == 0) revert ReservationMissing(claimId);
        if (reserved != amount) revert ReservationMismatch(claimId, reserved, amount);

        delete reservedByClaim[claimId];
        totalReserved -= amount;

        asset.safeTransfer(recipient, amount);

        emit PayoutExecuted(claimId, recipient, amount);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @notice Tokens that are not reserved for claims.
    function availableLiquidity() public view returns (uint256) {
        uint256 balance = totalAssets();
        if (balance <= totalReserved) return 0;
        return balance - totalReserved;
    }

    /// @notice Share price denominator: available liquidity per whole share.
    function convertToAssets(uint256 shares) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * availableLiquidity()) / totalShares;
    }

    /// @notice Estimated shares for a deposit at the current share price.
    function previewDeposit(uint256 assets) external view returns (uint256) {
        if (assets == 0) return 0;
        if (totalShares == 0) return assets;
        uint256 available = availableLiquidity();
        if (available == 0) return 0;
        return (assets * totalShares) / available;
    }

    function utilizationBps() external view returns (uint256) {
        uint256 balance = totalAssets();
        if (balance == 0) return 0;
        return (totalReserved * 10_000) / balance;
    }
}
