// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MockUSDC
 * @notice Six-decimal demo stablecoin used only on test networks. Nobody should mistake this for
 *         real USDC: there is no collateral, no redemption, and no monetary value.
 * @dev Minting is role restricted. The public faucet is intentionally capped per address and has a
 *      cooldown so a demo environment cannot be drained in a single transaction.
 */
contract MockUSDC is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Tokens a wallet receives from one faucet request.
    uint256 public constant FAUCET_AMOUNT = 100_000e6;
    /// @notice Time a wallet must wait between faucet requests.
    uint256 public constant FAUCET_COOLDOWN = 1 hours;
    /// @notice Maximum amount of tokens a single wallet can ever obtain from the faucet.
    uint256 public constant FAUCET_CAP = 500_000e6;

    mapping(address account => uint256 amount) public faucetMinted;
    mapping(address account => uint256 timestamp) public faucetAvailableAt;

    event Faucet(address indexed recipient, uint256 amount, uint256 nextAvailableAt);

    error ZeroAddress();
    error FaucetCooldownActive(uint256 availableAt);
    error FaucetCapExceeded(uint256 requested, uint256 remaining);

    constructor(address admin) ERC20("Mock USD Coin", "mUSDC") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Admin/minter mint used for seeding demo liquidity. Not callable by the public.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    /// @notice Public, rate-limited demo faucet.
    function faucet() external returns (uint256 amount) {
        uint256 availableAt = faucetAvailableAt[msg.sender];
        if (block.timestamp < availableAt) revert FaucetCooldownActive(availableAt);

        uint256 minted = faucetMinted[msg.sender];
        uint256 remaining = minted >= FAUCET_CAP ? 0 : FAUCET_CAP - minted;
        if (remaining < FAUCET_AMOUNT) revert FaucetCapExceeded(FAUCET_AMOUNT, remaining);

        amount = FAUCET_AMOUNT;
        unchecked {
            faucetMinted[msg.sender] = minted + amount;
        }
        faucetAvailableAt[msg.sender] = block.timestamp + FAUCET_COOLDOWN;
        _mint(msg.sender, amount);

        emit Faucet(msg.sender, amount, block.timestamp + FAUCET_COOLDOWN);
    }
}
