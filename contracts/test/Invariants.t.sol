// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { LiquidityVault } from "../src/LiquidityVault.sol";

/**
 * @dev Randomized actor for invariant testing. Every action is bounded and failures caused by
 *      legitimate business rules (e.g. no available liquidity) are swallowed so the fuzzer can keep
 *      exploring. Accounting must still hold at the end of every call sequence.
 */
contract VaultHandler is Test {
    MockUSDC public immutable token;
    LiquidityVault public immutable vault;
    address public immutable recipient;

    address[] public actors;
    bytes32[] private _active;
    mapping(bytes32 claimId => uint256 amount) private _reservedAmount;
    mapping(bytes32 claimId => bool active) private _isActive;

    uint256 public activeReserved;
    uint256 public nonce;

    constructor(MockUSDC token_, LiquidityVault vault_, address recipient_) {
        token = token_;
        vault = vault_;
        recipient = recipient_;
        actors.push(address(0x1001));
        actors.push(address(0x1002));
        actors.push(address(0x1003));
    }

    function deposit(uint256 actorSeed, uint96 rawAmount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 amount = bound(rawAmount, 1, 250_000e6);

        token.mint(actor, amount);
        vm.startPrank(actor);
        token.approve(address(vault), amount);
        try vault.deposit(amount) { } catch { }
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint96 rawShares) external {
        address actor = actors[actorSeed % actors.length];
        uint256 owned = vault.sharesOf(actor);
        if (owned == 0) return;

        uint256 shares = bound(rawShares, 1, owned);
        vm.prank(actor);
        try vault.withdraw(shares) { } catch { }
    }

    function reserve(uint96 rawAmount) external {
        uint256 available = vault.availableLiquidity();
        if (available == 0) return;

        uint256 amount = bound(rawAmount, 1, available);
        bytes32 claimId = keccak256(abi.encode("invariant-claim", nonce++));

        // The handler itself holds CLAIM_MANAGER_ROLE for this test.
        try vault.reserve(claimId, amount) {
            _active.push(claimId);
            _reservedAmount[claimId] = amount;
            _isActive[claimId] = true;
            activeReserved += amount;
        } catch { }
    }

    function release(uint256 seed) external {
        (bytes32 claimId, bool removed) = _pick(seed);
        if (!removed) return;

        uint256 amount = _reservedAmount[claimId];
        delete _reservedAmount[claimId];
        delete _isActive[claimId];
        activeReserved -= amount;

        try vault.release(claimId) { } catch { }
    }

    function payout(uint256 seed) external {
        (bytes32 claimId, bool removed) = _pick(seed);
        if (!removed) return;

        uint256 amount = _reservedAmount[claimId];
        delete _reservedAmount[claimId];
        delete _isActive[claimId];
        activeReserved -= amount;

        try vault.payout(claimId, recipient, amount) { } catch { }
    }

    function activeCount() external view returns (uint256) {
        return _active.length;
    }

    function sumActorShares() external view returns (uint256 total) {
        for (uint256 i = 0; i < actors.length; i++) {
            total += vault.sharesOf(actors[i]);
        }
    }

    function _pick(uint256 seed) private returns (bytes32 claimId, bool removed) {
        if (_active.length == 0) return (bytes32(0), false);
        uint256 index = seed % _active.length;
        claimId = _active[index];
        _active[index] = _active[_active.length - 1];
        _active.pop();
        removed = true;
    }
}

contract ClaimFlowInvariantTest is StdInvariant, Test {
    MockUSDC internal token;
    LiquidityVault internal vault;
    VaultHandler internal handler;

    address internal admin = address(0xAD);
    address internal recipient = address(0xFEED);

    function setUp() public {
        vm.startPrank(admin);
        token = new MockUSDC(admin);
        vault = new LiquidityVault(IERC20(address(token)), admin);
        vm.stopPrank();

        handler = new VaultHandler(token, vault, recipient);

        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), address(handler));
        vault.grantRole(vault.CLAIM_MANAGER_ROLE(), address(handler));
        vm.stopPrank();

        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        selectors[2] = VaultHandler.reserve.selector;
        selectors[3] = VaultHandler.release.selector;
        selectors[4] = VaultHandler.payout.selector;
        targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));
        targetContract(address(handler));
    }

    /// @notice The core accounting invariant from PRD §8.1.
    function invariant_VaultBalanceCoversReserved() public view {
        assertGe(vault.totalAssets(), vault.totalReserved());
        assertEq(vault.availableLiquidity(), vault.totalAssets() - vault.totalReserved());
    }

    function invariant_ReservedBookkeepingMatches() public view {
        assertEq(handler.activeReserved(), vault.totalReserved());
    }

    function invariant_SharesAreFullyAccounted() public view {
        assertEq(handler.sumActorShares(), vault.totalShares());
    }

    function invariant_UtilizationNeverExceedsFull() public view {
        assertLe(vault.utilizationBps(), 10_000);
    }
}
